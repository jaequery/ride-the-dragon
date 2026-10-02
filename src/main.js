import * as THREE from 'three';
import { Clouds } from './clouds.js';
import { Combat } from './combat.js';
import { createDragon } from './dragon.js';
import { makeThermalVisuals, Sparkles, SpeedLines } from './effects.js';
import { EnemyView } from './enemies.js';
import { rosterFor } from './enemyTypes.js';
import { Flight, Keyboard } from './flight.js';
import { angleDiff, clamp, damp } from './noise.js';
import { PixelPass } from './pixelPass.js';
import { Rings } from './rings.js';
import { makeSky } from './sky.js';
import { buildChina } from './worlds/china.js';
import { buildDino } from './worlds/dino.js';
import { buildModern } from './worlds/modern.js';

const WORLDS = [
  { name: 'Dinosaur Days', tag: 'Burn down pterosaurs, wyverns and giant dragonflies over the volcanoes.', swatch: 'linear-gradient(90deg,#3d7a28,#ff6a1f,#f3d08f)', build: buildDino, enemies: 'dino' },
  { name: 'Ancient China', tag: 'Duel rival dragons, war cranes and fire kites among karst peaks and pagodas.', swatch: 'linear-gradient(90deg,#b23a2a,#8cc35a,#f7c9b0)', build: buildChina, enemies: 'china' },
  { name: 'Current Day', tag: 'Dogfight jets, helicopters, drones and seagulls between skyscrapers.', swatch: 'linear-gradient(90deg,#3d7fd6,#a7b4c2,#ffd166)', build: buildModern, enemies: 'modern' },
];
const RING_GOAL = 20;
const COMBO_WINDOW = 6;
const MUZZLE = new THREE.Vector3(0, 2.2, -11.5); // the dragon's mouth, in its local space
const FIRE_COLORS = [0xff8a1c, 0xffd84a, 0xff4a1c];
const BOOM_COLORS = [0xff8a1c, 0xffe066, 0x5a5a5a, 0xffffff];
const CAMERAS = {
  rider: { pos: new THREE.Vector3(0, 7.6, 6.5), look: new THREE.Vector3(0, 3.2, -32), label: 'RIDER' },
  chase: { pos: new THREE.Vector3(0, 10, 30), look: new THREE.Vector3(0, 3, -20), label: 'CHASE' },
};

const $ = (id) => document.getElementById(id);
const canvas = $('game');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
} catch (err) {
  $('menu').classList.add('hidden');
  $('nogl').classList.remove('hidden');
  throw err;
}
renderer.setPixelRatio(1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, 0.5, 4000);
scene.add(camera);
const pass = new PixelPass(renderer);

const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 2.2);
const sun = new THREE.DirectionalLight(0xffffff, 2.6);
scene.add(hemi, sun);

const dragon = createDragon();
scene.add(dragon.root);
const flight = new Flight();
const keys = new Keyboard();
const sparkles = new Sparkles(scene);
const speedLines = new SpeedLines(camera);
const enemyView = new EnemyView(scene);
let combat = null;

let state = 'menu';
let worldIndex = 0;
let world = null;
let level = null; // per-world objects: clouds, rings, thermals, sky
let camMode = 'rider';
const game = { score: 0, rings: 0, kills: 0, combo: 0, lastPickup: -99, celebrated: false, startedAt: 0 };
let t = 0;

function disposeTree(obj) {
  obj.traverse((o) => {
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      m.map?.dispose();
      m.dispose();
    }
  });
}

function loadWorld(i) {
  if (world) {
    scene.remove(level.root);
    disposeTree(level.root);
  }
  worldIndex = i;
  world = WORLDS[i].build();
  const root = new THREE.Group();
  root.add(world.group);
  const sky = makeSky(world.sky);
  root.add(sky);
  const clouds = new Clouds(world, { color: world.cloudColor, seed: 3 + i });
  root.add(clouds.group);
  const thermals = makeThermalVisuals(world);
  root.add(thermals);
  scene.add(root);

  scene.fog = new THREE.Fog(world.fog.color, world.fog.near, world.fog.far);
  scene.background = new THREE.Color(world.fog.color);
  hemi.color.set(world.light.sky);
  hemi.groundColor.set(world.light.ground);
  sun.color.set(world.light.sun);
  sun.position.copy(world.sky.sunDir).normalize().multiplyScalar(100);

  const s = world.start;
  flight.reset(s.x, s.y, s.z, s.yaw);
  const rings = new Rings(world, flight);
  root.add(rings.group);
  sparkles.clear();
  combat = new Combat({ roster: rosterFor(WORLDS[i].enemies), floorAt: world.floorAt });
  level = { root, sky, clouds, thermals, rings, baseFog: { ...world.fog } };
}

