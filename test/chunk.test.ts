import { describe, expect, it } from 'vitest'
import { World } from '../src/core/world.ts'
import { CHUNK_PX, createChunkStreamSystem, ensureChunk, getChunkGrid, stepChunks, unloadChunk } from '../src/core/chunk.ts'
import { edgeTiles } from '../src/core/wfc.ts'
import type { Sprite } from '../src/core/components.ts'

describe('ensureChunk / stepChunks', () => {
  it('generates a chunk whose east edge matches its eastern neighbor west edge', () => {
    const world = new World()
    const seed = 42
    // unique chunk coordinates so this test doesn't collide with the module-level cache used elsewhere
    ensureChunk(world, seed, 10, 10)
    stepChunks(world, 999) // large dt fast-forwards the whole collapse in one call
    ensureChunk(world, seed, 11, 10)
    stepChunks(world, 999)

    const west = getChunkGrid(10, 10)!
    const east = getChunkGrid(11, 10)!
    expect(edgeTiles(west, 'right')).toEqual(edgeTiles(east, 'left'))
  })

  it('spawns entities immediately but only finalizes the grid once fully stepped', () => {
    const world = new World()
    const seed = 7
    ensureChunk(world, seed, 30, 30)
    const before = world.query('transform', 'sprite').length
    expect(before).toBeGreaterThan(0)
    expect(getChunkGrid(30, 30)).toBeUndefined()

    stepChunks(world, 999)
    expect(getChunkGrid(30, 30)).toBeDefined()
    expect(world.query('transform', 'sprite').length).toBe(before)
  })

  it('despawns tile entities on unload but keeps the finished grid cached for reuse', () => {
    const world = new World()
    const seed = 5
    ensureChunk(world, seed, 20, 20)
    stepChunks(world, 999)
    const before = world.query('transform', 'sprite').length
    expect(before).toBeGreaterThan(0)

    unloadChunk(world, 20, 20)
    expect(world.query('transform', 'sprite').length).toBe(0)

    const cachedGrid = getChunkGrid(20, 20)
    ensureChunk(world, seed, 20, 20)
    expect(world.query('transform', 'sprite').length).toBe(before)
    expect(getChunkGrid(20, 20)).toBe(cachedGrid)
  })
})

describe('createChunkStreamSystem', () => {
  it('loads chunks around the player and unloads distant ones as they move', () => {
    const world = new World()
    world.spawn({
      transform: { x: 30 * CHUNK_PX, y: 0, scale: 1, rotation: 0 },
      sprite: { r: 20, flip: 1, cell: { x: 1, y: 0 } } satisfies Sprite,
      player: { walkSpeed: 100, runSpeed: 180 },
    })

    const system = createChunkStreamSystem(1)
    system(world, 999)
    const initialCount = world.query('transform', 'sprite').length
    expect(initialCount).toBeGreaterThan(0)

    const playerEntity = world.query('player', 'transform')[0]!
    world.add(playerEntity, 'transform', { x: 40 * CHUNK_PX, y: 0, scale: 1, rotation: 0 })
    system(world, 999)

    // player moved far enough that none of the originally-loaded chunks remain in range
    expect(world.query('transform', 'sprite').length).toBe(initialCount)
  })
})
