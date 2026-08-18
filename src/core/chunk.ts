import type { World } from './world.ts'
import type { Entity, System } from './types.ts'
import type { Transform, Sprite } from './components.ts'
import { collapseChunkSteps, edgeTiles, TILE_WEIGHTS, type CellUpdate, type TileId } from './wfc.ts'

export const TILE_SIZE = 32
export const CHUNK_TILES = 8
export const CHUNK_PX = TILE_SIZE * CHUNK_TILES
const LOAD_RADIUS = 2
// seconds between each cell locking in — slow enough to watch the collapse propagate
const STEP_INTERVAL = 0.08

const TILE_COLORS: [number, number, number][] = [
  [0.2, 0.4, 0.8], // water
  [0.85, 0.75, 0.45], // sand
  [0.3, 0.65, 0.25], // grass
  [0.15, 0.35, 0.15], // forest
]

/** Weighted average of the remaining candidates' colors — an undecided cell leans toward whichever tile it's still likely to become. */
function blendedColor(candidates: TileId[]): [number, number, number] {
  const totalWeight = candidates.reduce((sum, t) => sum + TILE_WEIGHTS[t]!, 0)
  let r = 0
  let g = 0
  let b = 0
  for (const t of candidates) {
    const w = TILE_WEIGHTS[t]! / totalWeight
    const c = TILE_COLORS[t]!
    r += c[0] * w
    g += c[1] * w
    b += c[2] * w
  }
  return [r, g, b]
}
const UNDECIDED_COLOR = blendedColor([0, 1, 2, 3])

function tileSprite(color: [number, number, number]): Sprite {
  return { r: TILE_SIZE / 2, flip: 1, color }
}

const tileGrids = new Map<string, TileId[][]>()
const chunkEntities = new Map<string, Entity[]>()
const pending = new Map<string, { gen: Generator<CellUpdate, TileId[][], void>; entities: Entity[][]; timer: number }>()

function key(cx: number, cy: number): string {
  return `${cx},${cy}`
}

function chunkSeed(seed: number, cx: number, cy: number): number {
  return (Math.imul(seed, 374761393) ^ Math.imul(cx, 668265263) ^ Math.imul(cy, 2147483647)) | 0
}

export function getChunkGrid(cx: number, cy: number): TileId[][] | undefined {
  return tileGrids.get(key(cx, cy))
}

function spawnTiles(world: World, cx: number, cy: number, colorAt: (tx: number, ty: number) => [number, number, number]): Entity[][] {
  const entities: Entity[][] = []
  for (let ty = 0; ty < CHUNK_TILES; ty++) {
    const row: Entity[] = []
    for (let tx = 0; tx < CHUNK_TILES; tx++) {
      row.push(
        world.spawn({
          transform: {
            x: cx * CHUNK_PX + tx * TILE_SIZE + TILE_SIZE / 2,
            y: cy * CHUNK_PX + ty * TILE_SIZE + TILE_SIZE / 2,
            scale: 1,
            rotation: 0,
          } satisfies Transform,
          sprite: tileSprite(colorAt(tx, ty)) satisfies Sprite,
        }),
      )
    }
    entities.push(row)
  }
  return entities
}

export function ensureChunk(world: World, seed: number, cx: number, cy: number) {
  const k = key(cx, cy)
  if (chunkEntities.has(k)) return

  const finishedGrid = tileGrids.get(k)
  if (finishedGrid) {
    // already collapsed previously (chunk revisited after unload) — spawn with final colors, no re-animation
    chunkEntities.set(k, spawnTiles(world, cx, cy, (tx, ty) => TILE_COLORS[finishedGrid[ty]![tx]!]!).flat())
    return
  }

  const west = tileGrids.get(key(cx - 1, cy))
  const east = tileGrids.get(key(cx + 1, cy))
  const north = tileGrids.get(key(cx, cy - 1))
  const south = tileGrids.get(key(cx, cy + 1))
  const gen = collapseChunkSteps(CHUNK_TILES, chunkSeed(seed, cx, cy), {
    left: west ? edgeTiles(west, 'right') : undefined,
    right: east ? edgeTiles(east, 'left') : undefined,
    top: north ? edgeTiles(north, 'bottom') : undefined,
    bottom: south ? edgeTiles(south, 'top') : undefined,
  })

  const entities = spawnTiles(world, cx, cy, () => UNDECIDED_COLOR)
  chunkEntities.set(k, entities.flat())
  pending.set(k, { gen, entities, timer: 0 })
}

export function unloadChunk(world: World, cx: number, cy: number) {
  const k = key(cx, cy)
  for (const e of chunkEntities.get(k) ?? []) world.despawn(e)
  chunkEntities.delete(k)
  pending.delete(k)
}

/** Advances every in-progress chunk's collapse by however many steps `dt` covers. */
export function stepChunks(world: World, dt: number) {
  for (const [k, state] of pending) {
    state.timer += dt
    while (state.timer >= STEP_INTERVAL) {
      state.timer -= STEP_INTERVAL
      const result = state.gen.next()
      if (result.done) {
        tileGrids.set(k, result.value)
        pending.delete(k)
        break
      }
      const { x, y, candidates } = result.value
      const entity = state.entities[y]![x]!
      world.add(entity, 'sprite', tileSprite(blendedColor(candidates)))
    }
  }
}

export function createChunkStreamSystem(seed: number): System {
  return (world: World, dt: number) => {
    const playerEntity = world.query('player', 'transform')[0]
    if (playerEntity) {
      const player = world.get<Transform>(playerEntity, 'transform')!
      const pcx = Math.floor(player.x / CHUNK_PX)
      const pcy = Math.floor(player.y / CHUNK_PX)

      const needed = new Set<string>()
      for (let dy = -LOAD_RADIUS; dy <= LOAD_RADIUS; dy++) {
        for (let dx = -LOAD_RADIUS; dx <= LOAD_RADIUS; dx++) {
          needed.add(key(pcx + dx, pcy + dy))
          ensureChunk(world, seed, pcx + dx, pcy + dy)
        }
      }

      for (const k of [...chunkEntities.keys()]) {
        if (needed.has(k)) continue
        const [cx, cy] = k.split(',').map(Number)
        unloadChunk(world, cx!, cy!)
      }
    }

    stepChunks(world, dt)
  }
}
