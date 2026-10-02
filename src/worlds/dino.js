import * as THREE from 'three';
import { fbm, mulberry32, valueNoise } from '../noise.js';
import { finishWorld, glow, instanced, limb, makeTerrain, makeWater, mat, slopeAt, v3, WORLD_RADIUS } from './common.js';

const VOLCANOES = [
  { x: -520, z: -760, r: 430, h: 400 },
  { x: 950, z: 280, r: 300, h: 270 },
];

function heightAt(x, z) {
  let h = (fbm(x * 0.0011, z * 0.0011, 11, 5) - 0.45) * 380;
  for (const v of VOLCANOES) {
    const d = Math.hypot(x - v.x, z - v.z);
    if (d < v.r) {
      let cone = v.h * Math.pow(1 - d / v.r, 1.25);
      const crater = v.r * 0.11;
      if (d < crater) cone -= (1 - d / crater) * v.h * 0.18;
      h = Math.max(h, cone + h * 0.15);
    }
  }
  return h;
}

function colorAt(c, x, y, z, flat) {
  const n = valueNoise(x * 0.02, z * 0.02, 5);
  for (const v of VOLCANOES) {
    const d = Math.hypot(x - v.x, z - v.z);
    if (d < v.r * 0.13 && y > v.h * 0.6) return c.set(n > 0.5 ? 0xff6a1f : 0xffa52a);
    if (d < v.r * 0.7 && y > 40) return c.set(n > 0.5 ? 0x4a3a33 : 0x3a2d29);
  }
  if (y < 5) return c.set(0xdcc681);
  if (flat < 0.72) return c.set(n > 0.5 ? 0x7a6448 : 0x6b573f);
  if (y > 170) return c.set(0x8a7a5f);
  if (n > 0.66) return c.set(0x6aa83a);
  return c.set(n > 0.33 ? 0x4c8f2f : 0x3d7a28);
}

function brachiosaurus() {
  const g = new THREE.Group();
  const skin = mat(0x7c8f5a);
  const belly = mat(0xb5b07a);
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), skin);
  body.scale.set(6, 5, 9);
  body.position.y = 10;
  g.add(body);
  for (const [x, z] of [[-3.5, -5], [3.5, -5], [-3.5, 5], [3.5, 5]]) g.add(limb(v3(x, 9, z), v3(x, 0, z), 1.5, 1.3, belly, 5));
  const neck = limb(v3(0, 12, -6), v3(0, 28, -14), 2.2, 1.0, skin, 5);
  g.add(neck);
  const head = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.8, 3.4), skin);
  head.position.set(0, 28.5, -15.5);
  g.add(head);
  g.add(limb(v3(0, 10, 8), v3(0, 5, 22), 2.0, 0.3, skin, 5));
  return g;
}

function stegosaurus() {
  const g = new THREE.Group();
  const skin = mat(0x9b7a3c);
  const plate = mat(0xd2553a);
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), skin);
  body.scale.set(3, 3.2, 6.5);
  body.position.y = 5;
  g.add(body);
  for (const [x, z] of [[-2, -3.5], [2, -3.5], [-2, 3.5], [2, 3.5]]) g.add(limb(v3(x, 4, z), v3(x, 0, z), 0.8, 0.7, skin, 4));
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 2.2), skin);
  head.position.set(0, 3.5, -7.5);
  g.add(head);
  const plateGeo = new THREE.ConeGeometry(1.2, 2.6, 3);
  for (let i = 0; i < 6; i++) {
    const p = new THREE.Mesh(plateGeo, plate);
    p.position.set(0, 8.3 - Math.abs(i - 2.5) * 0.4, -4 + i * 1.6);
    p.scale.z = 0.25;
    g.add(p);
  }
  g.add(limb(v3(0, 5, 6), v3(0, 3, 13), 1.2, 0.2, skin, 4));
  return g;
}

function pterodactyl() {
  const g = new THREE.Group();
  const skin = mat(0xa05a3a, { side: THREE.DoubleSide });
  g.add(limb(v3(0, 0, -2.5), v3(0, 0, 2), 0.6, 0.3, skin, 4));
  const crest = new THREE.Mesh(new THREE.ConeGeometry(0.4, 2.5, 3), skin);
  crest.rotation.x = -Math.PI / 2;
  crest.position.set(0, 0.3, -3.6);
  g.add(crest);
  const wings = [];
  for (const side of [1, -1]) {
    const pivot = new THREE.Group();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -1, side * 8, 0, 0.5, 0, 0, 1.5], 3));
    geo.computeVertexNormals();
    pivot.add(new THREE.Mesh(geo, skin));
    g.add(pivot);
    wings.push({ pivot, side });
  }
  g.userData.flap = (t) => wings.forEach((w) => (w.pivot.rotation.z = Math.sin(t * 4) * 0.5 * w.side));
  return g;
}

