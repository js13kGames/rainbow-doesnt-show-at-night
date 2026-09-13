import { describe, expect, it } from 'vitest'
import { charCell, pushText } from '../src/components/text.ts'

describe('charCell', () => {
  it('addresses the first row (A-L)', () => {
    expect(charCell('A')).toEqual({ x: 1, y: 3, w: 3 / 16, h: 5 / 16 })
    expect(charCell('L')).toEqual({ x: 60 / 16, y: 3, w: 3 / 16, h: 5 / 16 })
  })

  it('addresses the second row (M-X)', () => {
    expect(charCell('M')).toEqual({ x: 1, y: 53 / 16, w: 3 / 16, h: 5 / 16 })
  })

  it('addresses the third row (Y-Z) and is case-insensitive', () => {
    expect(charCell('z')).toEqual({ x: 20 / 16, y: 58 / 16, w: 3 / 16, h: 5 / 16 })
  })

  it('returns undefined for unsupported characters', () => {
    expect(charCell(' ')).toBeUndefined()
    expect(charCell('1')).toBeUndefined()
  })
})

describe('pushText', () => {
  it('skips unsupported chars but still advances the cursor', () => {
    const sprites: { x: number; y: number; r: number; r2?: number; cell?: unknown }[] = []
    pushText(sprites, 'AB C', 0, 0, 2.5, 1)
    expect(sprites.length).toBe(3)
    const gw = 3 * 2.5
    expect(sprites[1]!.x).toBeCloseTo(gw + gw / 2 + 1 * 2.5)
  })
})
