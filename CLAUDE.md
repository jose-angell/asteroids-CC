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

- **Power-up (Disparo Triple)**: `PowerUp` item spawns once per level (`powerUpSpawned`, reset in `nextLevel()`) with probability `POWERUP_CHANCE` when a bullet destroys an asteroid; it is forced on the level's last asteroid, so every level gets at least one. Picking it up sets `ship.tripleShot` (seconds left); `Ship.tryShoot()` then fires 3 bullets in a fan. The effect is lost on death (`Ship.reset()`) but preserved across `nextLevel()`.

- **Power-up (Escudo Temporal)**: independent of the triple shot — `shieldItem`/`shieldSpawned` mirror `powerUp`/`powerUpSpawned` (same `PowerUp` class with `type = 'shield'`, `SHIELD_CHANCE`, forced on the level's last asteroid). Picking it up sets `ship.shield` (5 s). While active, the ship–asteroid check uses `SHIELD_RADIUS`; a hit calls `destroyAsteroid()` (points, split, explosion — shared with bullet hits), clears the shield and grants `SHIELD_GRACE` s of `ship.invincible`. Lost on death, preserved across `nextLevel()`.

- **Power-up (Cámara Lenta)**: third independent item — `slowItem`/`slowSpawned` mirror the shield ones (`type = 'slow'`, `SLOW_CHANCE`, forced on the level's last asteroid). Picking it up sets `ship.slowMo` (6 s). While active, `update()` passes `dt * SLOW_FACTOR` to asteroids only (ship, bullets, particles unaffected) and asteroids are drawn in `SLOW_COLOR`. Lost on death (and asteroids run at normal speed in `'dead'` state), preserved across `nextLevel()`.

- **Power-up (Hiperpropulsión)**: `hyperItem`/`hyperSpawned` mirror the slow ones (`type = 'hyper'`, `HYPER_CHANCE`, forced on the level's last asteroid). Picking it up sets `ship.hyper` (8 s). While active, `Ship.update()` multiplies thrust by `HYPER_THRUST` and rotation by `HYPER_ROT` and clamps speed to `HYPER_MAX_SPEED` (normal terminal speed is ≈330 px/s, there is no explicit cap otherwise); the exhaust flame is longer and green. Lost on death, preserved across `nextLevel()`.

- **Power-up (Bomba Nova)**: fourth item — `novaItem`/`novaSpawned`, `type = 'nova'`, `NOVA_CHANCE` (very rare, only from `NOVA_MIN_LEVEL`, **not** forced on the last asteroid, so most levels have none). Picking it up sets `ship.nova = true` (one stored charge, shown in HUD as `NOVA [↓]`); ArrowDown calls `detonateNova()`, which removes every asteroid without splitting, adds their points, and starts the shockwave visual (`novaFx`). The empty asteroid list triggers `nextLevel()` the same frame. Lost on death, preserved across `nextLevel()`. ArrowDown is therefore also handled as input.

Note: the README mentions a "shooting star" asteroid type, which doesn't exist in the current code.
