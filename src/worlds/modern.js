import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fbm, mulberry32, smoothstep, valueNoise } from '../noise.js';
import { finishWorld, instanced, limb, makeTerrain, makeWater, mat, slopeAt, v3, WORLD_RADIUS } from './common.js';

const CITY = { x: 0, z: -450, r: 520 };
const CITY_Y = 8;
const BLOCK = 56;
const ROAD = 14;
const COAST_Z = 750;

function heightAt(x, z) {
  let h = (fbm(x * 0.0012, z * 0.0012, 31, 5) - 0.4) * 320;
  const k = smoothstep(CITY.r, CITY.r + 220, Math.hypot(x - CITY.x, z - CITY.z));
  h = CITY_Y + (h - CITY_Y) * k;
  if (z > COAST_Z) h -= (z - COAST_Z) * 0.35;
  return h;
}

function colorAt(c, x, y, z, flat) {
  const n = valueNoise(x * 0.03, z * 0.03, 4);
  if (y < 3) return c.set(0xe2d39a);
  if (Math.hypot(x - CITY.x, z - CITY.z) < CITY.r + 30) return c.set(n > 0.5 ? 0x9a9a92 : 0x8c8c86);
  if (flat < 0.72) return c.set(0x7c7a6a);
  if (y > 190) return c.set(0xe8eef0); // snowy peaks
  return c.set(n > 0.6 ? 0x7cb84c : n > 0.3 ? 0x5ea040 : 0x4e8c38);
}

// A tiny pixel-art window texture. Texel (0,0) is plain wall so roofs can
// sample it without showing windows.
function windowTexture() {
  const W = 8;
  const H = 8;
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const isWin = x % 2 === 1 && y % 2 === 1;
      const lit = isWin && ((x * 7 + y * 13) % 5 === 0);
      const v = isWin ? (lit ? [255, 230, 140] : [90, 130, 170]) : [235, 235, 235];
      data.set([...v, 255], (y * W + x) * 4);
    }
  }
  const tex = new THREE.DataTexture(data, W, H);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function building(w, h, d, x, z, color) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv;
  // Face order: +x, -x, +y, -y, +z, -z (4 verts each).
  for (let i = 0; i < uv.count; i++) {
    const face = Math.floor(i / 4);
    if (face === 2 || face === 3) {
      uv.setXY(i, 0.01, 0.01);
      continue;
    }
    const across = face < 2 ? d : w;
    uv.setXY(i, uv.getX(i) * (across / 8), uv.getY(i) * (h / 8));
  }
  geo.translate(x, CITY_Y + h / 2, z);
  const colors = new Float32Array(geo.attributes.position.count * 3);
  const c = new THREE.Color(color);
  for (let i = 0; i < colors.length; i += 3) colors.set([c.r, c.g, c.b], i);
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

function windTurbine() {
  const g = new THREE.Group();
  const white = mat(0xf2f2f2);
  g.add(limb(v3(0, 0, 0), v3(0, 60, 0), 2, 1.2, white, 6));
  const hub = new THREE.Group();
  hub.position.set(0, 60, -2);
  g.add(hub);
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(1.4, 28, 0.4), white);
    blade.position.y = 14;
    const holder = new THREE.Group();
    holder.rotation.z = (i * Math.PI * 2) / 3;
    holder.add(blade);
    hub.add(holder);
  }
  g.userData.spin = (t) => (hub.rotation.z = t * 1.4);
  return g;
}

function balloon(rng) {
  const g = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(1, 1).toNonIndexed();
  const pos = geo.attributes.position;
  const palette = [
    [0xe63946, 0xffd166],
    [0x118ab2, 0xffffff],
    [0x06d6a0, 0xef476f],
    [0x8338ec, 0xffbe0b],
  ][Math.floor(rng() * 4)];
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 3) {
    const a = Math.atan2(pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2), pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2));
    c.set(palette[Math.floor(((a + Math.PI) / (Math.PI * 2)) * 8) % 2]);
    for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], (i + k) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const envelope = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  envelope.scale.set(12, 14, 12);
  envelope.position.y = 18;
  g.add(envelope);
  const basket = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4), mat(0x8b5a2b));
  g.add(basket);
  for (const [x, z] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) g.add(limb(v3(x, 1.5, z), v3(x * 3, 8, z * 3), 0.1, 0.1, mat(0x333333), 3));
  return g;
}

