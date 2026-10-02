import * as THREE from 'three';
import { angleDiff, clamp, damp } from './noise.js';
import { WORLD_RADIUS } from './worlds/common.js';

const CRUISE = 55;
const SOAR = 95; // extra speed while Space is held
const DIVE = 45;
const CEILING = 760;
const ROLL_TIME = 0.75;

// Arcade flight model. Terrain can't hurt the player: hitting the ground or a
// building just bumps the dragon back up. (Enemies can; see combat.js.)
export class Flight {
  constructor() {
    this.pos = new THREE.Vector3();
    this.reset();
  }

  reset(x = 0, y = 200, z = 0, yaw = 0) {
    this.pos.set(x, y, z);
    this.yaw = yaw;
    this.pitch = 0;
    this.bank = 0;
    this.roll = 0;
    this.turnRate = 0;
    this.climbInput = 0;
    this.speed = CRUISE;
    this.boost = 0;
    this.tuck = 0;
    this.rollTimer = 0;
    this.rollDir = 0;
    this.lift = 0;
  }

  get rolling() {
    return this.rollTimer > 0;
  }

  forward(out = new THREE.Vector3()) {
    const cp = Math.cos(this.pitch);
    return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }

  // input: { turn: -1..1 (+ = left), climb: -1..1, soar: bool, dive: bool, roll: -1|0|1 }
  // (Keyboard input also carries fire: bool, which combat.js consumes.)
  update(dt, input, world) {
    const events = { bump: false, updraft: false, turningBack: false, rollStarted: false };

    this.climbInput = input.climb;
    this.turnRate = damp(this.turnRate, input.turn * 1.15, 4, dt);
    this.yaw += this.turnRate * dt;
    this.bank = damp(this.bank, input.turn * 0.7, 4, dt);

    const targetPitch = input.dive ? -0.85 : input.climb * 0.7;
    this.pitch = damp(this.pitch, targetPitch, input.climb || input.dive ? 2.4 : 1.2, dt);
    this.boost = damp(this.boost, input.soar ? 1 : 0, 3, dt);
    this.tuck = damp(this.tuck, input.dive ? 1 : 0, 5, dt);

    const targetSpeed = CRUISE + this.boost * SOAR + this.tuck * DIVE - this.pitch * 22;
    this.speed = damp(this.speed, targetSpeed, 1.4, dt);

    // Barrel roll: a full spin plus a little sideways hop.
    if (input.roll && !this.rolling) {
      this.rollTimer = ROLL_TIME;
      this.rollDir = input.roll;
      events.rollStarted = true;
    }
    if (this.rolling) {
      this.rollTimer = Math.max(0, this.rollTimer - dt);
      const p = 1 - this.rollTimer / ROLL_TIME;
      const eased = p * p * (3 - 2 * p);
      this.roll = eased * Math.PI * 2 * this.rollDir;
      const side = Math.sin(p * Math.PI) * 30 * this.rollDir * dt;
      this.pos.x -= Math.cos(this.yaw) * side;
      this.pos.z += Math.sin(this.yaw) * side;
      if (this.rollTimer === 0) this.roll = 0;
    }

    const fwd = this.forward();
    this.pos.addScaledVector(fwd, this.speed * dt);

    // Updrafts gently lift the dragon.
    let lift = 0;
    for (const th of world.thermals) {
      const d = Math.hypot(this.pos.x - th.x, this.pos.z - th.z);
      if (d < th.r && this.pos.y < th.top) lift = Math.max(lift, (1 - d / th.r) * 70);
    }
    this.lift = damp(this.lift, lift, 3, dt);
    if (this.lift > 1) {
      this.pos.y += this.lift * dt;
      events.updraft = lift > 0;
    }

    // Solid obstacles push the dragon out sideways or up over the top.
    for (const s of world.solids) {
      if (this.pos.y > s.top + 4) continue;
      if (s.type === 'cyl') {
        const dx = this.pos.x - s.x;
        const dz = this.pos.z - s.z;
        const d = Math.hypot(dx, dz);
        const r = s.r + 4;
        if (d < r) {
          if (this.pos.y > s.top - 8) this.pos.y = s.top + 4;
          else {
            this.pos.x = s.x + (dx / (d || 1)) * r;
            this.pos.z = s.z + (dz / (d || 1)) * r;
          }
          events.bump = true;
        }
      } else {
        const m = 4;
        const { x, z } = this.pos;
        if (x > s.minX - m && x < s.maxX + m && z > s.minZ - m && z < s.maxZ + m) {
          if (this.pos.y > s.top - 8) this.pos.y = s.top + 4;
          else {
            const pushes = [
              [s.minX - m - x, 0],
              [s.maxX + m - x, 0],
              [0, s.minZ - m - z],
              [0, s.maxZ + m - z],
            ];
            pushes.sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
            this.pos.x += pushes[0][0];
            this.pos.z += pushes[0][1];
          }
          events.bump = true;
        }
      }
    }

    // Ground and water: skim and bounce up rather than crash.
    const floor = world.groundAt(this.pos.x, this.pos.z) + 7;
    if (this.pos.y < floor) {
      this.pos.y = floor;
      if (this.pitch < 0.1) this.pitch = 0.25;
      events.bump = true;
    }
    if (this.pos.y > CEILING) {
      this.pos.y = CEILING;
      this.pitch = Math.min(this.pitch, 0);
    }

    // Edge of the world: steer back toward the middle.
    const r = Math.hypot(this.pos.x, this.pos.z);
    if (r > WORLD_RADIUS) {
      const home = Math.atan2(this.pos.x, this.pos.z);
      const strength = clamp((r - WORLD_RADIUS) / 150, 0.2, 1);
      this.yaw += angleDiff(this.yaw, home) * strength * 1.8 * dt;
      events.turningBack = true;
    }

    return events;
  }
}

// Keyboard → flight input.
export class Keyboard {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
  }

  has(...codes) {
    return codes.some((c) => this.down.has(c));
  }

  // True once per physical key press.
  took(code) {
    const hit = this.pressed.has(code);
    this.pressed.delete(code);
    return hit;
  }

  endFrame() {
    this.pressed.clear();
  }

  flightInput() {
    const left = this.has('ArrowLeft', 'KeyA');
    const right = this.has('ArrowRight', 'KeyD');
    const up = this.has('ArrowUp', 'KeyW');
    const down = this.has('ArrowDown', 'KeyS');
    let roll = 0;
    if (this.took('KeyQ')) roll = 1;
    if (this.took('KeyE')) roll = -1;
    return {
      turn: (left ? 1 : 0) - (right ? 1 : 0),
      climb: (up ? 1 : 0) - (down ? 1 : 0),
      soar: this.has('KeyX'),
      dive: this.has('ShiftLeft', 'ShiftRight'),
      roll,
      fire: this.has('Space'),
    };
  }
}
