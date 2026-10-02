import * as THREE from 'three';
import { fbm, mulberry32, smoothstep, valueNoise } from '../noise.js';
import { finishWorld, glow, instanced, limb, makeTerrain, makeWater, mat, slopeAt, v3, WORLD_RADIUS } from './common.js';

const riverZ = (x) => Math.sin(x * 0.0025) * 320 + 120;
const wallZ = (x) => -700 + Math.sin(x * 0.003) * 170 + Math.sin(x * 0.011) * 40;

function heightAt(x, z) {
  let h = (fbm(x * 0.0013, z * 0.0013, 23, 5) - 0.38) * 330;
  const river = smoothstep(50, 230, Math.abs(z - riverZ(x)));
  h = h * river - 14 * (1 - river);
  // Rice terraces on the lower slopes.
  if (h > 6 && h < 120) h = Math.floor(h / 8) * 8 + (h % 8) * 0.12;
  return h;
}

function colorAt(c, x, y, z, flat) {
  const n = valueNoise(x * 0.03, z * 0.03, 9);
  if (y < 3) return c.set(0xc9b98a);
  if (flat < 0.7) return c.set(n > 0.5 ? 0x7d8a7a : 0x6a7768);
  if (y < 120) {
    const step = Math.floor(y / 8) % 3;
    return c.set([0x8cc35a, 0x6fae48, 0x9fd06a][step]);
  }
  if (y > 200) return c.set(0x9aa89a);
  return c.set(n > 0.5 ? 0x3f7a4a : 0x346b40);
}

function pagoda(tiers = 5) {
  const g = new THREE.Group();
  const wall = mat(0xb23a2a);
  const roof = mat(0x2f6e5e);
  const base = new THREE.Mesh(new THREE.BoxGeometry(16, 2, 16), mat(0xd8cfb8));
  base.position.y = 1;
  g.add(base);
  let y = 2;
  for (let i = 0; i < tiers; i++) {
    const s = 11 - i * 1.6;
    const body = new THREE.Mesh(new THREE.BoxGeometry(s, 5, s), wall);
    body.position.y = y + 2.5;
    g.add(body);
    const r = new THREE.Mesh(new THREE.ConeGeometry(s * 0.95, 3, 4), roof);
    r.rotation.y = Math.PI / 4;
    r.position.y = y + 6;
    g.add(r);
    y += 7;
  }
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.8, 5, 4), mat(0xe6b422));
  spire.position.y = y + 1.5;
  g.add(spire);
  g.userData.height = y + 4;
  return g;
}

function crane() {
  const g = new THREE.Group();
  const white = mat(0xf4f1ea, { side: THREE.DoubleSide });
  g.add(limb(v3(0, 0, -2), v3(0, 0, 2), 0.45, 0.3, white, 4));
  g.add(limb(v3(0, 0, -2), v3(0, 0.6, -4.5), 0.25, 0.15, white, 4));
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.4), glow(0xd02020));
  cap.position.set(0, 0.8, -4.6);
  g.add(cap);
  const wings = [];
  for (const side of [1, -1]) {
    const pivot = new THREE.Group();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.8, side * 6, 0, 0.6, 0, 0, 1.2], 3));
    geo.computeVertexNormals();
    pivot.add(new THREE.Mesh(geo, white));
    g.add(pivot);
    wings.push({ pivot, side });
  }
  g.userData.flap = (t) => wings.forEach((w) => (w.pivot.rotation.z = Math.sin(t * 3) * 0.6 * w.side));
  return g;
}

