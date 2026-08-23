import { World } from './core/world.ts'
import { createRenderer } from './core/renderer.ts'
import { createRenderSystem } from './core/render-system.ts'
import { createMovementSystem } from './systems/movement.ts'
import { createJumpSystem } from './systems/jump.ts'
// import { createAiSystem } from './systems/ai.ts' // Temporarily disabled to stop enemy movement
import { createWobbleSystem } from './systems/wobble.ts'
import { createSquashSystem } from './systems/squash.ts'
import { createCollisionSystem } from './systems/collision.ts'
// import { createChunkStreamSystem } from './core/chunk.ts' // Temporarily disabled
import { MAP, TILE_W, TILE_H, GRID_H, PLATFORM_CELL } from './components/map.ts'
import type { Transform, Sprite, Velocity, Collider } from './core/components.ts'
import type { Player, Enemy, Wobble } from './components/index.ts'

// const SEED = 1337

const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!

function resize() {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
}
window.addEventListener('resize', resize)
resize()

const renderer = createRenderer(canvas)
const world = new World()

const playerPos = { x: 5 * TILE_W + TILE_W / 2, y: 4 * GRID_H }
const enemyPos = { x: 300, y: 0 }

MAP.forEach((row, r) =>
  row.forEach((tile, c) => {
    if (tile !== 1) return
    world.spawn({
      transform: { x: c * TILE_W + TILE_W / 2, y: r * GRID_H + TILE_H / 2, scale: 1, rotation: 0 } satisfies Transform,
      sprite: { r: TILE_W / 2, r2: TILE_H / 2, flip: 1, cell: PLATFORM_CELL } satisfies Sprite,
    })
  }),
)

world.spawn({
  transform: { x: playerPos.x, y: playerPos.y, scale: 1, rotation: 0 } satisfies Transform,
  sprite: { r: 20, flip: 1, cell: { x: 0, y: 0 } } satisfies Sprite,
  wobble: { prevX: playerPos.x, prevY: playerPos.y } satisfies Wobble,
  player: { walkSpeed: 100, runSpeed: 180 } satisfies Player,
  velocity: { dx: 0, dy: 0 } satisfies Velocity,
  collider: { hw: 0, hh: 0, oy: 20 } satisfies Collider,
})

world.spawn({
  transform: { x: enemyPos.x, y: enemyPos.y, scale: 1, rotation: 0 } satisfies Transform,
  sprite: { r: 20, flip: 1, cell: { x: 1, y: 0 } } satisfies Sprite,
  wobble: { prevX: enemyPos.x, prevY: enemyPos.y } satisfies Wobble,
  enemy: {
    speed: 80,
    detectRange: 400,
    windupRange: 120,
    windupDuration: 0.5,
    chargeSpeed: 300,
    chargeDistance: 300,
    phase: 'idle',
    windupTimer: 0,
    chargeDir: { x: 0, y: 0 },
    chargeRemaining: 0,
    lastSeen: null,
  } satisfies Enemy,
})

// 2nd Enemy
world.spawn({
  transform: { x: -enemyPos.x, y: enemyPos.y, scale: 1, rotation: 0 } satisfies Transform,
  sprite: { r: 20, flip: 1, cell: { x: 1, y: 0 } } satisfies Sprite,
  wobble: { prevX: enemyPos.x, prevY: enemyPos.y } satisfies Wobble,
  enemy: {
    speed: 80,
    detectRange: 400,
    windupRange: 120,
    windupDuration: 0.5,
    chargeSpeed: 300,
    chargeDistance: 300,
    phase: 'idle',
    windupTimer: 0,
    chargeDir: { x: 0, y: 0 },
    chargeRemaining: 0,
    lastSeen: null,
  } satisfies Enemy,
})

world.addSystem(createMovementSystem())
world.addSystem(createJumpSystem(playerPos.x, playerPos.y))
world.addSystem(createCollisionSystem())
// Temporarily disable to stop enemy movement
// world.addSystem(createAiSystem())
world.addSystem(createWobbleSystem())
world.addSystem(createSquashSystem())
// // Temporarily disable
// world.addSystem(createChunkStreamSystem(SEED))
world.addSystem(createRenderSystem(renderer, canvas))
world.start()
