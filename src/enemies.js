import * as THREE from 'three';
import { glow, limb, mat, v3 } from './worlds/common.js';

// Procedural enemy models. Each faces +Z (so Object3D.lookAt points its nose
// along its flight direction) and carries userData.animate(t) for wings and
// rotors. Every model is at least ~8 m across so it survives the pixel pass.

function tri(points, material) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  return m;
}

// Pair of flapping wings built from a mirrored triangle fan.
function flappingWings(g, points, material, { y = 0, z = 0, rate = 4, amp = 0.5 } = {}) {
  const wings = [];
  for (const side of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0, y, z);
    const mirrored = points.map((p, i) => (i % 3 === 0 ? p * side : p));
    pivot.add(tri(mirrored, material));
    g.add(pivot);
    wings.push({ pivot, side });
  }
  return (t, phase) => wings.forEach((w) => (w.pivot.rotation.z = Math.sin(t * rate + phase) * amp * w.side));
}

function eyes(g, color, x, y, z, s = 0.5) {
  for (const side of [-1, 1]) g.add(box(s, s, s, glow(color), side * x, y, z));
}

// ---------- Dinosaur Days ----------

// Bigger and darker than the ambient flocks, with glowing red eyes.
function pterosaur() {
  const g = new THREE.Group();
  const skin = mat(0x4b2a6b, { side: THREE.DoubleSide });
  g.add(limb(v3(0, 0, -4), v3(0, 0, 3), 0.9, 0.5, skin, 4));
  const crest = new THREE.Mesh(new THREE.ConeGeometry(0.6, 4, 3), mat(0xc2402a));
  crest.rotation.x = Math.PI / 2;
  crest.position.set(0, 0.5, 5);
  g.add(crest);
  eyes(g, 0xff2a2a, 0.5, 0.4, 3.4, 0.45);
  const flap = flappingWings(g, [0, 0, 1.5, 12, 0, -0.5, 0, 0, -2.5], skin, { rate: 5, amp: 0.55 });
  g.userData.animate = (t, phase) => flap(t, phase);
  return g;
}

function wyvern() {
  const g = new THREE.Group();
  const scales = mat(0x7a1f1f);
  const membrane = mat(0x2b1a1a, { side: THREE.DoubleSide });
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.2, 8, 6), scales);
  torso.rotation.x = Math.PI / 2;
  g.add(torso);
  g.add(limb(v3(0, 0.5, 3.5), v3(0, 2, 7), 1, 0.7, scales, 5));
  g.add(box(1.6, 1.2, 2.6, scales, 0, 2.2, 8));
  eyes(g, 0xffb000, 0.75, 2.5, 8.8, 0.4);
  g.add(limb(v3(0, 0, -4), v3(0, 0.4, -12), 1, 0.15, scales, 4));
  const flap = flappingWings(g, [0, 0, 2.5, 13, 1, -1, 7, 0, -3.5, 0, 0, 2.5, 7, 0, -3.5, 0, 0, -2], membrane, { y: 1, z: 0.5, rate: 3.5, amp: 0.5 });
  g.userData.animate = (t, phase) => flap(t, phase);
  return g;
}

