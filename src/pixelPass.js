import * as THREE from 'three';

const TARGET_LINES = 240; // roughly a 90s console's vertical resolution

// Renders the scene into a small render target, then blows it up with
// nearest-neighbour sampling, a limited colour palette and ordered dithering.
export class PixelPass {
  constructor(renderer) {
    this.renderer = renderer;
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      generateMipmaps: false,
    });
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.target.texture },
        resolution: { value: new THREE.Vector2(1, 1) },
        levels: { value: 10 },
        whiteout: { value: 0 },
        whiteColor: { value: new THREE.Color(0xffffff) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform vec2 resolution;
        uniform float levels;
        uniform float whiteout;
        uniform vec3 whiteColor;
        varying vec2 vUv;
        const float BAYER[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
        void main() {
          vec3 c = texture2D(tDiffuse, vUv).rgb;
          c = mix(c, whiteColor, whiteout);
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
          ivec2 p = ivec2(mod(floor(vUv * resolution), 4.0));
          float d = (BAYER[p.x + p.y * 4] + 0.5) / 16.0 - 0.5;
          gl_FragColor.rgb = clamp(floor(gl_FragColor.rgb * levels + 0.5 + d * 0.6) / levels, 0.0, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(quad);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  setSize(width, height) {
    const scale = Math.max(2, Math.round(height / TARGET_LINES));
    const w = Math.max(1, Math.ceil(width / scale));
    const h = Math.max(1, Math.ceil(height / scale));
    this.target.setSize(w, h);
    this.material.uniforms.resolution.value.set(w, h);
    this.renderer.setSize(width, height, false);
  }

  render(scene, camera) {
    const r = this.renderer;
    r.setRenderTarget(this.target);
    r.render(scene, camera);
    r.setRenderTarget(null);
    r.render(this.scene, this.camera);
  }
}
