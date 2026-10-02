import * as THREE from 'three';

export const WORLD_SIZE = 4200;
export const WORLD_RADIUS = 1600;

const UP = new THREE.Vector3(0, 1, 0);

export function mat(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, flatShading: true, ...opts });
}

export function glow(color, opts = {}) {
  return new THREE.MeshBasicMaterial({ color, ...opts });
}

// A tapered cylinder spanning two points: used for necks, legs, tails, towers.
export function limb(a, b, r1, r2, material, sides = 5) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, len, sides), material);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
  return mesh;
}

export function v3(x, y, z) {
  return new THREE.Vector3(x, y, z);
}

// Flat-shaded heightfield where each triangle gets one colour, which is what
// gives the terrain its chunky, cartridge-era look.
export function makeTerrain(heightAt, colorAt, { size = WORLD_SIZE, segments = 180 } = {}) {
  const base = new THREE.PlaneGeometry(size, size, segments, segments);
  base.rotateX(-Math.PI / 2);
  const geo = base.toNonIndexed();
  base.dispose();
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  }
  const colors = new Float32Array(pos.count * 3);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const col = new THREE.Color();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    n.subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b)).normalize();
    const cx = (a.x + b.x + c.x) / 3;
    const cy = (a.y + b.y + c.y) / 3;
    const cz = (a.z + b.z + c.z) / 3;
    colorAt(col, cx, cy, cz, Math.abs(n.y));
    for (let k = 0; k < 3; k++) {
      colors[(i + k) * 3] = col.r;
      colors[(i + k) * 3 + 1] = col.g;
      colors[(i + k) * 3 + 2] = col.b;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
}

export function makeWater(level, color, size = WORLD_SIZE * 1.6) {
  const geo = new THREE.PlaneGeometry(size, size, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat(color));
  mesh.position.y = level;
  return mesh;
}

// Instanced copies of one mesh, from a list of {x, y, z, s, sy, ry} transforms.
export function instanced(geometry, material, transforms) {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, transforms.length));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  transforms.forEach((t, i) => {
    e.set(t.rx || 0, t.ry || 0, t.rz || 0);
    q.setFromEuler(e);
    p.set(t.x, t.y, t.z);
    s.set(t.sx ?? t.s ?? 1, t.sy ?? t.s ?? 1, t.sz ?? t.s ?? 1);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
  });
  mesh.count = transforms.length;
  return mesh;
}

export function slopeAt(heightAt, x, z, d = 6) {
  const dx = heightAt(x + d, z) - heightAt(x - d, z);
  const dz = heightAt(x, z + d) - heightAt(x, z - d);
  return Math.hypot(dx, dz) / (2 * d);
}

// Solids are things the dragon can't fly through (pillars, towers, buildings).
// Cylinders: {type:'cyl', x, z, r, top}. Boxes: {type:'box', minX, maxX, minZ, maxZ, top}.
export function solidTopAt(solids, x, z) {
  let top = -Infinity;
  for (const s of solids) {
    if (s.type === 'cyl') {
      if ((x - s.x) ** 2 + (z - s.z) ** 2 < s.r * s.r) top = Math.max(top, s.top);
    } else if (x > s.minX && x < s.maxX && z > s.minZ && z < s.maxZ) {
      top = Math.max(top, s.top);
    }
  }
  return top;
}

// Builds the shared world object every world module returns.
export function finishWorld(def) {
  const solids = def.solids || [];
  const groundAt = (x, z) => Math.max(def.heightAt(x, z), def.waterLevel);
  return {
    thermals: [],
    pickups: null,
    update() {},
    ...def,
    solids,
    groundAt,
    floorAt: (x, z) => Math.max(groundAt(x, z), solidTopAt(solids, x, z)),
  };
}
