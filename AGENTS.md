## Overview

This codebase is for js13k game jam submission. Be sure to minimize your implementation and not to bloat it.

js13k requires entire codebase to be under 13KB size, so make sure check it when you done your implementation.

Size check: `pnpm build` produces `dist/index.html` as a single self-contained file (JS/CSS inlined, terser-minified via `vite.config.ts`). Zip it and check the size against the 13KB (13312 byte) budget:

```sh
pnpm build
cd dist && zip -9 -r /tmp/submission.zip . && unzip -l /tmp/submission.zip
```

## Directory layout

- `src/core/` — engine internals: `world.ts` (ECS), `types.ts` (Entity/System/Timer), `components.ts` (engine-level component types the renderer depends on, e.g. Transform/Sprite), `renderer.ts` (WebGL), `render-system.ts` (generic transform+sprite render loop).
- `src/components/` — application-specific component data types (this game's content, not engine internals).
- `src/systems/` — application-specific systems (this game's rules).
- `src/main.ts` — bootstrap only: canvas setup, world creation, initial spawns, system registration, `start()`.

## ECS World (`src/core/world.ts`, `src/core/types.ts`)

- Entity: `crypto.randomUUID()` string, branded as `Entity` type for compile-time safety (zero runtime cost).
- Components: `Map<string, Map<Entity, unknown>>`, typed by string key.
- Systems: plain `(world, dt) => void` functions run in registration order — no priority/dependency graph.
- Events: synchronous `Map`-based pub/sub (`on`/`emit`) — no queueing.
- Timers: driven by loop `dt` accumulation, not `setTimeout` — pauses with the loop, no drift.
- Loop: single `requestAnimationFrame`, `dt` clamped to 0.1s to avoid spiral of death — no fixed-timestep accumulator.
- `spawn(components?)`/`despawn(entity)` combine entity creation with component attachment for ergonomic call sites.
- `query(...types)` picks the smallest component store as anchor and intersects via `has()` — recomputed each call, no cached index.

### Usage

```ts
import { World } from './core/world.ts'
import type { Entity } from './core/types.ts'

const world = new World()

type Stunned = { duration: number }

// create entity with initial components
const player = world.spawn({
  position: { x: 0, y: 0 },
  stunned: { duration: 0 },
})

// attach/detach a component after spawn (capability changes, not per-frame state)
world.add(player, 'poisoned', { duration: 5 })
world.remove(player, 'poisoned')

// systems: registered once, run every frame in registration order
world.addSystem((world, dt) => {
  world
    .query('position', 'stunned')
    .map((e) => [e, world.get<Stunned>(e, 'stunned')!] as const)
    .filter(([, stunned]) => stunned.duration > 0)
    .forEach(([e, stunned]) => world.add(e, 'stunned', tickStunned(stunned, dt)))
})

// events: cross-system communication
world.on('hit', (entity: Entity, damage: number) => { /* ... */ })
world.emit('hit', player, 10)

// timers: tied to the loop's dt, not setTimeout
world.setTimer(2, () => console.log('2s elapsed'))
world.setTimer(1, () => console.log('every 1s'), true)

world.start() // begins the rAF loop
world.stop()
```

State toggles (e.g. `stunned.duration`, where the component always stays attached and a field encodes on/off) are a `get` + pure recompute + `add`-writeback, not repeated `add`/`remove` calls. Reserve `add`/`remove` for entities gaining or losing an entire capability (component type presence/absence, which `query` filters on).

### Coding style for systems & core components

Write system logic and core component code in as pure a functional style as possible — "functional core, imperative shell":
- Split logic into pure functions that take component data and return the next state (e.g. `tickStunned(s: Stunned, dt: number): Stunned`). No side effects, no mutation — output determined solely by input.
- Functions registered via `addSystem` are a thin shell only — read with `world.get`, call the pure function, write the result back with `world.add`. The World's Map-based storage itself stays mutable for performance/size reasons (persistent data structures aren't worth their cost inside a js13k budget).
- Prefer standard array methods (`map`/`filter`/`reduce`) over raw loops for readability. Switch to an imperative loop only if profiling shows a real hot-path bottleneck (large entity counts, once per frame).

### Quick sanity check

`test/world.test.ts` covers the ECS core (spawn/despawn, add/get/has/remove, query, systems, on/emit, timers, start/stop dt clamping) with vitest. It's a devDependency only — not part of the js13k build, doesn't count toward the 13KB budget.

```sh
pnpm test      # run the World test suite
pnpm typecheck # type-check without emitting
```

Run both after touching `src/core/world.ts`/`src/core/types.ts` before considering the change done.