// ---------- menu ----------
const list = $('world-list');
WORLDS.forEach((w, i) => {
  const b = document.createElement('button');
  b.className = 'world-card';
  b.innerHTML = `<div class="key">PRESS ${i + 1}</div><div class="name">${w.name}</div><div class="tag">${w.tag}</div><div class="swatch" style="background:${w.swatch}"></div>`;
  b.addEventListener('click', () => startGame(i));
  b.addEventListener('mouseenter', () => previewWorld(i));
  list.appendChild(b);
});

function markSelected(i) {
  [...list.children].forEach((c, k) => c.classList.toggle('selected', k === i));
}

function previewWorld(i) {
  if (state !== 'menu' || i === worldIndex) return markSelected(i);
  loadWorld(i);
  markSelected(i);
}

function startGame(i) {
  if (i !== worldIndex || !world) loadWorld(i);
  else {
    const s = world.start;
    flight.reset(s.x, s.y, s.z, s.yaw);
  }
  Object.assign(game, { score: 0, rings: 0, kills: 0, combo: 0, lastPickup: -99, celebrated: false, startedAt: t });
  combat.reset();
  state = 'playing';
  $('menu').classList.add('hidden');
  $('gameover').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('hud-world').textContent = WORLDS[i].name.toUpperCase();
  $('hud-goal').textContent = RING_GOAL;
  $('hint').style.opacity = 0.85;
  keys.endFrame();
  popup('FLY!', 1.5);
}

function openMenu() {
  state = 'menu';
  combat.reset();
  $('gameover').classList.add('hidden');
  $('menu').classList.remove('hidden');
  $('hud').classList.add('hidden');
  markSelected(worldIndex);
}

function gameOver() {
  state = 'down';
  $('go-score').textContent = game.score;
  $('go-kills').textContent = game.kills;
  $('gameover').classList.remove('hidden');
  sparkles.burst(flight.pos, 160, BOOM_COLORS, 45, 10, 1.6);
}

// ---------- HUD ----------
let popupTimer = 0;
function popup(text, seconds = 1.4) {
  $('popup').textContent = text;
  $('popup').classList.add('show');
  popupTimer = seconds;
}

function award(points, label, hits, colors) {
  for (const at of hits) {
    if (t - game.lastPickup < COMBO_WINDOW) game.combo = Math.min(game.combo + 1, 10);
    else game.combo = 1;
    game.lastPickup = t;
    let gained = points * game.combo;
    let text = `+${gained}${game.combo > 1 ? ` x${game.combo}` : ''}`;
    if (flight.rolling) {
      gained *= 2;
      text = `STYLE! +${gained}`;
    }
    game.score += gained;
    sparkles.burst(at, 70, colors, 40, 6);
    popup(label ? `${label} ${text}` : text);
    if (game.combo === 5 || game.combo === 10) {
      sparkles.fireworks(flight.pos);
      popup(`${game.combo} COMBO! ${text}`, 2);
    }
  }
}

function updateHud() {
  $('hud-score').textContent = game.score;
  $('hud-rings').textContent = game.rings;
  $('hud-speed').textContent = Math.round(flight.speed * 1.8);
  $('hud-alt').textContent = Math.max(0, Math.round(flight.pos.y - world.groundAt(flight.pos.x, flight.pos.z)));
  $('hud-cam').textContent = `CAM: ${CAMERAS[camMode].label}`;
  const comboLeft = COMBO_WINDOW - (t - game.lastPickup);
  $('hud-combo').textContent = game.combo > 1 && comboLeft > 0 ? `COMBO x${game.combo}` : '';
  $('boost-fill').style.width = `${Math.round(flight.boost * 100)}%`;
  $('hud-kills').textContent = game.kills;
  updateHealthBar();
  const near = level.rings.nearest(flight.pos);
  if (near.position) {
    const bearing = Math.atan2(-(near.position.x - flight.pos.x), -(near.position.z - flight.pos.z));
    const rel = angleDiff(flight.yaw, bearing);
    $('ring-arrow').style.transform = `rotate(${-rel}rad)`;
    const dy = near.position.y - flight.pos.y;
    $('ring-dist').textContent = `RING ${Math.round(near.distance)}M ${dy > 25 ? '↑' : dy < -25 ? '↓' : ''}`;
  }
  if (t - game.startedAt > 10) $('hint').style.opacity = 0;
}

