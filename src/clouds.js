import * as THREE from 'three';
import { mulberry32 } from './noise.js';
import { WORLD_RADIUS } from './worlds/common.js';

// Puffy low-poly clouds the dragon can fly straight through. density()
// reports how deep inside a cloud a point is so the screen can white out.
export class Clouds {
  constructor(world, { count = 70, color = 0xffffff, seed = 3 } = {}) {
    const rng = mulberry32(seed);
    this.group = new THREE.Group();
    this.items = [];
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const material = new THREE.MeshLambertMaterial({ color, flatShading: true, emissive: color, emissiveIntensity: 0.5 });
    for (let i = 0; i < count; i++) {
      const cloud = new THREE.Group();
      const a = rng() * Math.PI * 2;
      const d = Math.sqrt(rng()) * WORLD_RADIUS * 1.1;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      const y = Math.max(world.groundAt(x, z) + 80, 170 + rng() * 300);
      cloud.position.set(x, y, z);
      const size = 18 + rng() * 22;
      const puffs = 4 + Math.floor(rng() * 5);
      for (let p = 0; p < puffs; p++) {
        const m = new THREE.Mesh(geo, material);
        const s = size * (0.6 + rng() * 0.6);
        m.scale.set(s * 1.3, s * 0.8, s);
        m.position.set((p - puffs / 2) * size * 0.7, (rng() - 0.5) * size * 0.4, (rng() - 0.5) * size * 1.2);
        m.rotation.set(rng() * 3, rng() * 3, 0);
        cloud.add(m);
      }
      this.group.add(cloud);
      this.items.push({ obj: cloud, radius: size * (puffs * 0.4 + 0.6) });
    }
  }

  update(dt) {
    for (const c of this.items) {
      c.obj.position.x += dt * 4;
      if (c.obj.position.x > WORLD_RADIUS * 1.2) c.obj.position.x = -WORLD_RADIUS * 1.2;
    }
  }

  density(p) {
    let best = 0;
    for (const c of this.items) {
      const o = c.obj.position;
      const dx = (p.x - o.x) / c.radius;
      const dy = (p.y - o.y) / (c.radius * 0.45);
      const dz = (p.z - o.z) / (c.radius * 0.55);
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < 1) best = Math.max(best, 1 - d);
    }
    return Math.min(1, best * 2.2);
  }
}
