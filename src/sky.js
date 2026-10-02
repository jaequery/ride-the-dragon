import * as THREE from 'three';

// A gradient sky dome with a chunky sun. It follows the camera so it never
// gets closer.
export function makeSky({ top, bottom, sun = 0xfff2b0, sunDir }) {
  const group = new THREE.Group();
  const R = 3200;
  const geo = new THREE.SphereGeometry(R, 16, 12);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cTop = new THREE.Color(top);
  const cBottom = new THREE.Color(bottom);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.max(0, pos.getY(i) / R) * 1.8);
    c.copy(cBottom).lerp(cTop, t);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  group.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })));

  const sunMesh = new THREE.Mesh(new THREE.CircleGeometry(160, 8), new THREE.MeshBasicMaterial({ color: sun, fog: false, depthWrite: false }));
  sunMesh.position.copy(sunDir).normalize().multiplyScalar(R * 0.9);
  sunMesh.lookAt(0, 0, 0);
  group.add(sunMesh);
  group.renderOrder = -1;
  group.traverse((o) => (o.renderOrder = -1));
  return group;
}