function updateHealthBar() {
  const ratio = combat.health / combat.maxHealth;
  const fill = $('hp-fill');
  fill.style.width = `${Math.round(ratio * 100)}%`;
  fill.style.background = ratio > 0.5 ? '#5ae05a' : ratio > 0.25 ? '#ffd84a' : '#ff4a3a';
  $('hp-num').textContent = Math.ceil(combat.health);
}

// Crosshair where the fire stream is headed, and an edge arrow toward the
// nearest attacker when it is off screen.
const aimPoint = new THREE.Vector3();
const ndc = new THREE.Vector3();
function updateTargeting() {
  aimPoint.copy(muzzle).addScaledVector(flight.forward(), 300);
  ndc.copy(aimPoint).project(camera);
  const cross = $('crosshair');
  cross.style.display = ndc.z < 1 ? 'block' : 'none';
  cross.style.left = `${(ndc.x * 0.5 + 0.5) * 100}%`;
  cross.style.top = `${(-ndc.y * 0.5 + 0.5) * 100}%`;

  let nearest = null;
  let best = Infinity;
  for (const e of combat.enemies) {
    const d = e.pos.distanceTo(flight.pos);
    if (d < best) {
      best = d;
      nearest = e;
    }
  }
  const arrow = $('threat');
  if (!nearest) return (arrow.style.display = 'none');
  ndc.copy(nearest.pos).project(camera);
  const behind = ndc.z > 1;
  if (!behind && Math.abs(ndc.x) < 0.95 && Math.abs(ndc.y) < 0.95) return (arrow.style.display = 'none');
  const a = behind ? Math.atan2(-ndc.y, -ndc.x) : Math.atan2(ndc.y, ndc.x);
  arrow.style.display = 'block';
  arrow.style.left = `${50 + Math.cos(a) * 44}%`;
  arrow.style.top = `${50 - Math.sin(a) * 42}%`;
  arrow.style.transform = `translate(-50%, -50%) rotate(${Math.PI / 2 - a}rad)`;
}

// ---------- autopilot (menu background) ----------
function autopilotInput() {
  const ahead = flight.forward().multiplyScalar(160).add(flight.pos);
  const clearance = flight.pos.y - Math.max(world.floorAt(flight.pos.x, flight.pos.z), world.floorAt(ahead.x, ahead.z));
  return { turn: Math.sin(t * 0.12) * 0.55, climb: clamp((140 - clearance) / 80, -0.6, 1), soar: false, dive: false, roll: 0, fire: false };
}

// ---------- camera ----------
const rig = new THREE.Object3D();
const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();
function updateCamera(dt) {
  rig.position.copy(flight.pos);
  rig.rotation.set(flight.pitch * 0.85, flight.yaw, flight.bank * 0.35, 'YXZ');
  rig.updateMatrixWorld();
  const cfg = CAMERAS[state === 'menu' ? 'chase' : camMode];
  camPos.copy(cfg.pos).applyMatrix4(rig.matrixWorld);
  camLook.copy(cfg.look).applyMatrix4(rig.matrixWorld);
  // Never let the camera dip under the ground or into water.
  camPos.y = Math.max(camPos.y, world.groundAt(camPos.x, camPos.z) + 2);
  camera.position.copy(camPos);
  camera.up.set(0, 1, 0).applyQuaternion(rig.quaternion);
  camera.lookAt(camLook);
  camera.fov = damp(camera.fov, 68 + flight.boost * 18 + flight.tuck * 8, 4, dt);
  camera.updateProjectionMatrix();
}

// ---------- input ----------
window.addEventListener('keydown', (e) => {
  if (state === 'menu') {
    const n = Number(e.key);
    if (n >= 1 && n <= WORLDS.length) startGame(n - 1);
    if (e.key === 'Enter') startGame(worldIndex);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') previewWorld((worldIndex + (e.key === 'ArrowRight' ? 1 : WORLDS.length - 1)) % WORLDS.length);
    return;
  }
  if (state === 'down' && e.key === 'Enter') return startGame(worldIndex);
  if (e.code === 'Escape') openMenu();
  if (e.code === 'KeyC') camMode = camMode === 'rider' ? 'chase' : 'rider';
});

