# AGENTS.md

Conventions for AI coding agents working in **ride-the-dragon**. This file is the
canonical entry point under the [AGENTS.md](https://agents.md) standard, and it
is the first thing a Fredrin Worker reads.

It is a stub — the first ticket on the board fills it in.

## Project

A browser dragon-riding flight game (three.js + Vite, plain JS, no combat) with
selectable themed worlds in `src/worlds/`. All geometry is procedural — there are
no model or texture asset files.

## Commands

- `npm install`, then `npm run dev` (dev server) / `npm run build` (static `dist/`) / `npm run preview`.
- There is no test suite or linter yet; `npm run build` is the only automated check.

## Conventions

- After changing the dragon model (`src/dragon.js`) or the camera offsets (`CAMERAS` in `src/main.js`), screenshot the rider view while holding Space and turning. A raised or banked wing can fill the whole screen even when the level-flight view looks fine. Headless Chromium needs `--use-angle=swiftshader --enable-unsafe-swiftshader` to render WebGL.