function dragonfly() {
  const g = new THREE.Group();
  const shell = mat(0x1f7a5a);
  const wing = mat(0xbfe9ff, { side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
  g.add(limb(v3(0, 0, -7), v3(0, 0, 3), 0.35, 0.8, shell, 5));
  g.add(box(1.8, 1.4, 1.6, shell, 0, 0, 3.8));
  eyes(g, 0x7dff4a, 0.8, 0.3, 4.4, 0.7);
  const front = flappingWings(g, [0, 0, 0.6, 7, 0, 1.2, 7, 0, -0.2], wing, { z: 1.5, rate: 30, amp: 0.35 });
  const back = flappingWings(g, [0, 0, -0.4, 6, 0, -0.2, 6, 0, -1.4], wing, { z: 0, rate: 30, amp: 0.35 });
  g.userData.animate = (t, phase) => {
    front(t, phase);
    back(t, phase + 1.5);
  };
  return g;
}

// ---------- Ancient China ----------

// A serpentine lung dragon: a chain of segments that ripples as it swims.
function lung() {
  const g = new THREE.Group();
  const scales = mat(0xd9a520);
  const belly = mat(0xc4302b);
  const head = new THREE.Group();
  head.position.z = 4;
  head.add(box(2.4, 1.8, 3.2, scales));
  head.add(box(1.8, 0.7, 2.2, belly, 0, -0.8, 0.8));
  for (const side of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.25, 2.4, 4), mat(0xf2ead3));
    horn.position.set(side * 0.7, 1.4, -0.8);
    horn.rotation.x = -0.9;
    head.add(horn);
    head.add(limb(v3(side * 0.9, -0.3, 1.6), v3(side * 3, -0.8, 3.5), 0.12, 0.06, mat(0xf2ead3), 3));
  }
  eyes(head, 0x4affd0, 0.9, 0.5, 1.2, 0.45);
  g.add(head);
  const segs = [];
  for (let i = 0; i < 9; i++) {
    const r = 1.2 - i * 0.09;
    const s = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 2.4, 6), i % 2 ? scales : belly);
    s.rotation.x = Math.PI / 2;
    s.position.z = 1.8 - i * 2.2;
    g.add(s);
    segs.push(s);
  }
  g.userData.animate = (t, phase) => {
    segs.forEach((s, i) => {
      s.position.x = Math.sin(t * 4 + phase - i * 0.7) * (0.4 + i * 0.25);
      s.position.y = Math.cos(t * 3 + phase - i * 0.6) * 0.5;
    });
  };
  return g;
}

function crane() {
  const g = new THREE.Group();
  const white = mat(0xf4f1ea, { side: THREE.DoubleSide });
  const black = mat(0x1d1d1d, { side: THREE.DoubleSide });
  g.add(limb(v3(0, 0, -3), v3(0, 0, 2.5), 1, 0.6, white, 5));
  g.add(limb(v3(0, 0.3, 2.5), v3(0, 0.8, 7), 0.35, 0.25, white, 4));
  g.add(box(0.7, 0.7, 1, white, 0, 0.9, 7.3));
  g.add(box(0.5, 0.25, 0.5, glow(0xff2020), 0, 1.3, 7.3));
  g.add(limb(v3(0, 0.8, 7.8), v3(0, 0.6, 9.6), 0.18, 0.05, mat(0x6b6b52), 3));
  for (const side of [-1, 1]) g.add(limb(v3(side * 0.4, -0.5, -2.5), v3(side * 0.4, -0.6, -8), 0.12, 0.08, black, 3));
  const flap = flappingWings(g, [0, 0, 1.5, 7, 0, 0.5, 0, 0, -1.5, 7, 0, 0.5, 11, 0, -0.5, 6, 0, -1.5], white, { y: 0.3, rate: 4, amp: 0.6 });
  // Black wingtips on top of the white wings.
  const tips = flappingWings(g, [9, 0.05, 0, 11, 0.05, -0.5, 8, 0.05, -1.2], black, { y: 0.3, rate: 4, amp: 0.6 });
  g.userData.animate = (t, phase) => {
    flap(t, phase);
    tips(t, phase);
  };
  return g;
}

function kite() {
  const g = new THREE.Group();
  const sail = mat(0xd62828, { side: THREE.DoubleSide });
  const face = mat(0xffd166, { side: THREE.DoubleSide });
  // Diamond sail standing upright, facing forward.
  g.add(tri([0, 6, 0, -5, 0, 0, 0, -6, 0, 0, 6, 0, 0, -6, 0, 5, 0, 0], sail));
  g.add(tri([0, 3, 0.1, -2.5, 0, 0.1, 0, -3, 0.1, 0, 3, 0.1, 0, -3, 0.1, 2.5, 0, 0.1], face));
  eyes(g, 0x111111, 1, 1, 0.3, 0.7);
  const frame = mat(0x6b4a2b);
  g.add(limb(v3(0, -6, -0.2), v3(0, 6, -0.2), 0.12, 0.12, frame, 3));
  g.add(limb(v3(-5, 0, -0.2), v3(5, 0, -0.2), 0.12, 0.12, frame, 3));
  const tail = [];
  for (let i = 0; i < 5; i++) {
    const bow = box(1.6, 0.5, 0.2, i % 2 ? face : sail, 0, -7 - i * 1.8, -0.5);
    g.add(bow);
    tail.push(bow);
  }
  g.userData.animate = (t, phase) => tail.forEach((b, i) => (b.position.x = Math.sin(t * 5 + phase - i) * 0.8 * (i + 1) * 0.4));
  return g;
}

