import { World } from './core/world.ts'
import { createRenderer } from './core/renderer.ts'
import { createRenderSystem } from './core/render-system.ts'
import { createMovementSystem } from './systems/movement.ts'
import { createAiSystem } from './systems/ai.ts'
import { createWobbleSystem } from './systems/wobble.ts'
import { createSquashSystem } from './systems/squash.ts'
import { createChunkStreamSystem } from './core/chunk.ts'
import type { Transform, Sprite } from './core/components.ts'
import type { Player, Enemy, Wobble } from './components/index.ts'

const SEED = 1337

const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!

function resize() {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
}
window.addEventListener('resize', resize)
resize()

const renderer = createRenderer(canvas)
const world = new World()

const playerPos = { x: 0, y: 0 }
const enemyPos = { x: 300, y: 0 }

world.spawn({
  transform: { x: playerPos.x, y: playerPos.y, scale: 1, rotation: 0 } satisfies Transform,
  sprite: { r: 20, flip: 1, cell: { x: 1, y: 0 } } satisfies Sprite,
  wobble: { prevX: playerPos.x, prevY: playerPos.y } satisfies Wobble,
  player: { walkSpeed: 100, runSpeed: 180 } satisfies Player,
})

world.spawn({
  transform: { x: enemyPos.x, y: enemyPos.y, scale: 1, rotation: 0 } satisfies Transform,
  sprite: { r: 20, flip: 1, cell: { x: 0, y: 0 } } satisfies Sprite,
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
  sprite: { r: 20, flip: 1, cell: { x: 0, y: 0 } } satisfies Sprite,
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
// Temporarily disable to stop enemy movement
// world.addSystem(createAiSystem())
world.addSystem(createWobbleSystem())
world.addSystem(createSquashSystem())
// // Temporarily disable
// world.addSystem(createChunkStreamSystem(SEED))
world.addSystem(createRenderSystem(renderer, canvas))
world.start()
