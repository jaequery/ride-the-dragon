import * as THREE from 'three';

const HIDDEN_Y = -1e5;

// Pixel sparkles for ring pickups, lanterns and fireworks.
export class Sparkles {
  constructor(scene, max = 1500) {
    this.max = max;
    this.next = 0;
    this.pos = new Float32Array(max * 3).fill(HIDDEN_Y);
    this.col = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.grav = new Float32Array(max);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 3, sizeAttenuation: false, vertexColors: true, fog: false }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.tmp = new THREE.Color();
  }

  burst(at, count, colors, speed = 30, gravity = 10, life = 1.2) {
    for (let n = 0; n < count; n++) {
      const i = this.next;
      this.next = (this.next + 1) % this.max;
      const u = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const s = speed * (0.4 + Math.random() * 0.6);
      this.vel[i * 3] = r * Math.cos(a) * s;
      this.vel[i * 3 + 1] = u * s;
      this.vel[i * 3 + 2] = r * Math.sin(a) * s;
      this.pos[i * 3] = at.x;
      this.pos[i * 3 + 1] = at.y;
      this.pos[i * 3 + 2] = at.z;
      this.tmp.set(colors[n % colors.length]);
      this.col[i * 3] = this.tmp.r;
      this.col[i * 3 + 1] = this.tmp.g;
      this.col[i * 3 + 2] = this.tmp.b;
      this.life[i] = life * (0.6 + Math.random() * 0.4);
      this.grav[i] = gravity;
    }
  }

  fireworks(center) {
    const palettes = [
      [0xff4d6d, 0xffd84a],
      [0x4ad7ff, 0xffffff],
      [0x9dff5a, 0xffe066],
      [0xc77dff, 0xff8a3d],
    ];
    for (let k = 0; k < 6; k++) {
      const at = center.clone().add(new THREE.Vector3((Math.random() - 0.5) * 120, 30 + Math.random() * 70, (Math.random() - 0.5) * 120));
      this.burst(at, 90, palettes[k % palettes.length], 45, 14, 1.8);
    }
  }

  clear() {
    this.life.fill(0);
    this.pos.fill(HIDDEN_Y);
    this.points.geometry.attributes.position.needsUpdate = true;
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.pos[i * 3 + 1] = HIDDEN_Y;
        continue;
      }
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

// Wind streaks in front of the camera that show up when soaring.
export class SpeedLines {
  constructor(camera, count = 60) {
    this.count = count;
    this.data = [];
    const pos = new Float32Array(count * 6);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.material = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, fog: false, depthTest: false });
    this.lines = new THREE.LineSegments(geo, this.material);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 10;
    camera.add(this.lines);
    for (let i = 0; i < count; i++) this.data.push(this.spawn({}, true));
  }

  spawn(d, anywhere) {
    const a = Math.random() * Math.PI * 2;
    const r = 4 + Math.random() * 10;
    d.x = Math.cos(a) * r;
    d.y = Math.sin(a) * r * 0.7;
    d.z = anywhere ? -Math.random() * 80 : -80;
    return d;
  }

  update(dt, speed, intensity) {
    this.material.opacity = Math.min(0.75, intensity * 0.8);
    this.lines.visible = intensity > 0.03;
    const arr = this.lines.geometry.attributes.position.array;
    const len = 2 + speed * 0.05;
    this.data.forEach((d, i) => {
      d.z += speed * 1.6 * dt;
      if (d.z > -2) this.spawn(d, false);
      arr.set([d.x, d.y, d.z, d.x, d.y, d.z - len], i * 6);
    });
    this.lines.geometry.attributes.position.needsUpdate = true;
  }
}

// Rising shimmer columns that mark updrafts.
export function makeThermalVisuals(world) {
  const perColumn = 70;
  const n = world.thermals.length * perColumn;
  const pos = new Float32Array(n * 3);
  const seeds = [];
  world.thermals.forEach((th) => {
    const base = world.groundAt(th.x, th.z);
    for (let k = 0; k < perColumn; k++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * th.r * 0.8;
      seeds.push({ x: th.x + Math.cos(a) * r, z: th.z + Math.sin(a) * r, base, top: th.top, y: base + Math.random() * (th.top - base), v: 20 + Math.random() * 30 });
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xfff6c8, size: 2, sizeAttenuation: false, transparent: true, opacity: 0.7 }));
  points.frustumCulled = false;
  points.update = (dt) => {
    seeds.forEach((s, i) => {
      s.y += s.v * dt;
      if (s.y > s.top) s.y = s.base;
      pos[i * 3] = s.x;
      pos[i * 3 + 1] = s.y;
      pos[i * 3 + 2] = s.z;
    });
    geo.attributes.position.needsUpdate = true;
  };
  return points;
}
