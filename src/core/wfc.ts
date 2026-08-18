import { mulberry32 } from './random.ts'

export type TileId = number

// biome gradient: water(0) - sand(1) - grass(2) - forest(3)
export const TILE_COUNT = 4
export const TILE_WEIGHTS = [1, 2, 5, 3]

export function compatible(a: TileId, b: TileId): boolean {
  return Math.abs(a - b) <= 1
}

export type Border = { top?: TileId[]; right?: TileId[]; bottom?: TileId[]; left?: TileId[] }

/** A cell's remaining possibilities just changed — `candidates.length === 1` means it's fully resolved. */
export type CellUpdate = { x: number; y: number; candidates: TileId[] }

type Pos = [number, number]

/**
 * Generator form of the algorithm: yields a `CellUpdate` every time a cell's
 * possibility set changes (border seed, propagation narrowing it down, or an
 * explicit collapse pick), so a caller can render both the shrinking
 * probability distribution and the final confirmed tile step by step.
 * Returns the finished grid once every cell is resolved.
 */
export function* collapseChunkSteps(size: number, seed: number, border: Border = {}): Generator<CellUpdate, TileId[][], void> {
  const rng = mulberry32(seed)
  const grid: Set<TileId>[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => new Set<TileId>([0, 1, 2, 3])),
  )
  const queue: Pos[] = []

  function fix(x: number, y: number, tile: TileId) {
    grid[y]![x] = new Set([tile])
    queue.push([x, y])
  }

  border.top?.forEach((t, x) => fix(x, 0, t))
  border.bottom?.forEach((t, x) => fix(x, size - 1, t))
  border.left?.forEach((t, y) => fix(0, y, t))
  border.right?.forEach((t, y) => fix(size - 1, y, t))
  for (const [x, y] of queue) yield { x, y, candidates: [...grid[y]![x]!] }

  function neighbors(x: number, y: number): Pos[] {
    return (
      [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ] as Pos[]
    ).filter(([nx, ny]) => nx >= 0 && nx < size && ny >= 0 && ny < size)
  }

  function* drain(): Generator<CellUpdate> {
    while (queue.length > 0) {
      const [x, y] = queue.shift()!
      const current = [...grid[y]![x]!]
      for (const [nx, ny] of neighbors(x, y)) {
        const before = grid[ny]![nx]!
        const after = new Set([...before].filter((t) => current.some((s) => compatible(s, t))))
        if (after.size === 0) {
          // ponytail: contradiction — clamp to nearest confirmed tile instead of backtracking.
          // only happens where two already-fixed borders meet at a chunk corner with distant values.
          grid[ny]![nx] = new Set([current[0]!])
          queue.push([nx, ny])
          yield { x: nx, y: ny, candidates: [current[0]!] }
        } else if (after.size !== before.size) {
          grid[ny]![nx] = after
          queue.push([nx, ny])
          yield { x: nx, y: ny, candidates: [...after] }
        }
      }
    }
  }

  yield* drain()

  while (true) {
    let minEntropy = Infinity
    const candidates: Pos[] = []
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const n = grid[y]![x]!.size
        if (n <= 1) continue
        if (n < minEntropy) {
          minEntropy = n
          candidates.length = 0
          candidates.push([x, y])
        } else if (n === minEntropy) {
          candidates.push([x, y])
        }
      }
    }
    if (candidates.length === 0) break

    const [x, y] = candidates[Math.floor(rng() * candidates.length)]!
    const options = [...grid[y]![x]!]
    const totalWeight = options.reduce((sum, t) => sum + TILE_WEIGHTS[t]!, 0)
    let r = rng() * totalWeight
    let chosen = options[options.length - 1]!
    for (const t of options) {
      r -= TILE_WEIGHTS[t]!
      if (r <= 0) {
        chosen = t
        break
      }
    }
    grid[y]![x] = new Set([chosen])
    queue.push([x, y])
    yield { x, y, candidates: [chosen] }
    yield* drain()
  }

  return grid.map((row) => row.map((cell) => [...cell][0]!))
}

/** Synchronous convenience wrapper — runs every step immediately and returns the final grid. */
export function collapseChunk(size: number, seed: number, border: Border = {}): TileId[][] {
  const gen = collapseChunkSteps(size, seed, border)
  let result = gen.next()
  while (!result.done) result = gen.next()
  return result.value
}

export function edgeTiles(grid: TileId[][], side: 'top' | 'right' | 'bottom' | 'left'): TileId[] {
  const size = grid.length
  if (side === 'top') return grid[0]!.slice()
  if (side === 'bottom') return grid[size - 1]!.slice()
  if (side === 'left') return grid.map((row) => row[0]!)
  return grid.map((row) => row[size - 1]!)
}
