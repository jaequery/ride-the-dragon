import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { Combat } from '../src/combat.js';
import { rosterFor } from '../src/enemyTypes.js';
import { mulberry32 } from '../src/noise.js';

const FORWARD = new THREE.Vector3(0, 0, -1);

function setup(world = 'dino') {
  return new Combat({ roster: rosterFor(world), rng: mulberry32(7), floorAt: () => 0 });
}

function player(over = {}) {
  return { pos: new THREE.Vector3(0, 200, 0), forward: FORWARD.clone(), speed: 55, firing: false, active: true, ...over };
}

// Runs `seconds` of simulation in 1/60 s steps and merges the events.
function run(combat, seconds, input) {
  const all = { kills: [], damage: 0, dead: 0 };
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    const ev = combat.update(1 / 60, typeof input === 'function' ? input() : input);
    all.kills.push(...ev.kills);
    all.damage += ev.damage;
    if (ev.dead) all.dead++;
  }
  return all;
}

test('holding fire breathes a rate-limited stream of fireballs', () => {
  const combat = setup();
  combat.update(1 / 60, player({ firing: true }));
  assert.equal(combat.fireballs.length, 1);
  run(combat, 1, player({ firing: true }));
  // 8 fireballs a second: 1 + 8 (+1 for frame rounding at most).
  assert.ok(combat.fireballs.length >= 8 && combat.fireballs.length <= 10, `got ${combat.fireballs.length}`);
});

test('fireballs that reach an enemy wear it down and kill it', () => {
  const combat = setup();
  const wyvern = combat.spawn('wyvern', new THREE.Vector3(0, 200, -150));
  assert.equal(wyvern.hp, 4);
  const ev = run(combat, 1.5, () => {
    wyvern.pos.set(0, 200, -150); // pin it in the line of fire
    return player({ firing: true });
  });
  assert.equal(ev.kills.length, 1);
  assert.equal(ev.kills[0].points, 300);
  assert.equal(combat.enemies.includes(wyvern), false);
});

test('an enemy that rams the dragon hurts it and is destroyed', () => {
  const combat = setup();
  assert.equal(combat.health, 100);
  const ptero = combat.spawn('pterosaur', new THREE.Vector3(0, 200, -60));
  const ev = run(combat, 1.5, player({ speed: 0 }));
  assert.equal(ev.damage, 15);
  assert.equal(combat.health, 85);
  assert.equal(combat.enemies.includes(ptero), false);
  assert.equal(ev.kills.length, 0, 'a crash is not a kill');
});

test('shooters fire at the dragon from range; rammers never shoot', () => {
  const combat = setup();
  const pinned = new THREE.Vector3(0, 200, -300);
  const wyvern = combat.spawn('wyvern', pinned);
  const ev = run(combat, 3, () => {
    wyvern.pos.copy(pinned); // hover at 300 m, facing the dragon
    return player({ speed: 0 });
  });
  assert.ok(ev.damage >= 8, `took ${ev.damage}`);
  assert.equal(ev.damage % 8, 0, 'damage comes in 8-point shots');

  const calm = setup();
  const ptero = calm.spawn('pterosaur', pinned);
  run(calm, 3, () => {
    ptero.pos.copy(pinned);
    return player({ speed: 0 });
  });
  assert.equal(calm.shots.length, 0);
  assert.equal(calm.health, 100);
});

test('health stops at zero and death is reported exactly once', () => {
  const combat = setup();
  combat.damage(60);
  combat.damage(60);
  assert.equal(combat.health, 0);
  const ev = run(combat, 0.5, player());
  assert.equal(ev.dead, 1);
});

test('no enemies spawn during the 3 s grace period, then they arrive 350-650 m away', () => {
  const combat = setup();
  run(combat, 2.9, player());
  assert.equal(combat.enemies.length, 0);
  run(combat, 0.2, player());
  assert.equal(combat.enemies.length, 1);
  const d = combat.enemies[0].pos.distanceTo(new THREE.Vector3(0, 200, 0));
  assert.ok(d >= 350 - 1 && d <= 650 + 1, `spawned ${d} m away`);
});

test('each world only spawns its own enemies, and never more than 6 at once', () => {
  const expected = { dino: ['pterosaur', 'wyvern', 'dragonfly'], china: ['lung', 'crane', 'kite'], modern: ['jet', 'helicopter', 'drone', 'gull'] };
  for (const [world, types] of Object.entries(expected)) {
    const combat = setup(world);
    combat.health = Infinity; // keep the dragon alive while enemies pile up
    const seen = new Set();
    let most = 0;
    for (let i = 0; i < 60 * 40; i++) {
      // High above the terrain so altitude clamping never interferes.
      combat.update(1 / 60, player({ pos: new THREE.Vector3(0, 5000, 0) }));
      combat.enemies.forEach((e) => seen.add(e.type.id));
      most = Math.max(most, combat.enemies.length);
    }
    assert.deepEqual([...seen].sort(), [...types].sort(), world);
    assert.ok(most <= 6, `${world}: ${most} alive at once`);
  }
});

