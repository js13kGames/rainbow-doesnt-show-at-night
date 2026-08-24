import { World } from './core/world.ts'
import { createRenderer } from './core/renderer.ts'
import { createRenderSystem } from './core/render-system.ts'
import { movementSystem } from './systems/movement.ts'
import { createJumpSystem } from './systems/jump.ts'
import { wobbleSystem } from './systems/wobble.ts'
import { initSquash, squashSystem } from './systems/squash.ts'
import { collisionSystem } from './systems/collision.ts'
import { createCloudSystem } from './systems/cloud.ts'
import { initNightToggle, nightSystem, spawnPlatforms } from './systems/night.ts'
import { spawnPortal, createPortalSystem } from './systems/portal.ts'
import { MAP, TILE_W, GRID_H } from './components/map.ts'
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
    a: { x: slotW * i + Math.random() * slotW, y: canvas.height * (0.05 + depth * 0.75), scale: 1, rotation: 0 } satisfies Transform,
    b: { r: 40 * scale, r2: 20 * scale, flip: Math.random() < 0.5 ? -1 : 1, cell: { x: 0, y: 3, w: 2, h: 1 } } satisfies Sprite,
    i: { speed: 15 + depth * 15 } satisfies Cloud,
  })
}

spawnPlatforms(world, MAP)
spawnPortal(world)

world.spawn({
  a: { x: playerPos.x, y: playerPos.y, scale: 1, rotation: 0 } satisfies Transform,
  b: { r: 20, flip: 1, cell: { x: 0, y: 0 } } satisfies Sprite,
  f: { prevX: playerPos.x, prevY: playerPos.y } satisfies Wobble,
  e: { speed: 130 } satisfies Player,
  c: { dx: 0, dy: 0 } satisfies Velocity,
  d: { hw: 0, hh: 0, oy: 20 } satisfies Collider,
})

world.addSystem(createCloudSystem(canvas))
world.addSystem(movementSystem)
world.addSystem(createJumpSystem(playerPos.x, playerPos.y))
world.addSystem(collisionSystem)
world.addSystem(wobbleSystem)
initSquash(world)
world.addSystem(squashSystem)
world.addSystem(nightSystem)
world.addSystem(createPortalSystem(world, playerPos.x, playerPos.y))
world.addSystem(createRenderSystem(renderer, canvas))
initNightToggle(world, playerPos.x, playerPos.y)
world.start()
requestAnimationFrame(() => (canvas.style.opacity = '1'))
