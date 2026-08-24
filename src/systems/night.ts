import type { System } from '../core/types.ts'
import type { World } from '../core/world.ts'
import type { Sprite, Transform, Collider } from '../core/components.ts'
import type { Platform } from '../components/index.ts'
import { TILE_W, TILE_H, GRID_H, PLATFORM_CELL, DAY_MAP, NIGHT_MAP, setActiveMap, isWalkableBox } from '../components/map.ts'

const PLAYER_CELL = { x: 0, y: 0 }
const PLAYER_NIGHT_CELL = { x: 1, y: 0 }
const PLATFORM_NIGHT_CELL = { x: 3, y: 1, w: 1, h: 1.5 }

const FADE_DURATION = 0.4 // s

export let night = false
export let colorT = 0 // 0=day, 1=night — eased each frame toward `night` by createNightSystem

// (re)spawns platform entities from a map layout — used at bootstrap and on every toggle
export function spawnPlatforms(world: World, map: number[][]) {
  world.query('platform').forEach((e) => world.despawn(e))
  map.forEach((row, r) =>
    row.forEach((tile, c) => {
      if (tile !== 1) return
      world.spawn({
        transform: { x: c * TILE_W + TILE_W / 2, y: r * GRID_H + TILE_H / 2, scale: 1, rotation: 0 } satisfies Transform,
        sprite: { r: TILE_W / 2, r2: TILE_H / 2, flip: 1, layer: -1, cell: night ? PLATFORM_NIGHT_CELL : PLATFORM_CELL } satisfies Sprite,
        platform: {} satisfies Platform,
      })
    }),
  )
}

// toggles day/night on 'j': swaps the active map + platform layout, reskins the player,
// and drops the player back to spawn (with a landing bounce) if their footing vanished
export function initNightToggle(world: World, spawnX: number, spawnY: number) {
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'j') return
    night = !night
    setActiveMap(night)

    world.query('player', 'sprite').forEach((en) => {
      const s = world.get<Sprite>(en, 'sprite')!
      world.add(en, 'sprite', { ...s, cell: night ? PLAYER_NIGHT_CELL : PLAYER_CELL })
    })

    spawnPlatforms(world, night ? NIGHT_MAP : DAY_MAP)

    world.query('player', 'transform', 'collider').forEach((en) => {
      if (world.has(en, 'jump')) return // mid-hop: not standing on anything yet, jump.ts's own landing check applies
      const t = world.get<Transform>(en, 'transform')!
      const c = world.get<Collider>(en, 'collider')!
      if (isWalkableBox(night ? NIGHT_MAP : DAY_MAP, t.x, t.y, c.hw, c.hh, c.oy)) return
      world.add(en, 'transform', { ...t, x: spawnX, y: spawnY })
      world.emit('land', en)
    })
  })
}

export function createNightSystem(): System {
  return (_world, dt) => {
    const target = night ? 1 : 0
    const step = dt / FADE_DURATION
    colorT = target > colorT ? Math.min(colorT + step, target) : Math.max(colorT - step, target)
  }
}