function airplane() {
  const g = new THREE.Group();
  const white = mat(0xf4f4f4);
  g.add(limb(v3(0, 0, -14), v3(0, 0, 14), 2.2, 1.6, white, 6));
  const wing = new THREE.Mesh(new THREE.BoxGeometry(34, 0.6, 5), white);
  wing.position.z = 1;
  g.add(wing);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 7, 4), mat(0xd62828));
  tail.position.set(0, 4, 12);
  g.add(tail);
  const stab = new THREE.Mesh(new THREE.BoxGeometry(12, 0.5, 3), white);
  stab.position.set(0, 0.5, 12.5);
  g.add(stab);
  return g;
}

function ferrisWheel() {
  const g = new THREE.Group();
  const steel = mat(0xdedede);
  g.add(limb(v3(-14, 0, 0), v3(0, 45, 0), 1.2, 1.2, steel, 4));
  g.add(limb(v3(14, 0, 0), v3(0, 45, 0), 1.2, 1.2, steel, 4));
  const wheel = new THREE.Group();
  wheel.position.y = 45;
  g.add(wheel);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(38, 1, 4, 24), steel);
  wheel.add(rim);
  const cabins = [];
  const colors = [0xe63946, 0xffd166, 0x06d6a0, 0x118ab2];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    wheel.add(limb(v3(0, 0, 0), v3(Math.cos(a) * 38, Math.sin(a) * 38, 0), 0.4, 0.4, steel, 3));
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), mat(colors[i % 4]));
    wheel.add(cabin);
    cabins.push({ cabin, a });
  }
  g.userData.spin = (t) => {
    wheel.rotation.z = t * 0.15;
    for (const c of cabins) {
      c.cabin.position.set(Math.cos(c.a) * 38, Math.sin(c.a) * 38 - 3, 0);
      c.cabin.rotation.z = -wheel.rotation.z; // stay upright
    }
  };
  return g;
}

