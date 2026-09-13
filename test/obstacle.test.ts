import { describe, it, expect } from 'vitest'
import { patrolOffset, overlaps } from '../src/systems/obstacle.ts'

describe('patrolOffset', () => {
  it('stays within [-range, range]', () => {
    for (let t = 0; t < 20; t += 0.1) {
      const off = patrolOffset(t, 5)
      expect(off).toBeGreaterThanOrEqual(-5)
      expect(off).toBeLessThanOrEqual(5)
    }
  })

  it('starts at the center', () => {
    expect(patrolOffset(0, 5)).toBe(0)
  })
})

describe('overlaps', () => {
  it('is true when the point is inside the tile-sized box', () => {
    expect(overlaps(100, 100, 100, 100)).toBe(true)
  })

  it('is false once the point clears the box', () => {
    expect(overlaps(1000, 100, 100, 100)).toBe(false)
  })
})
