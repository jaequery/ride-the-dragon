# ride-the-dragon

A dragon-riding action flight game for the browser, built with
three.js. The world is 3D but rendered at ~240 lines with a limited, dithered
palette for a retro console look.

Pick a world — **Dinosaur Days**, **Ancient China** or **Current Day** — and
fly through clouds, golden rings, updrafts and sky lanterns.

## Run it

```sh
npm install
npm run dev      # local dev server
npm run build    # static bundle in dist/
npm run preview  # serve the built bundle
```

## Controls

| Key | Move |
| --- | --- |
| Arrows / WASD | steer, climb and descend |
| Left click | breathe fire |
| Space | soar faster |
| Shift | tuck wings and dive |
| Q / E | barrel roll; time the opening to parry incoming shots (rings collected mid-roll score double) |
| C | switch rider / chase camera |
| Esc | back to the world menu |

The first **0.3 seconds** of a barrel roll can reflect enemy shots. Watch the
cyan **PARRY ACTIVE** cue: a successful parry keeps your HP, awards **50 points**,
and sends a cyan countershot toward the attacker for **two fireball hits** of
damage. The rest of the roll is recovery; late shots and enemy collisions still
hurt. Q and E work the same way, and another roll is ready once the spin ends.

Created with [Fredrin](https://fredrin.com).
