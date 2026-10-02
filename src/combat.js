import * as THREE from 'three';
import { ENEMY_TYPES } from './enemyTypes.js';
import { WORLD_RADIUS } from './worlds/common.js';

const FIRE_RATE = 8; // fireballs per second while the left mouse button is held
const FIREBALL_SPEED = 320; // on top of the dragon's own speed
const FIREBALL_LIFE = 1.5;
const FIREBALL_RADIUS = 2;
const MAX_FIREBALLS = 40;
const ASSIST_CONE = Math.cos((6 * Math.PI) / 180); // fire bends onto enemies this close to the aim line
const ASSIST_RANGE = 700;

export const MAX_HEALTH = 100;
const PLAYER_RADIUS = 6;
const SHOT_SPEED = 230;
const SHOT_DAMAGE = 8;
const SHOT_RADIUS = 2.5;
const SHOT_LIFE = 3;
const SHOT_RANGE = 450;
const SHOT_CONE = Math.cos((35 * Math.PI) / 180);
const MAX_SHOTS = 24;
const BREAKOFF_RANGE = 150; // shooters stop homing this close and fly past
const BREAKOFF_TIME = 2;
const FLOOR_MARGIN = 15;
const INVULNERABLE = 1; // seconds of mercy after each hit

const MAX_ENEMIES = 6;
const SPAWN_GRACE = 3; // quiet seconds at the start of a run
const SPAWN_INTERVAL = 1.6;
const SPAWN_MIN = 350;
const SPAWN_MAX = 650;
const SPAWN_ARC = 1.2; // radians either side of the dragon's heading
const DESPAWN_DIST = 1100;
const DESPAWN_EDGE = WORLD_RADIUS * 1.15;

const tmp = new THREE.Vector3();
let nextId = 1; // never reused, even across resets, so views can key meshes by id

// Closest distance from point p to the segment a→b.
function segmentDistance(a, b, p) {
  const ab = tmp.subVectors(b, a);
  const len2 = ab.lengthSq();
  const t = len2 ? Math.min(1, Math.max(0, ab.dot(new THREE.Vector3().subVectors(p, a)) / len2)) : 0;
  return new THREE.Vector3().copy(a).addScaledVector(ab, t).distanceTo(p);
}

// All of the shooting game: the dragon's fire, enemies, their shots and the
// dragon's health. No rendering here; main.js mirrors this state into meshes.
export class Combat {
  constructor({ roster, rng = Math.random, floorAt = () => -Infinity }) {
    this.roster = roster;
    this.rng = rng;
    this.floorAt = floorAt;
    this.reset();
  }

  reset() {
    this.enemies = [];
    this.fireballs = [];
    this.shots = [];
    this.health = MAX_HEALTH;
    this.maxHealth = MAX_HEALTH;
    this.deathReported = false;
    this.invulnerable = 0;
    this.cooldown = 0;
    this.spawnTimer = SPAWN_GRACE;
  }

  spawn(typeId, pos) {
    const type = { id: typeId, ...ENEMY_TYPES[typeId] };
    const enemy = {
      id: nextId++,
      type,
      pos: pos.clone(),
      dir: new THREE.Vector3(0, 0, 1),
      hp: type.hp,
      flash: 0,
      breakoff: 0,
      fireTimer: type.shoots * (0.4 + this.rng() * 0.3),
    };
    this.enemies.push(enemy);
    return enemy;
  }

  // A random enemy from this world, somewhere ahead of the dragon and
  // heading toward it.
  spawnNear(pos, forward) {
    const type = this.roster[Math.floor(this.rng() * this.roster.length)];
    const heading = Math.atan2(forward.x, forward.z) + (this.rng() * 2 - 1) * SPAWN_ARC;
    const flat = SPAWN_MIN + this.rng() * (SPAWN_MAX - SPAWN_MIN - 60);
    const at = new THREE.Vector3(pos.x + Math.sin(heading) * flat, pos.y + (this.rng() * 2 - 1) * 60, pos.z + Math.cos(heading) * flat);
    at.y = Math.max(at.y, this.floorAt(at.x, at.z) + FLOOR_MARGIN + 20);
    const enemy = this.spawn(type.id, at);
    enemy.dir.subVectors(pos, at).normalize();
    return enemy;
  }

  // The aim line, nudged onto the enemy nearest to it if one is inside the
  // assist cone. Aiming in 3D at small pixelated targets is hard otherwise.
  assistedAim(from, forward) {
    const aim = forward.clone().normalize();
    let best = ASSIST_CONE;
    const to = new THREE.Vector3();
    for (const e of this.enemies) {
      to.subVectors(e.pos, from);
      const d = to.length();
      if (d > ASSIST_RANGE) continue;
      const dot = to.divideScalar(d || 1).dot(forward);
      if (dot > best) {
        best = dot;
        aim.copy(to);
      }
    }
    return aim;
  }

