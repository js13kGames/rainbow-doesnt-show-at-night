import type { System } from '../core/types.ts'
import type { World } from '../core/world.ts'
import type { Sprite, Transform, Collider } from '../core/components.ts'
import type { Platform } from '../components/index.ts'
import { TILE_W, GRID_H, TILE_DIRT, activeScene, setActiveMap, isWalkableBox } from '../components/map.ts'

const PLAYER_CELL = { x: 0, y: 0 }
const PLAYER_NIGHT_CELL = { x: 1, y: 0 }

// atlas row1 = grass tile, row2 = dirt tile directly below it — both plain 16x16 cells
const PLATFORM_GRASS_CELL = { x: 1, y: 1, w: 1, h: 1 }
const PLATFORM_DIRT_CELL = { x: 1, y: 2, w: 1, h: 1 }
const PLATFORM_NIGHT_GRASS_CELL = { x: 0, y: 1, w: 1, h: 1 }
const PLATFORM_NIGHT_DIRT_CELL = { x: 0, y: 2, w: 1, h: 1 }

const FADE_DURATION = 0.4 // s

export let night = false
export let colorT = 0 // 0=day, 1=night — eased each frame toward `night` by createNightSystem

// (re)spawns platform entities from a map layout — used at bootstrap and on every toggle
export function spawnPlatforms(world: World, map: number[][]) {
  world.query('platform').forEach((e) => world.despawn(e))
  map.forEach((row, r) =>
    row.forEach((tile, c) => {
      if (tile === 0) return
      const isDirt = tile === TILE_DIRT
      const cell = isDirt ? (night ? PLATFORM_NIGHT_DIRT_CELL : PLATFORM_DIRT_CELL) : night ? PLATFORM_NIGHT_GRASS_CELL : PLATFORM_GRASS_CELL
      world.spawn({
        transform: { x: c * TILE_W + TILE_W / 2, y: r * GRID_H + GRID_H / 2, scale: 1, rotation: 0 } satisfies Transform,
        sprite: { r: TILE_W / 2, r2: GRID_H / 2, flip: 1, layer: -1, cell } satisfies Sprite,
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

    spawnPlatforms(world, night ? activeScene().night : activeScene().day)

    world.query('player', 'transform', 'collider').forEach((en) => {
      if (world.has(en, 'jump')) return // mid-hop: not standing on anything yet, jump.ts's own landing check applies
      const t = world.get<Transform>(en, 'transform')!
      const c = world.get<Collider>(en, 'collider')!
      if (isWalkableBox(night ? activeScene().night : activeScene().day, t.x, t.y, c.hw, c.hh, c.oy)) return
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
