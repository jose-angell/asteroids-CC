# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Asteroids clone in plain HTML5 Canvas + vanilla JS. No dependencies, no bundler, no package.json, no tests, no linter. The README and in-game text are in Spanish.

## Running

Open `index.html` directly in a browser, or serve locally with `npx serve .` (http://localhost:3000). There is no build step; reload the page to see changes.

## Architecture

All game logic lives in `game.js` (loaded by `index.html` via a plain `<script>`; the canvas is fixed at 800x600 and `W`/`H` constants in `game.js` must match the canvas attributes). The file is organized in sections in this order: input, utils, entity classes (`Bullet`, `Asteroid`, `Ship`, `Particle`), game state + helpers, `update(dt)`, `draw()`, main loop.

- **Game loop**: `requestAnimationFrame` loop calls `update(dt)` then `draw()`; `dt` is in seconds and clamped to 0.05. All speeds/accelerations are in px/s (or px/s²) and scaled by `dt`.
- **State machine**: global `state` is `'playing' | 'dead' | 'gameover'`. `'dead'` is a 2s respawn pause (`deadTimer`) in which only asteroids and particles update; `'gameover'` waits for Space to call `initGame()`.
- **Entities** each have `update(dt)`, `draw()`, and a `dead` flag; arrays (`bullets`, `asteroids`, `particles`) are filtered by `dead` each frame rather than spliced. Game state is module-level `let` globals, reset in `initGame()`/`nextLevel()`.
- **Toroidal world**: positions wrap via `wrap()`; collisions use plain `dist()` with no wrap-aware distance, so objects straddling an edge don't collide across it.
- **Asteroid sizes** are indexed 1–3 into the parallel `RADII`/`SPEEDS`/`POINTS` arrays (index 0 unused). Destroying size N spawns two of size N-1 via `split()`.
- **Input**: `keys[code]` holds held state; `pressed(code)` is a one-shot "just pressed" consumed on read (used for Space to fire/restart). Only arrow keys and Space are handled.
- **Collisions**: bullet vs asteroid uses `a.radius`; ship vs asteroid uses `ship.radius + a.radius * 0.82` and is skipped while `ship.invincible > 0`.

Note: the README mentions power-ups and a "shooting star" asteroid type, but neither exists in the current code.