test('the spawner waits while 6 enemies are already up', () => {
  const combat = setup('modern');
  for (let i = 0; i < 6; i++) combat.spawn('gull', new THREE.Vector3(i * 30, 200, -900));
  run(combat, 5, player());
  assert.equal(combat.enemies.length, 6);
});

test('enemies left far behind despawn', () => {
  const combat = setup();
  combat.spawn('gull', new THREE.Vector3(0, 200, -1200));
  combat.update(1 / 60, player());
  assert.equal(combat.enemies.length, 0);
});

test('a second hit within a second of the first does no damage', () => {
  const combat = setup();
  combat.spawn('gull', new THREE.Vector3(-3, 200, -30));
  combat.spawn('gull', new THREE.Vector3(3, 200, -30));
  const ev = run(combat, 0.6, player({ speed: 0 }));
  assert.equal(combat.enemies.length, 0, 'both gulls crashed into the dragon');
  assert.equal(ev.damage, 15);
  combat.spawn('gull', new THREE.Vector3(0, 200, -90));
  const later = run(combat, 1.5, player({ speed: 0 }));
  assert.equal(later.damage, 15, 'hits land again once the window has passed');
});

test('while inactive (menu or game over) nothing spawns, fires or hurts', () => {
  const combat = setup();
  combat.spawn('pterosaur', new THREE.Vector3(0, 200, -30));
  const ev = run(combat, 6, player({ active: false, firing: true }));
  assert.equal(ev.damage, 0);
  assert.equal(combat.health, 100);
  assert.equal(combat.fireballs.length, 0);
  assert.equal(combat.enemies.length, 1);
});

test('aim assist bends fire onto an enemy just off the aim line', () => {
  const combat = setup();
  // 4 degrees right of straight ahead at 400 m (about 28 m off-axis).
  const target = new THREE.Vector3(Math.sin(0.07) * 400, 200, -Math.cos(0.07) * 400);
  const drone = combat.spawn('drone', target);
  const ev = run(combat, 2, () => {
    drone.pos.copy(target);
    return player({ firing: true, speed: 0 });
  });
  assert.equal(ev.kills.length, 1);
});

// Player input that also keeps the sky empty, for tests about health alone.
function alone(combat) {
  return () => {
    combat.enemies.length = 0;
    combat.shots.length = 0;
    return player({ speed: 0 });
  };
}

test('a hurt dragon regenerates after a quiet spell, but never past full', () => {
  const combat = setup();
  combat.damage(40);
  assert.equal(combat.health, 60);
  run(combat, 3, alone(combat));
  assert.equal(combat.health, 60, 'no healing right after a hit');
  run(combat, 30, alone(combat));
  assert.equal(combat.health, 100);
});

test('every hit restarts the wait before health comes back', () => {
  const combat = setup();
  combat.damage(40);
  run(combat, 3.5, alone(combat));
  combat.damage(10);
  run(combat, 3.5, alone(combat));
  assert.equal(combat.health, 50, 'still waiting out the second hit');
  run(combat, 1, alone(combat));
  assert.ok(combat.health > 50, `got ${combat.health}`);
});

test('an enemy hit stops regeneration in the same frame', () => {
  const combat = setup();
  combat.damage(40);
  run(combat, 5, alone(combat));
  const before = combat.health;
  assert.ok(before > 60 && before < 100, `got ${before}`);
  combat.spawn('pterosaur', new THREE.Vector3(0, 200, 0)); // right on the dragon
  const ev = combat.update(1 / 60, player({ speed: 0 }));
  assert.equal(ev.damage, 15);
  assert.equal(combat.health, before - 15);
});

test('a dead dragon never regenerates and dies only once', () => {
  const combat = setup();
  combat.damage(500);
  assert.equal(combat.health, 0);
  const ev = run(combat, 10, alone(combat));
  assert.equal(combat.health, 0);
  assert.equal(ev.dead, 1);
});

test('nothing regenerates while the fight is paused', () => {
  const combat = setup();
  combat.damage(40);
  run(combat, 10, player({ active: false }));
  assert.equal(combat.health, 60);
  run(combat, 3, alone(combat));
  assert.equal(combat.health, 60, 'paused time does not count toward the wait');
});