// ---------- Current Day ----------

function jet() {
  const g = new THREE.Group();
  const hull = mat(0x6f7c8a);
  const dark = mat(0x3c4550);
  g.add(limb(v3(0, 0, -8), v3(0, 0, 7), 1.4, 1.1, hull, 6));
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.1, 3.5, 6), hull);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 8.7;
  g.add(nose);
  g.add(box(1.1, 0.8, 3, glow(0x9fd8ff), 0, 1.1, 4));
  g.add(tri([0, 0, 4, 9, 0, -4, 0, 0, -5, 0, 0, 4, 0, 0, -5, -9, 0, -4], mat(0x6f7c8a, { side: THREE.DoubleSide })));
  g.add(tri([0, 0, -4, 0, 4.5, -8, 0, 0, -8], mat(0x3c4550, { side: THREE.DoubleSide })));
  g.add(tri([0, 0, -6, 3.5, 0, -8.5, 0, 0, -8.5, 0, 0, -6, 0, 0, -8.5, -3.5, 0, -8.5], mat(0x3c4550, { side: THREE.DoubleSide })));
  const burner = box(1.6, 1.6, 0.6, glow(0xff7b1c), 0, 0, -8.3);
  g.add(burner, box(0.5, 0.5, 0.5, dark, 0, -1.2, 2));
  g.userData.animate = (t) => burner.scale.setScalar(0.85 + Math.sin(t * 40) * 0.15);
  return g;
}

function helicopter() {
  const g = new THREE.Group();
  const paint = mat(0x3e5a2e);
  g.add(box(3.4, 3.2, 6, paint, 0, 0, 0.5));
  g.add(box(2.8, 2, 2, glow(0x9fd8ff), 0, 0.4, 3.8));
  g.add(limb(v3(0, 0.6, -2.4), v3(0, 1.2, -10), 0.8, 0.35, paint, 5));
  g.add(box(0.3, 2.4, 1.4, paint, 0, 2.2, -9.8));
  for (const side of [-1, 1]) g.add(limb(v3(side * 1.6, -2.3, -2), v3(side * 1.6, -2.3, 3.5), 0.15, 0.15, mat(0x222222), 3));
  const rotor = new THREE.Group();
  rotor.position.set(0, 2.2, 0.5);
  rotor.add(box(18, 0.15, 0.8, mat(0x222222)), box(0.8, 0.15, 18, mat(0x222222)));
  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.5, 1.3, -10);
  tailRotor.add(box(0.15, 4, 0.5, mat(0x222222)));
  g.add(rotor, tailRotor, box(0.5, 0.5, 0.5, glow(0xff2a2a), 0, -1.7, 3.6));
  g.userData.animate = (t) => {
    rotor.rotation.y = t * 25;
    tailRotor.rotation.x = t * 35;
  };
  return g;
}

function drone() {
  const g = new THREE.Group();
  const body = mat(0x2a2d33);
  g.add(box(3, 1.2, 3, body));
  g.add(box(0.8, 0.8, 0.5, glow(0xff2a2a), 0, 0, 1.6));
  const props = [];
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    g.add(limb(v3(0, 0, 0), v3(x * 3.5, 0.3, z * 3.5), 0.25, 0.25, body, 4));
    const p = box(3.4, 0.1, 0.5, mat(0xd8d8d8), x * 3.5, 0.8, z * 3.5);
    g.add(p);
    props.push(p);
    g.add(box(0.4, 0.4, 0.4, glow(z > 0 ? 0x4aff6a : 0xff3b3b), x * 3.5, 0.1, z * 3.5));
  }
  g.userData.animate = (t, phase) => {
    props.forEach((p, i) => (p.rotation.y = t * 40 + i));
    g.children[0].rotation.z = Math.sin(t * 2 + phase) * 0.08;
  };
  return g;
}

