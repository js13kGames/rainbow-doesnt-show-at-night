import type { System } from '../core/types.ts'
import type { World } from '../core/world.ts'
import type { Sprite, Transform, Collider } from '../core/components.ts'
import type { Portal } from '../components/index.ts'
import { TILE_W, GRID_H, MAP, activeScene, advanceStage } from '../components/map.ts'
import { night, spawnPlatforms } from './night.ts'

// sprite-sheet.png (48,32)-(63,47) — 1 cell
const PORTAL_CELL = { x: 3, y: 2, w: 1, h: 1 }

// (re)spawns the current stage's portal — used at bootstrap and on every stage advance
export function spawnPortal(world: World) {
  world.query('k').forEach((e) => world.despawn(e))
  const { col, row } = activeScene().portal
  world.spawn({
    a: { x: col * TILE_W + TILE_W / 2, y: row * GRID_H + GRID_H / 2, scale: 1, rotation: 0 } satisfies Transform,
    b: { r: TILE_W / 2, r2: GRID_H / 2, oy: -GRID_H / 2, flip: 1, cell: PORTAL_CELL } satisfies Sprite,
    k: {} satisfies Portal,
  })
}

// when the player's feet land on the portal tile: advance to the next stage (wrapping) and
// drop the player back at spawn — mirrors night.ts's toggle-triggered respawn
export function createPortalSystem(world: World, spawnX: number, spawnY: number): System {
  return () => {
    const { col, row } = activeScene().portal
    world.query('e', 'a', 'd').forEach((en) => {
      const t = world.get<Transform>(en, 'a')!
      const c = world.get<Collider>(en, 'd')!
      const pc = Math.floor(t.x / TILE_W)
      const pr = Math.floor((t.y + (c.oy ?? 0)) / GRID_H)
      if (pc !== col || pr !== row) return

      advanceStage(night)
      spawnPlatforms(world, MAP)
      spawnPortal(world)
      world.add(en, 'a', { ...t, x: spawnX, y: spawnY })
      world.emit('l', en)
    })
  }
}