function resize() {
  pass.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------- main loop ----------
const clock = new THREE.Clock();
const fogBase = new THREE.Color();
const white = new THREE.Color(0xffffff);
let cloudFx = 0;
let updraftNoticeCooldown = 0;
let damageFx = 0;
const muzzle = new THREE.Vector3();

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  t += dt;

  // On the game-over screen the dragon and the fight hold still.
  const frozen = state === 'down';
  const input = state === 'playing' ? keys.flightInput() : autopilotInput();
  const events = frozen ? {} : flight.update(dt, input, world);
  keys.endFrame();

  dragon.root.position.copy(flight.pos);
  dragon.root.rotation.set(flight.pitch, flight.yaw, flight.bank + flight.roll, 'YXZ');
  dragon.update(dt, t, flight);
  world.update(dt, t, flight.pos);
  level.clouds.update(dt);
  level.thermals.update(dt);
  sparkles.update(dt);
  dragon.root.updateMatrixWorld();
  muzzle.copy(MUZZLE).applyMatrix4(dragon.root.matrixWorld);

  if (state === 'playing') {
    const fight = combat.update(dt, { pos: flight.pos, forward: flight.forward(), speed: flight.speed, muzzle, firing: input.fire });
    for (const k of fight.kills) {
      game.kills++;
      award(k.points, `${k.label} DOWN!`, [k.pos], BOOM_COLORS);
    }
    if (fight.hit) {
      damageFx = 1;
      sparkles.burst(flight.pos, 30, [0xff3b3b, 0xffffff], 25, 4, 0.6);
    }
    for (const f of combat.fireballs) if (Math.random() < 0.5) sparkles.burst(f.pos, 1, FIRE_COLORS, 5, -6, 0.35);
    if (fight.dead) gameOver();
    const rings = level.rings.update(dt, t, flight);
    if (rings.length) {
      game.rings += rings.length;
      award(100, '', rings, [0xffd84a, 0xffffff, 0xffa52a]);
      if (game.rings >= RING_GOAL && !game.celebrated) {
        game.celebrated = true;
        sparkles.fireworks(flight.pos);
        popup('ALL RINGS! KEEP EXPLORING!', 3);
      }
    }
    const picked = world.pickups?.(flight.pos);
    if (picked) award(picked.points, picked.label, picked.hits, picked.colors);
    if (events.rollStarted) popup('BARREL ROLL!', 0.8);
    updraftNoticeCooldown -= dt;
    if (events.updraft && updraftNoticeCooldown <= 0) {
      popup('UPDRAFT!', 1);
      updraftNoticeCooldown = 4;
    }
    if (events.turningBack && popupTimer <= 0) popup('EDGE OF THE WORLD - TURNING BACK', 1);
    updateHud();
  } else if (frozen) {
    updateHealthBar();
  } else {
    level.rings.update(dt, t, { pos: new THREE.Vector3(1e6, 1e6, 1e6), yaw: 0 });
  }

  updateCamera(dt);
  level.sky.position.copy(camera.position);
  enemyView.sync(combat, t);
  if (state === 'playing') updateTargeting();
  damageFx = Math.max(0, damageFx - dt * 2.5);
  $('damage').style.opacity = damageFx * 0.7;

  // Flying through a cloud: fog closes in and the screen goes misty white.
  cloudFx = damp(cloudFx, level.clouds.density(camera.position), 6, dt);
  fogBase.set(level.baseFog.color);
  scene.fog.color.copy(fogBase).lerp(white, cloudFx);
  scene.fog.near = level.baseFog.near * (1 - cloudFx * 0.95);
  scene.fog.far = level.baseFog.far * (1 - cloudFx * 0.9);
  pass.material.uniforms.whiteout.value = cloudFx * 0.55;

  const lines = state === 'playing' ? Math.max(flight.boost, flight.tuck * 0.7) : 0;
  speedLines.update(dt, flight.speed, lines);

  if (popupTimer > 0) {
    popupTimer -= dt;
    if (popupTimer <= 0) $('popup').classList.remove('show');
  }

  pass.render(scene, camera);
}

loadWorld(0);
markSelected(0);
frame();

// Hooks for headless checks: open with ?debug.
if (new URLSearchParams(location.search).has('debug')) {
  window.__game = {
    get state() {
      return state;
    },
    get combat() {
      return combat;
    },
    get flight() {
      return flight;
    },
    damage: (n) => combat.damage(n),
    start: (i) => startGame(i),
  };
}