function gull() {
  const g = new THREE.Group();
  const white = mat(0xf7f7f2, { side: THREE.DoubleSide });
  const grey = mat(0x8e9aa6, { side: THREE.DoubleSide });
  g.add(limb(v3(0, 0, -3), v3(0, 0, 2.5), 0.9, 0.6, white, 5));
  g.add(box(1.1, 1.1, 1.2, white, 0, 0.3, 3));
  g.add(box(0.35, 0.35, 1.2, mat(0xffc21c), 0, 0.1, 4.1));
  eyes(g, 0x111111, 0.5, 0.55, 3.3, 0.25);
  g.add(tri([0, 0, -2.5, 1.5, 0, -4, -1.5, 0, -4], white));
  const flap = flappingWings(g, [0, 0, 1.2, 5, 0.6, 0, 0, 0, -1.2, 5, 0.6, 0, 9, -0.6, -1.2, 0, 0, -1.2], grey, { y: 0.4, rate: 5.5, amp: 0.55 });
  g.userData.animate = (t, phase) => flap(t, phase);
  return g;
}

// Drawn a bit larger than the hit spheres so they read at range through the
// pixel pass; aim assist covers the difference.
const MODEL_SCALE = 1.5;

const BUILDERS = { pterosaur, wyvern, dragonfly, lung, crane, kite, jet, helicopter, drone, gull };

function dispose(obj) {
  obj.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });
}

function projectilePool(count, geometry, material) {
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;
  mesh.count = 0;
  return mesh;
}

// Mirrors Combat state into the scene: one mesh per live enemy, plus instanced
// fireballs and enemy shots. Lives under its own root, outside the per-world
// group, so world switches never dispose it.
export class EnemyView {
  constructor(scene) {
    this.root = new THREE.Group();
    scene.add(this.root);
    this.meshes = new Map();
    this.fire = projectilePool(40, new THREE.IcosahedronGeometry(1.5, 0), glow(0xff8a1c));
    this.fireCore = projectilePool(40, new THREE.IcosahedronGeometry(0.8, 0), glow(0xffe680));
    this.returns = projectilePool(40, new THREE.OctahedronGeometry(2.4, 0), glow(0x4ad7ff));
    this.shots = projectilePool(24, new THREE.OctahedronGeometry(1.8, 0), glow(0xff2a6b));
    this.root.add(this.fire, this.fireCore, this.returns, this.shots);
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.s = new THREE.Vector3();
    this.target = new THREE.Vector3();
  }

  placeAll(pool, items, scale, spin) {
    items.forEach((p, i) => {
      this.q.setFromAxisAngle(this.s.set(0.3, 1, 0.2).normalize(), spin + i);
      this.m.compose(p.pos, this.q, this.s.setScalar(scale));
      pool.setMatrixAt(i, this.m);
    });
    pool.count = items.length;
    pool.instanceMatrix.needsUpdate = true;
  }

  sync(combat, t) {
    const live = new Set();
    for (const e of combat.enemies) {
      live.add(e.id);
      let mesh = this.meshes.get(e.id);
      if (!mesh) {
        mesh = BUILDERS[e.type.id]();
        mesh.scale.setScalar(MODEL_SCALE);
        mesh.userData.phase = e.id * 1.7;
        this.meshes.set(e.id, mesh);
        this.root.add(mesh);
      }
      mesh.position.copy(e.pos);
      mesh.lookAt(this.target.copy(e.pos).add(e.dir));
      mesh.userData.animate?.(t, mesh.userData.phase);
      // Blink when singed by fire.
      mesh.visible = e.flash <= 0 || Math.floor(t * 30) % 2 === 0;
    }
    for (const [id, mesh] of this.meshes) {
      if (live.has(id)) continue;
      this.root.remove(mesh);
      dispose(mesh);
      this.meshes.delete(id);
    }
    this.placeAll(this.fire, combat.fireballs.filter((f) => !f.reflected), 1, t * 9);
    this.placeAll(this.returns, combat.fireballs.filter((f) => f.reflected), 1, t * 12);
    this.placeAll(this.fireCore, combat.fireballs, 1, -t * 7);
    this.placeAll(this.shots, combat.shots, 1, t * 6);
  }
}
