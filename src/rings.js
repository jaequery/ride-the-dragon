import * as THREE from 'three';
import { WORLD_RADIUS } from './worlds/common.js';

const RADIUS = 12;

// Golden rings to fly through. Collected rings respawn somewhere ahead of
// the player, so there is always something to chase.
export class Rings {
  constructor(world, flight, count = 12) {
    this.world = world;
    this.group = new THREE.Group();
    this.items = [];
    this.geo = new THREE.TorusGeometry(RADIUS, 1.6, 5, 14);
    this.material = new THREE.MeshLambertMaterial({ color: 0xffc928, emissive: 0x8a5a00, flatShading: true });
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.geo, this.material);
      this.group.add(mesh);
      const item = { mesh, phase: Math.random() * 6 };
      this.place(item, flight.pos, Math.random() * Math.PI * 2, 120 + Math.random() * 800);
      this.items.push(item);
    }
  }

  place(item, from, angle, dist) {
    let x = from.x - Math.sin(angle) * dist;
    let z = from.z - Math.cos(angle) * dist;
    const r = Math.hypot(x, z);
    if (r > WORLD_RADIUS * 0.9) {
      x *= (WORLD_RADIUS * 0.9) / r;
      z *= (WORLD_RADIUS * 0.9) / r;
    }
    const floor = this.world.floorAt(x, z);
    const y = Math.min(680, floor + 35 + Math.random() * 220);
    item.baseY = y;
    item.mesh.position.set(x, y, z);
    item.mesh.rotation.set(0, angle, 0);
  }

  // Returns the positions of rings collected this frame.
  update(dt, t, flight) {
    const hits = [];
    for (const item of this.items) {
      item.mesh.position.y = item.baseY + Math.sin(t * 1.5 + item.phase) * 3;
      item.mesh.rotation.z = t * 0.6 + item.phase;
      if (item.mesh.position.distanceTo(flight.pos) < RADIUS + 2) {
        hits.push(item.mesh.position.clone());
        this.place(item, flight.pos, flight.yaw + (Math.random() - 0.5) * 2.2, 300 + Math.random() * 600);
      }
    }
    return hits;
  }

  nearest(p) {
    let best = null;
    let bestD = Infinity;
    for (const item of this.items) {
      const d = item.mesh.position.distanceTo(p);
      if (d < bestD) {
        bestD = d;
        best = item.mesh.position;
      }
    }
    return { position: best, distance: bestD };
  }
}