export function buildChina() {
  const rng = mulberry32(88);
  const group = new THREE.Group();
  group.add(makeTerrain(heightAt, colorAt));
  group.add(makeWater(0, 0x4f9fb8));
  const solids = [];

  // Karst pillars rising from the river valley, like a Guilin painting.
  const pillarT = [];
  const capT = [];
  for (let i = 0; i < 400 && pillarT.length < 45; i++) {
    const x = (rng() - 0.5) * WORLD_RADIUS * 2;
    const dz = (rng() < 0.5 ? -1 : 1) * (90 + rng() * 380);
    const z = riverZ(x) + dz;
    if (Math.hypot(x, z) > WORLD_RADIUS) continue;
    if (solids.some((s) => Math.hypot(s.x - x, s.z - z) < s.r + 50)) continue;
    const base = heightAt(x, z);
    const r = 20 + rng() * 18;
    const h = 150 + rng() * 200;
    pillarT.push({ x, y: base + h / 2 - 10, z, sx: r, sy: h, sz: r, ry: rng() * 3 });
    capT.push({ x, y: base + h - 8, z, sx: r * 1.15, sy: r * 0.5, sz: r * 1.15, ry: rng() * 3 });
    solids.push({ type: 'cyl', x, z, r: r * 1.05, top: base + h - 2 });
  }
  group.add(instanced(new THREE.CylinderGeometry(0.85, 1, 1, 7), mat(0x8e9a8a), pillarT));
  group.add(instanced(new THREE.IcosahedronGeometry(1, 0), mat(0x3f7f45), capT));

  // The Great Wall snaking along the northern ridges, with watchtowers.
  const segT = [];
  const towerT = [];
  const roofT = [];
  let n = 0;
  for (let x = -1500; x < 1500; x += 12) {
    const z = wallZ(x);
    const z2 = wallZ(x + 12);
    const y = heightAt(x + 6, (z + z2) / 2);
    if (y < 2) continue;
    const ry = -Math.atan2(z2 - z, 12);
    segT.push({ x: x + 6, y: y + 3, z: (z + z2) / 2, sx: 13.5, sy: 10, sz: 5, ry });
    if (n++ % 12 === 0) {
      towerT.push({ x: x + 6, y: y + 7, z: (z + z2) / 2, sx: 10, sy: 16, sz: 10, ry });
      roofT.push({ x: x + 6, y: y + 17, z: (z + z2) / 2, s: 1, ry: ry + Math.PI / 4 });
      solids.push({ type: 'cyl', x: x + 6, z: (z + z2) / 2, r: 7, top: y + 19 });
    }
  }
  const stone = mat(0xb8a27a);
  group.add(instanced(new THREE.BoxGeometry(1, 1, 1), stone, segT));
  group.add(instanced(new THREE.BoxGeometry(1, 1, 1), mat(0xa8916a), towerT));
  group.add(instanced(new THREE.ConeGeometry(8.5, 4, 4), mat(0x5a3a2a), roofT));

  // Pagodas on gentle ground.
  for (let i = 0, placed = 0; i < 300 && placed < 8; i++) {
    const x = (rng() - 0.5) * WORLD_RADIUS * 1.8;
    const z = (rng() - 0.5) * WORLD_RADIUS * 1.8;
    const y = heightAt(x, z);
    if (y < 5 || slopeAt(heightAt, x, z) > 0.25) continue;
    if (solids.some((s) => Math.hypot(s.x - x, s.z - z) < s.r + 40)) continue;
    const p = pagoda(4 + Math.floor(rng() * 4));
    p.position.set(x, y - 1, z);
    p.rotation.y = rng() * Math.PI;
    group.add(p);
    solids.push({ type: 'cyl', x, z, r: 8, top: y + p.userData.height });
    placed++;
  }

  // Cherry blossoms and pines.
  const trunks = [];
  const blossoms = [];
  const pines = [];
  for (let i = 0; i < 3000 && trunks.length + pines.length < 900; i++) {
    const x = (rng() - 0.5) * WORLD_RADIUS * 2.2;
    const z = (rng() - 0.5) * WORLD_RADIUS * 2.2;
    const y = heightAt(x, z);
    if (y < 4 || slopeAt(heightAt, x, z) > 0.6) continue;
    const s = 0.8 + rng() * 0.7;
    if (y > 110 || rng() < 0.4) {
      pines.push({ x, y: y + 7 * s, z, s, ry: rng() * 3 });
    } else {
      trunks.push({ x, y: y + 3 * s, z, s });
      blossoms.push({ x, y: y + 8 * s, z, s: s * 5, ry: rng() * 3 });
    }
  }
  group.add(instanced(new THREE.CylinderGeometry(0.5, 0.8, 6, 4), mat(0x5a3a2a), trunks));
  group.add(instanced(new THREE.IcosahedronGeometry(1, 0), mat(0xf4a6c4), blossoms));
  group.add(instanced(new THREE.ConeGeometry(4, 14, 5), mat(0x1f5a3a), pines));

  // Sky lanterns drifting upward. Flying through one releases a wish.
  const lanternCount = 160;
  const lanterns = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 2.2, 1.6), glow(0xffa040), lanternCount);
  lanterns.frustumCulled = false;
  const lanternData = [];
  const spawnLantern = (l, anywhere) => {
    const a = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * WORLD_RADIUS * 0.9;
    l.x = Math.cos(a) * d;
    l.z = Math.sin(a) * d;
    l.base = Math.max(heightAt(l.x, l.z), 0) + 4;
    l.y = anywhere ? l.base + Math.random() * 600 : l.base;
    l.phase = Math.random() * 6;
    return l;
  };
  for (let i = 0; i < lanternCount; i++) lanternData.push(spawnLantern({}, true));
  group.add(lanterns);

  // Cranes flying in V formations.
  const birds = [];
  for (let f = 0; f < 3; f++) {
    const cx = (rng() - 0.5) * 1800;
    const cz = (rng() - 0.5) * 1800;
    const alt = 260 + rng() * 160;
    for (let k = 0; k < 7; k++) {
      const b = crane();
      group.add(b);
      const row = Math.ceil(k / 2);
      const side = k === 0 ? 0 : k % 2 ? 1 : -1;
      birds.push({ obj: b, cx, cz, alt, r: 260 + f * 40, speed: 0.08 + f * 0.015, back: row * 7, side: side * row * 6, phase: f * 2 });
    }
  }

  const m = new THREE.Matrix4();
  function update(dt, t) {
    lanternData.forEach((l, i) => {
      l.y += dt * 9;
      if (l.y > 700) spawnLantern(l, false);
      m.makeTranslation(l.x + Math.sin(t * 0.5 + l.phase) * 3, l.y, l.z + Math.cos(t * 0.4 + l.phase) * 3);
      lanterns.setMatrixAt(i, m);
    });
    lanterns.instanceMatrix.needsUpdate = true;
    for (const b of birds) {
      const a = b.phase + t * b.speed;
      const cx = b.cx + Math.cos(a) * b.r;
      const cz = b.cz + Math.sin(a) * b.r;
      // Heading is tangent to the circle; offset each bird behind/aside the leader.
      const fx = -Math.sin(a);
      const fz = Math.cos(a);
      b.obj.position.set(cx - fx * b.back + fz * b.side, b.alt + Math.sin(t + b.back) * 2, cz - fz * b.back - fx * b.side);
      b.obj.rotation.y = -a + Math.PI;
      b.obj.userData.flap(t + b.back * 0.1);
    }
  }

  // Lantern pickups: returns positions of lanterns the dragon flew through.
  function pickups(p) {
    const hits = [];
    for (const l of lanternData) {
      if (Math.abs(l.y - p.y) < 9 && Math.hypot(l.x - p.x, l.z - p.z) < 9) {
        hits.push(new THREE.Vector3(l.x, l.y, l.z));
        spawnLantern(l, false);
      }
    }
    return hits.length ? { hits, points: 25, label: 'WISH!', colors: [0xffa040, 0xffe066, 0xff5a5a] } : null;
  }

  return finishWorld({
    id: 'china',
    group,
    heightAt,
    waterLevel: 0,
    solids,
    sky: { top: 0x7aa7d9, bottom: 0xf7c9b0, sun: 0xff6a4a, sunDir: v3(0.6, 0.35, -1) },
    fog: { color: 0xe9d4cc, near: 220, far: 1600 },
    light: { sky: 0xfff0e6, ground: 0x4a6a4a, sun: 0xffe0c8 },
    cloudColor: 0xfff0f4,
    thermals: [
      { x: -300, z: 120, r: 50, top: 560 },
      { x: 500, z: -250, r: 50, top: 560 },
      { x: -900, z: -300, r: 55, top: 600 },
      { x: 800, z: 500, r: 45, top: 520 },
    ],
    start: { x: 0, y: 200, z: 900, yaw: 0 },
    update,
    pickups,
  });
}
