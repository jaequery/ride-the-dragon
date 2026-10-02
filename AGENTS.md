# AGENTS.md

Conventions for AI coding agents working in **ride-the-dragon**. This file is the
canonical entry point under the [AGENTS.md](https://agents.md) standard, and it
is the first thing a Fredrin Worker reads.

It is a stub — the first ticket on the board fills it in.

## Project

A browser dragon-riding action flight game (three.js + Vite, plain JS) with
selectable themed worlds in `src/worlds/`. Space breathes fire at world-themed
flying enemies; the dragon has a health bar. All geometry is procedural — there
are no model or texture asset files.

- `src/combat.js` — fight logic (fire, enemy AI/spawning, enemy shots, health). No DOM/WebGL, so it runs under Node tests.
- `src/enemyTypes.js` — enemy stats and per-world rosters (pure data).
- `src/enemies.js` — enemy/projectile meshes and `EnemyView`, which mirrors `Combat` state into the scene.

## Commands

- `npm install`, then `npm run dev` (dev server) / `npm run build` (static `dist/`) / `npm run preview`.
- `npm test` runs `test/*.test.js` with Node's built-in runner (no extra deps). Test `Combat` through its public API.
- There is no linter; `npm run build` is the other automated check.
- Open the game with `?debug` to get `window.__game` (`state`, `combat`, `flight`, `damage(n)`, `start(i)`) for headless checks.

## Conventions

- After changing the dragon model (`src/dragon.js`) or the camera offsets (`CAMERAS` in `src/main.js`), screenshot the rider view while holding X (soar) and turning. A raised or banked wing can fill the whole screen even when the level-flight view looks fine. Headless Chromium needs `--use-angle=swiftshader --enable-unsafe-swiftshader` to render WebGL.
