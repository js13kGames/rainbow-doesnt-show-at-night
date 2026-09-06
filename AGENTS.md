## Overview

This codebase is for js13k game jam submission. Be sure to minimize your implementation and not to bloat it.

js13k requires entire codebase to be under 13KB size, so make sure check it when you done your implementation.

Size check: `pnpm build` produces `dist/index.html` as a single self-contained file (JS/CSS inlined, terser-minified via `vite.config.ts`). Zip it and check the size against the 13KB (13312 byte) budget:

When try to run locally, use port 5174 and do not kill vite process in port 5173.

```sh
pnpm build
cd dist && zip -9 -r /tmp/submission.zip . && ls -la /tmp/submission.zip
```

`ls -la` output is the actual submitted zip size — judge against this, not `unzip -l`'s uncompressed listing.

## Directory layout

- `src/core/renderer.ts` — WebGL primitive: compiles the sprite shader, uploads the atlas texture, exposes `drawScene(sprites, colorT)`. Knows nothing about game state.
- `src/core/render.ts` — builds the frame's sprite list from `state.ts` (platforms, clouds, portal, player, in back-to-front order) and calls `drawScene`.
- `src/state.ts` — the game's entire mutable state: `player` (single object, all fields — position, velocity, collider, wobble/jump/squash sub-state), `portal` (single object), `platforms`/`clouds` (flat arrays). Also owns spawn/respawn functions for each.
- `src/components/map.ts` — map data (`STAGES`, tile derivation) and collision helpers (`isWalkableBox`). Pure, no dependency on `state.ts`.
- `src/systems/*.ts` — one file per concern (movement, jump, collision, wobble, squash, cloud, night, portal). Each exports a plain function (or a factory returning one) that reads/writes `state.ts` directly — no registration mechanism, no query.
- `src/main.ts` — bootstrap (canvas setup, initial spawns) and owns the `requestAnimationFrame` loop, calling each system's update function in explicit order, then `render()`.

## Game state (`src/state.ts`)

There is exactly one player, one portal, and flat arrays for platforms/clouds — no entity ever gains or loses components at runtime in ways that would justify a generic entity-component-system. So there isn't one: state is plain mutable objects/arrays, and systems mutate them directly instead of going through a generic store.

- `player` holds every per-frame field the game's systems touch (`x`/`y`/`rotation` transform, `r`/`r2`/`oy`/`flip`/`cell` sprite, `vx`/`vy` velocity, `hw`/`hh`/`foy` collider, `wpx`/`wpy` wobble history, `jump`/`sq` — `null` when inactive, an object with data when active).
- `platforms`/`clouds` are rebuilt wholesale (`respawnPlatforms`, in `spawnClouds`) rather than diffed — cheap enough at this entity count and simpler than incremental updates.
- Render order is just array concatenation order in `render.ts` (platforms, then clouds, then portal, then player) — no `layer` field or sort needed since there's nothing to reorder relative to.

### Usage

```ts
// systems/*.ts: a plain function (or a factory closing over spawn-time constants)
// that reads/writes state.ts directly
export function updateSomething(dt: number) {
  if (!player.something) return
  player.something = tickSomething(player.something, dt)
}

// main.ts: call each system's update function in explicit order every frame,
// then render — order here IS the execution order (no priority/dependency graph)
function tick(now: number) {
  const dt = /* clamped to 0.1s to avoid spiral of death */
  updateMovement()
  updateJump(dt)
  updateCollision(dt)
  updateWobble(dt)
  updateSquash(dt)
  render()
  requestAnimationFrame(tick)
}
```

### Coding style for systems

Keep the actual math in pure functions that take data and return the next state (e.g. `hopOffset(progress: number): number`, `driftX(x, speed, dt, r, canvasWidth): number`, `isWalkableBox(map, x, y, hw, hh, oy): boolean`) — no side effects, output determined solely by input. The system function itself is a thin shell: read the relevant `state.ts` fields, call the pure function(s), assign the result back (direct mutation — there's no copy-on-write store to fight, so don't manufacture one).

Prefer standard array methods (`map`/`filter`/`forEach`) over raw loops for readability. Switch to an imperative loop only if profiling shows a real hot-path bottleneck.

### Quick sanity check

`test/map.test.ts` covers the pure map logic (tile derivation, walkability checks) with vitest. It's a devDependency only — not part of the js13k build, doesn't count toward the 13KB budget.

```sh
pnpm test      # run the test suite
pnpm typecheck # type-check without emitting
```

Run both after touching `src/components/map.ts` before considering the change done.