export function buildModern() {
  const rng = mulberry32(2024);
  const group = new THREE.Group();
  group.add(makeTerrain(heightAt, colorAt));
  group.add(makeWater(0, 0x2b78c2));
  const solids = [];

  // Downtown: a grid of towers, tallest near the centre.
  const geos = [];
  const tones = [0xc9d3dc, 0xa7b4c2, 0xd9cbb5, 0x8fa3b8, 0xe0e0e0, 0xb7c9a8];
  for (let gx = -10; gx <= 10; gx++) {
    for (let gz = -10; gz <= 10; gz++) {
      const cx = CITY.x + gx * BLOCK;
      const cz = CITY.z + gz * BLOCK;
      const d = Math.hypot(cx - CITY.x, cz - CITY.z);
      if (d > CITY.r - 30 || rng() < 0.12) continue;
      const w = 18 + rng() * (BLOCK - ROAD - 20);
      const dd = 18 + rng() * (BLOCK - ROAD - 20);
      const h = 16 + rng() * 40 + Math.pow(rng(), 2) * 300 * Math.exp(-d / 220);
      geos.push(building(w, h, dd, cx, cz, tones[Math.floor(rng() * tones.length)]));
      solids.push({ type: 'box', minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - dd / 2, maxZ: cz + dd / 2, top: CITY_Y + h });
    }
  }
  const city = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshLambertMaterial({ map: windowTexture(), vertexColors: true, flatShading: true }));
  geos.forEach((g) => g.dispose());
  group.add(city);

  // Roads between the blocks.
  const roadT = [];
  const lineT = [];
  for (let i = -10; i <= 10; i++) {
    const off = i * BLOCK + BLOCK / 2;
    if (Math.abs(off) > CITY.r) continue;
    const len = 2 * Math.sqrt(CITY.r * CITY.r - off * off);
    roadT.push({ x: CITY.x + off, y: CITY_Y + 0.15, z: CITY.z, sx: ROAD, sy: 0.3, sz: len });
    roadT.push({ x: CITY.x, y: CITY_Y + 0.2, z: CITY.z + off, sx: len, sy: 0.3, sz: ROAD });
    lineT.push({ x: CITY.x + off, y: CITY_Y + 0.4, z: CITY.z, sx: 0.8, sy: 0.2, sz: len });
    lineT.push({ x: CITY.x, y: CITY_Y + 0.45, z: CITY.z + off, sx: len, sy: 0.2, sz: 0.8 });
  }
  group.add(instanced(new THREE.BoxGeometry(1, 1, 1), mat(0x3a3a40), roadT));
  group.add(instanced(new THREE.BoxGeometry(1, 1, 1), mat(0xf2d64b), lineT));

  // Parks and countryside trees.
  const treeT = [];
  for (let i = 0; i < 2500 && treeT.length < 600; i++) {
    const x = (rng() - 0.5) * WORLD_RADIUS * 2.2;
    const z = (rng() - 0.5) * WORLD_RADIUS * 2.2;
    const y = heightAt(x, z);
    if (y < 4 || y > 170 || slopeAt(heightAt, x, z) > 0.55) continue;
    if (Math.hypot(x - CITY.x, z - CITY.z) < CITY.r + 40) continue;
    const s = 3 + rng() * 3;
    treeT.push({ x, y: y + s, z, s, sy: s * 1.4, ry: rng() * 3 });
  }
  group.add(instanced(new THREE.IcosahedronGeometry(1, 0), mat(0x3f8a3a), treeT));

  // Spinning wind turbines on the hills.
  const spinners = [];
  for (let i = 0, placed = 0; i < 400 && placed < 14; i++) {
    const x = (rng() - 0.5) * WORLD_RADIUS * 2;
    const z = (rng() - 0.5) * WORLD_RADIUS * 2;
    const y = heightAt(x, z);
    if (y < 60 || Math.hypot(x - CITY.x, z - CITY.z) < CITY.r + 150) continue;
    const t = windTurbine();
    t.position.set(x, y, z);
    group.add(t);
    spinners.push(t);
    solids.push({ type: 'cyl', x, z, r: 3, top: y + 60 });
    placed++;
  }

  // A seaside Ferris wheel.
  const wheel = ferrisWheel();
  wheel.position.set(260, Math.max(heightAt(260, COAST_Z - 40), 0), COAST_Z - 40);
  group.add(wheel);
  spinners.push(wheel);

  // Hot air balloons drifting over town.
  const balloons = [];
  for (let i = 0; i < 14; i++) {
    const b = balloon(rng);
    const a = rng() * Math.PI * 2;
    const d = 100 + rng() * 1100;
    balloons.push({ obj: b, x: Math.cos(a) * d, z: Math.sin(a) * d, alt: 160 + rng() * 280, phase: rng() * 6 });
    group.add(b);
  }

  // Airliners crossing high above.
  const planes = [];
  for (let i = 0; i < 3; i++) {
    const p = airplane();
    group.add(p);
    planes.push({ obj: p, lane: -800 + i * 800, alt: 640 + i * 30, speed: 70 + i * 15, off: i * 900 });
  }

  // Sailboats on the bay.
  const boats = [];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 10), mat(0xffffff));
    g.add(hull);
    const sail = new THREE.Mesh(new THREE.ConeGeometry(4, 12, 3), mat(0xffe8d0));
    sail.scale.z = 0.2;
    sail.position.y = 7;
    g.add(sail);
    group.add(g);
    boats.push({ obj: g, x: -900 + i * 330, z: COAST_Z + 250 + (i % 3) * 120, speed: 6 + i });
  }

  function update(dt, t) {
    for (const s of spinners) s.userData.spin(t);
    for (const b of balloons) {
      b.x += dt * 3;
      if (b.x > WORLD_RADIUS) b.x = -WORLD_RADIUS;
      b.obj.position.set(b.x, b.alt + Math.sin(t * 0.3 + b.phase) * 12, b.z);
      b.obj.rotation.y = t * 0.05 + b.phase;
    }
    for (const p of planes) {
      const x = ((t * p.speed + p.off) % 3600) - 1800;
      p.obj.position.set(x, p.alt, p.lane);
      p.obj.rotation.y = -Math.PI / 2;
    }
    for (const b of boats) {
      b.x += dt * b.speed;
      if (b.x > 1500) b.x = -1500;
      b.obj.position.set(b.x, 1 + Math.sin(t * 2 + b.speed) * 0.3, b.z);
      b.obj.rotation.set(Math.sin(t + b.speed) * 0.05, -Math.PI / 2, 0);
    }
  }

  return finishWorld({
    id: 'modern',
    group,
    heightAt,
    waterLevel: 0,
    solids,
    sky: { top: 0x3d7fd6, bottom: 0xc4e6f7, sun: 0xfffbe0, sunDir: v3(0.3, 0.7, -1) },
    fog: { color: 0xc8e2f0, near: 260, far: 1800 },
    light: { sky: 0xeaf6ff, ground: 0x5a6a4a, sun: 0xffffff },
    cloudColor: 0xffffff,
    thermals: [
      { x: 0, z: -450, r: 60, top: 640 },
      { x: -700, z: 300, r: 45, top: 520 },
      { x: 700, z: 200, r: 50, top: 560 },
      { x: 300, z: -1100, r: 45, top: 560 },
    ],
    start: { x: 0, y: 260, z: 400, yaw: 0 },
    update,
  });
}