export function buildDino() {
  const rng = mulberry32(42);
  const group = new THREE.Group();
  group.add(makeTerrain(heightAt, colorAt));
  group.add(makeWater(0, 0x2f8fb0));

  // Prehistoric palms and cycads.
  const trunks = [];
  const crowns = [];
  for (let i = 0; i < 2500 && trunks.length < 650; i++) {
    const x = (rng() - 0.5) * WORLD_RADIUS * 2.2;
    const z = (rng() - 0.5) * WORLD_RADIUS * 2.2;
    const y = heightAt(x, z);
    if (y < 6 || y > 150 || slopeAt(heightAt, x, z) > 0.5) continue;
    if (VOLCANOES.some((v) => Math.hypot(x - v.x, z - v.z) < v.r * 0.75)) continue;
    const s = 0.8 + rng() * 0.8;
    trunks.push({ x, y: y + 6 * s, z, s, rz: (rng() - 0.5) * 0.3 });
    crowns.push({ x, y: y + 12.5 * s, z, s, ry: rng() * 3 });
  }
  group.add(instanced(new THREE.CylinderGeometry(0.7, 1.1, 12, 5), mat(0x7a5530), trunks));
  group.add(instanced(new THREE.ConeGeometry(7, 3.5, 6), mat(0x2f7a2a), crowns));

  // Lava glow and smoke columns.
  const smoke = [];
  const smokePos = new Float32Array(VOLCANOES.length * 120 * 3);
  for (const v of VOLCANOES) {
    const lava = new THREE.Mesh(new THREE.CylinderGeometry(v.r * 0.07, v.r * 0.04, 6, 7), glow(0xff7a1a));
    lava.position.set(v.x, heightAt(v.x, v.z) + 2, v.z);
    group.add(lava);
    for (let k = 0; k < 120; k++) smoke.push({ v, y: Math.random() * 300, a: Math.random() * 6, r: Math.random() * 20 });
  }
  const smokeGeo = new THREE.BufferGeometry();
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
  const smokePts = new THREE.Points(smokeGeo, new THREE.PointsMaterial({ color: 0x6b6460, size: 5, sizeAttenuation: false }));
  smokePts.frustumCulled = false;
  group.add(smokePts);

  // Wandering herds.
  const walkers = [];
  for (let i = 0; i < 14; i++) {
    const dino = i % 3 === 0 ? stegosaurus() : brachiosaurus();
    const a = rng() * Math.PI * 2;
    const d = 200 + rng() * 1100;
    walkers.push({ obj: dino, cx: Math.cos(a) * d, cz: Math.sin(a) * d, r: 30 + rng() * 60, speed: 0.04 + rng() * 0.05, phase: rng() * 6 });
    group.add(dino);
  }

  // Pterodactyl flocks circling overhead.
  const flyers = [];
  for (let f = 0; f < 4; f++) {
    const cx = (rng() - 0.5) * 2000;
    const cz = (rng() - 0.5) * 2000;
    const alt = 230 + rng() * 150;
    for (let k = 0; k < 5; k++) {
      const p = pterodactyl();
      group.add(p);
      flyers.push({ obj: p, cx, cz, alt: alt + k * 6, r: 110 + k * 14, speed: 0.25 + f * 0.03, phase: k * 0.35 + f });
    }
  }

  function update(dt, t) {
    let i = 0;
    for (const s of smoke) {
      s.y += dt * 25;
      if (s.y > 320) s.y = 0;
      const base = heightAt(s.v.x, s.v.z);
      const spread = s.r + s.y * 0.25;
      smokePos[i++] = s.v.x + Math.cos(s.a + s.y * 0.01) * spread + s.y * 0.3;
      smokePos[i++] = base + s.y;
      smokePos[i++] = s.v.z + Math.sin(s.a + s.y * 0.01) * spread;
    }
    smokeGeo.attributes.position.needsUpdate = true;

    for (const w of walkers) {
      const a = w.phase + t * w.speed;
      const x = w.cx + Math.cos(a) * w.r;
      const z = w.cz + Math.sin(a) * w.r;
      w.obj.position.set(x, Math.max(heightAt(x, z), 0), z);
      w.obj.rotation.y = -a + Math.PI;
    }
    for (const f of flyers) {
      const a = f.phase + t * f.speed;
      f.obj.position.set(f.cx + Math.cos(a) * f.r, f.alt + Math.sin(t * 0.7 + f.phase) * 8, f.cz + Math.sin(a) * f.r);
      f.obj.rotation.set(0, -a + Math.PI, 0.35);
      f.obj.userData.flap(t + f.phase);
    }
  }

  return finishWorld({
    id: 'dino',
    group,
    heightAt,
    waterLevel: 0,
    sky: { top: 0x5fa8d0, bottom: 0xf3d08f, sun: 0xfff0a0, sunDir: v3(-0.4, 0.5, -1) },
    fog: { color: 0xe9caa0, near: 250, far: 1700 },
    light: { sky: 0xfff1d0, ground: 0x6b5a3a, sun: 0xffe2a8 },
    cloudColor: 0xfff4e0,
    thermals: [
      { x: -520, z: -500, r: 60, top: 600 },
      { x: 300, z: -300, r: 45, top: 520 },
      { x: 700, z: 600, r: 50, top: 560 },
      { x: -800, z: 400, r: 50, top: 560 },
    ],
    start: { x: 0, y: 220, z: 650, yaw: 0 },
    update,
  });
}
