import { describe, expect, it } from 'vitest'
import { collapseChunk, collapseChunkSteps, compatible, edgeTiles } from '../src/core/wfc.ts'

describe('compatible', () => {
  it('allows adjacent or equal tiles', () => {
    expect(compatible(0, 1)).toBe(true)
    expect(compatible(2, 2)).toBe(true)
  })

  it('rejects distant tiles', () => {
    expect(compatible(0, 2)).toBe(false)
    expect(compatible(0, 3)).toBe(false)
  })
})

describe('collapseChunk', () => {
  it('is deterministic for the same seed and border', () => {
    const a = collapseChunk(8, 42)
    const b = collapseChunk(8, 42)
    expect(a).toEqual(b)
  })

  it('produces a fully collapsed grid with only compatible neighbors', () => {
    const grid = collapseChunk(8, 7)
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        expect(grid[y]![x]).toBeGreaterThanOrEqual(0)
        expect(grid[y]![x]).toBeLessThanOrEqual(3)
        if (x < 7) expect(compatible(grid[y]![x]!, grid[y]![x + 1]!)).toBe(true)
        if (y < 7) expect(compatible(grid[y]![x]!, grid[y + 1]![x]!)).toBe(true)
      }
    }
  })

  it('keeps fixed border tiles', () => {
    const top = [0, 1, 1, 2, 2, 3, 3, 3]
    const grid = collapseChunk(8, 3, { top })
    expect(grid[0]).toEqual(top)
  })
})

describe('collapseChunkSteps', () => {
  it('touches every cell at least once and the final grid matches collapseChunk', () => {
    const seed = 11
    const expected = collapseChunk(8, seed)

    const gen = collapseChunkSteps(8, seed)
    const seen = new Set<string>()
    let result = gen.next()
    while (!result.done) {
      seen.add(`${result.value.x},${result.value.y}`)
      result = gen.next()
    }

    expect(seen.size).toBe(64)
    expect(result.value).toEqual(expected)
  })

  it('narrows candidates gradually before resolving to a single tile', () => {
    const gen = collapseChunkSteps(8, 3)
    const sawNarrowing = { current: false }
    const finalCandidates = new Map<string, number[]>()
    let result = gen.next()
    while (!result.done) {
      const { x, y, candidates } = result.value
      if (candidates.length > 1) sawNarrowing.current = true
      finalCandidates.set(`${x},${y}`, candidates)
      result = gen.next()
    }

    expect(sawNarrowing.current).toBe(true)
    for (const candidates of finalCandidates.values()) expect(candidates.length).toBe(1)
  })
})

describe('edgeTiles', () => {
  const grid = [
    [0, 1],
    [2, 3],
  ]

  it('extracts each side correctly', () => {
    expect(edgeTiles(grid, 'top')).toEqual([0, 1])
    expect(edgeTiles(grid, 'bottom')).toEqual([2, 3])
    expect(edgeTiles(grid, 'left')).toEqual([0, 2])
    expect(edgeTiles(grid, 'right')).toEqual([1, 3])
  })
})