  // Direct damage (also the debug hook).
  damage(n) {
    this.health = Math.max(0, this.health - n);
  }

  hurt(n, events) {
    if (this.health <= 0 || this.invulnerable > 0) return;
    this.invulnerable = INVULNERABLE;
    this.damage(n);
    events.damage += n;
    events.hit = true;
  }

  // Steps the fight one frame. `active` is false in the menu and on the
  // game-over screen, where everything holds still.
  update(dt, { pos, forward, speed = 0, muzzle = pos, firing = false, active = true }) {
    const events = { kills: [], damage: 0, hit: false, dead: false };
    if (!active) return events;
    this.invulnerable -= dt;

    this.cooldown -= dt;
    if (firing && this.cooldown <= 0) {
      this.cooldown = 1 / FIRE_RATE;
      if (this.fireballs.length >= MAX_FIREBALLS) this.fireballs.shift();
      const aim = this.assistedAim(muzzle, forward);
      this.fireballs.push({ pos: muzzle.clone(), prev: muzzle.clone(), vel: aim.multiplyScalar(FIREBALL_SPEED + speed), life: FIREBALL_LIFE });
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.enemies.length < MAX_ENEMIES) {
      this.spawnTimer = SPAWN_INTERVAL;
      this.spawnNear(pos, forward);
    }

    const toPlayer = new THREE.Vector3();
    for (const e of this.enemies) {
      e.flash = Math.max(0, e.flash - dt);
      toPlayer.subVectors(pos, e.pos);
      const dist = toPlayer.length();
      toPlayer.divideScalar(dist || 1);

      // Home in on the dragon at a limited turn rate. Shooters break off when
      // close so they make passes instead of sitting on the dragon's nose.
      e.breakoff -= dt;
      if (e.type.shoots && dist < BREAKOFF_RANGE && e.breakoff < -BREAKOFF_TIME) e.breakoff = BREAKOFF_TIME;
      if (e.breakoff <= 0) {
        const angle = Math.acos(Math.min(1, Math.max(-1, e.dir.dot(toPlayer))));
        const step = e.type.turn * dt;
        e.dir.lerp(toPlayer, angle > step ? step / angle : 1).normalize();
      }
      e.pos.addScaledVector(e.dir, e.type.speed * dt);
      e.pos.y = Math.max(e.pos.y, this.floorAt(e.pos.x, e.pos.z) + FLOOR_MARGIN);

      if (e.type.shoots) {
        e.fireTimer -= dt;
        if (e.fireTimer <= 0 && dist < SHOT_RANGE && e.dir.dot(toPlayer) > SHOT_CONE) {
          e.fireTimer = e.type.shoots;
          if (this.shots.length >= MAX_SHOTS) this.shots.shift();
          this.shots.push({ pos: e.pos.clone(), prev: e.pos.clone(), vel: toPlayer.clone().multiplyScalar(SHOT_SPEED), life: SHOT_LIFE });
        }
      }

      if (e.pos.distanceTo(pos) < e.type.radius + PLAYER_RADIUS) {
        e.hp = 0;
        this.hurt(e.type.ram, events);
      }
    }

    this.shots = this.shots.filter((s) => {
      s.life -= dt;
      s.prev.copy(s.pos);
      s.pos.addScaledVector(s.vel, dt);
      if (segmentDistance(s.prev, s.pos, pos) < PLAYER_RADIUS + SHOT_RADIUS) {
        this.hurt(SHOT_DAMAGE, events);
        return false;
      }
      return s.life > 0;
    });

    this.fireballs = this.fireballs.filter((f) => {
      f.life -= dt;
      f.prev.copy(f.pos);
      f.pos.addScaledVector(f.vel, dt);
      for (const e of this.enemies) {
        if (e.hp <= 0 || segmentDistance(f.prev, f.pos, e.pos) > e.type.radius + FIREBALL_RADIUS) continue;
        e.hp -= 1;
        e.flash = 0.15;
        if (e.hp <= 0) events.kills.push({ pos: e.pos.clone(), points: e.type.points, label: e.type.name, type: e.type.id });
        return false;
      }
      return f.life > 0;
    });
    this.enemies = this.enemies.filter((e) => e.hp > 0 && e.pos.distanceTo(pos) < DESPAWN_DIST && Math.hypot(e.pos.x, e.pos.z) < DESPAWN_EDGE);

    if (this.health <= 0 && !this.deathReported) {
      this.deathReported = true;
      events.dead = true;
    }

    return events;
  }
}
