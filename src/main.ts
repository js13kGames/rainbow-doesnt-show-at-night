import { World } from './core/world.ts'
import { createRenderer } from './core/renderer.ts'
import { createRenderSystem } from './core/render-system.ts'
import { createMovementSystem } from './systems/movement.ts'
import { createJumpSystem } from './systems/jump.ts'
import { createWobbleSystem } from './systems/wobble.ts'
import { createSquashSystem } from './systems/squash.ts'
import { createCollisionSystem } from './systems/collision.ts'
import { createCloudSystem } from './systems/cloud.ts'
import { MAP, TILE_W, TILE_H, GRID_H, PLATFORM_CELL } from './components/map.ts'
import type { Transform, Sprite, Velocity, Collider } from './core/components.ts'
import type { Player, Wobble, Cloud } from './components/index.ts'

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

const CLOUD_COUNT = 10
const slotW = canvas.width / CLOUD_COUNT
for (let i = 0; i < CLOUD_COUNT; i++) {
  const depth = Math.random() // 0=멀리/위/작게, 1=가까이/아래/크게
  const scale = 0.4 + depth * 1.4
  world.spawn({
    transform: { x: slotW * i + Math.random() * slotW, y: canvas.height * (0.05 + depth * 0.75), scale: 1, rotation: 0 } satisfies Transform,
    sprite: { r: 40 * scale, r2: 20 * scale, flip: Math.random() < 0.5 ? -1 : 1, cell: { x: 2, y: 2, w: 2, h: 1 } } satisfies Sprite,
    cloud: { speed: 15 + depth * 15 } satisfies Cloud,
  })
}

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
  player: { speed: 130 } satisfies Player,
  velocity: { dx: 0, dy: 0 } satisfies Velocity,
  collider: { hw: 0, hh: 0, oy: 20 } satisfies Collider,
})

world.addSystem(createCloudSystem(canvas))
world.addSystem(createMovementSystem())
world.addSystem(createJumpSystem(playerPos.x, playerPos.y))
world.addSystem(createCollisionSystem())
world.addSystem(createWobbleSystem())
world.addSystem(createSquashSystem(world))
world.addSystem(createRenderSystem(renderer, canvas))
world.start()
requestAnimationFrame(() => (canvas.style.opacity = '1'))
