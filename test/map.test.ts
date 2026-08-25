import { describe, expect, it } from 'vitest'
import { STAGE_1, TILE_GRASS, TILE_DIRT, TILE_W, GRID_H, isWalkableBox } from '../src/components/map.ts'

describe('deriveTiles', () => {
  it('grows the grid downward and marks unsupported walkable tiles as dirt', () => {
    // STAGE_1.day row 4 is the floor ('1111111111') with nothing below it in the authoring
    // format, so deriveTiles must append a dirt row beneath it
    const floorRow = STAGE_1.day[4]!
    const dirtRow = STAGE_1.day[5]!
    expect(floorRow.every((v) => v === TILE_GRASS)).toBe(true)
    expect(dirtRow.every((v) => v === TILE_DIRT)).toBe(true)
  })
})

describe('isWalkableBox', () => {
  it('is walkable on a grass tile and not on a dirt tile', () => {
    const grassX = 0 * TILE_W + TILE_W / 2
    const grassY = 4 * GRID_H + GRID_H / 2
    expect(isWalkableBox(STAGE_1.day, grassX, grassY, 0, 0)).toBe(true)

    const dirtY = 5 * GRID_H + GRID_H / 2
    expect(isWalkableBox(STAGE_1.day, grassX, dirtY, 0, 0)).toBe(false)
  })

  it('rejects a point outside the map', () => {
    expect(isWalkableBox(STAGE_1.day, -100, -100, 0, 0)).toBe(false)
  })
})
