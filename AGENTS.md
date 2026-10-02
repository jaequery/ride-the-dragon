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

_Anything a new contributor would get wrong on their first try._
