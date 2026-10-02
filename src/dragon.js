import * as THREE from 'three';
import { glow, limb, mat, v3 } from './worlds/common.js';

// A procedural, low-poly dragon with a rider on its shoulders. The dragon
// faces -Z with +Y up, so the flight model can rotate it directly.
export function createDragon() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const scales = mat(0x3fa34d);
  const darkScales = mat(0x2c6e36);
  const belly = mat(0xe8d27a);
  const membrane = mat(0xc4503f, { side: THREE.DoubleSide });
  const horn = mat(0xf2ead3);
  const eye = glow(0xffe14d);

  // Torso: thick at the chest, tapering toward the hips.
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.8, 9, 6), scales);
  torso.rotation.x = Math.PI / 2;
  body.add(torso);
  const bellyPlate = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 7.5), belly);
  bellyPlate.position.set(0, -1.3, -0.3);
  body.add(bellyPlate);

  // Back spikes.
  const spikeGeo = new THREE.ConeGeometry(0.35, 1.0, 4);
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(spikeGeo, horn);
    s.position.set(0, 1.6 - i * 0.05, -0.5 + i * 1.3);
    s.rotation.x = 0.4;
    body.add(s);
  }

  // Neck and head.
  const neckBase = v3(0, 0.9, -4.2);
  const headBase = v3(0, 2.5, -8.6);
  body.add(limb(neckBase, headBase, 1.2, 0.75, scales, 6));
  const head = new THREE.Group();
  head.position.copy(headBase);
  body.add(head);
  const skull = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.3, 2.0), scales);
  head.add(skull);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.8), scales);
  snout.position.set(0, -0.15, -1.7);
  head.add(snout);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.35, 1.6), belly);
  jaw.position.set(0, -0.65, -1.4);
  head.add(jaw);
  for (const side of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.6, 4), horn);
    h.position.set(side * 0.55, 0.9, 0.7);
    h.rotation.x = 1.0;
    head.add(h);
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.3), eye);
    e.position.set(side * 0.82, 0.25, -0.5);
    head.add(e);
  }

  // Wings: an inner section on a shoulder pivot and an outer section that
  // folds at the elbow. The left wing mirrors the right.
  const wings = [];
  for (const side of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 1.3, 1.0, -1.6);
    const mirror = new THREE.Group();
    mirror.scale.x = side;
    pivot.add(mirror);

    const E = v3(4.6, 0.4, -0.6);
    const innerGeo = new THREE.BufferGeometry();
    innerGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 0, 0, ...E.toArray(), 5, 0, 4.2, 0, 0, 0, 5, 0, 4.2, 0.4, 0, 3.4], 3),
    );
    innerGeo.computeVertexNormals();
    mirror.add(new THREE.Mesh(innerGeo, membrane));
    mirror.add(limb(v3(0, 0, 0), E, 0.35, 0.25, darkScales, 4));

    const outer = new THREE.Group();
    outer.position.copy(E);
    mirror.add(outer);
    const T = v3(7.4, -0.2, 1.4);
    const outerGeo = new THREE.BufferGeometry();
    outerGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 0, 0, ...T.toArray(), 4.4, -0.3, 4.0, 0, 0, 0, 4.4, -0.3, 4.0, 0.4, -0.4, 4.8], 3),
    );
    outerGeo.computeVertexNormals();
    outer.add(new THREE.Mesh(outerGeo, membrane));
    outer.add(limb(v3(0, 0, 0), T, 0.25, 0.1, darkScales, 4));
    body.add(pivot);
    wings.push({ pivot, outer, side });
  }

  // Tucked legs.
  for (const side of [-1, 1]) {
    body.add(limb(v3(side * 1.1, -0.9, -3), v3(side * 1.2, -2.0, -1.8), 0.45, 0.3, darkScales, 4));
    body.add(limb(v3(side * 1.1, -0.8, 3), v3(side * 1.3, -1.9, 4.6), 0.55, 0.3, darkScales, 4));
  }

  // Tail: a chain of segments so it can sway.
  const tail = [];
  let parent = body;
  const radii = [1.2, 0.95, 0.75, 0.55, 0.4, 0.28, 0.18];
  for (let i = 0; i < radii.length - 1; i++) {
    const seg = new THREE.Group();
    seg.position.set(0, i === 0 ? -0.1 : 0, i === 0 ? 4.4 : 1.9);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radii[i + 1], radii[i], 2.0, 5), scales);
    m.rotation.x = Math.PI / 2;
    m.position.z = 1.0;
    seg.add(m);
    parent.add(seg);
    tail.push(seg);
    parent = seg;
  }
  const spade = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.6, 4), membrane);
  spade.rotation.x = Math.PI / 2;
  spade.scale.y = 0.4;
  spade.position.z = 2.6;
  parent.add(spade);

  // Saddle and rider.
  const rider = new THREE.Group();
  rider.position.set(0, 1.6, -2.9);
  body.add(rider);
  const saddle = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 1.6), mat(0x8b2b1f));
  rider.add(saddle);
  const tunic = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.6), mat(0x2f5fbf));
  tunic.position.set(0, 0.8, 0);
  tunic.rotation.x = -0.25;
  rider.add(tunic);
  const riderHead = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.65, 0.65), mat(0xf0c08a));
  riderHead.position.set(0, 1.7, -0.25);
  rider.add(riderHead);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.3, 0.72), mat(0x4a2a14));
  hair.position.set(0, 2.05, -0.2);
  rider.add(hair);
  for (const side of [-1, 1]) {
    rider.add(limb(v3(side * 0.5, 1.2, -0.1), v3(side * 0.35, 0.6, -1.1), 0.15, 0.12, mat(0x2f5fbf), 4));
  }
  const scarf = [];
  let scarfParent = rider;
  for (let i = 0; i < 3; i++) {
    const seg = new THREE.Group();
    seg.position.set(0, i === 0 ? 1.35 : 0, i === 0 ? 0.2 : 0.45);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.45), mat(0xe03a3a, { side: THREE.DoubleSide }));
    m.position.z = 0.22;
    seg.add(m);
    scarfParent.add(seg);
    scarf.push(seg);
    scarfParent = seg;
  }

  let phase = 0;
  function update(dt, t, f) {
    const effort = Math.max(f.boost, Math.max(0, f.climbInput), 0.15);
    const amp = (0.25 + 0.45 * effort) * (1 - f.tuck);
    phase += dt * (2.2 + 3.5 * effort);
    // Upstrokes are capped so a raised wing never fills the rider's view.
    const flap = Math.min(Math.sin(phase) * amp + 0.12 * (1 - f.tuck), 0.32);
    for (const w of wings) {
      w.pivot.rotation.z = flap * w.side;
      w.pivot.rotation.y = -f.tuck * 1.1 * w.side;
      w.outer.rotation.z = Math.min(Math.sin(phase - 0.7) * amp * 0.7, 0.15) - f.tuck * 0.5;
    }
    body.position.y = -Math.sin(phase) * amp * 0.5;
    tail.forEach((seg, i) => {
      seg.rotation.y = Math.sin(t * 1.7 - i * 0.6) * 0.1 - f.turnRate * 0.12;
      seg.rotation.x = Math.sin(t * 1.3 - i * 0.5) * 0.04 + f.pitch * 0.06;
    });
    head.rotation.y = f.turnRate * 0.35;
    head.rotation.x = Math.sin(t * 0.9) * 0.05;
    scarf.forEach((seg, i) => {
      seg.rotation.x = (i === 0 ? -0.5 : 0) + Math.sin(t * (10 + f.speed * 0.05) - i * 1.2) * 0.25;
      seg.rotation.y = Math.sin(t * 7 - i) * 0.2;
    });
  }

  return { root, update };
}
