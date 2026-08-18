import { describe, expect, it } from 'vitest'
import { applyAimAssist } from '../src/systems/aim-assist.ts'

const player = { x: 0, y: 0 }

describe('applyAimAssist', () => {
  it('적이 없으면 raw 각도를 그대로 반환한다', () => {
    expect(applyAimAssist(0.1, player, [])).toBe(0.1)
  })

  it('콘 밖에 있는 적은 무시한다', () => {
    const rawAngle = 0
    const target = { x: Math.cos(2), y: Math.sin(2) } // ~114도, 콘(0.35rad)보다 훨씬 밖
    expect(applyAimAssist(rawAngle, player, [target])).toBe(rawAngle)
  })

  it('콘 안의 적 쪽으로 raw보다 더 가깝게 보정한다', () => {
    const targetAngle = 0.2
    const target = { x: Math.cos(targetAngle) * 100, y: Math.sin(targetAngle) * 100 }
    const rawAngle = 0
    const corrected = applyAimAssist(rawAngle, player, [target])
    expect(Math.abs(corrected - targetAngle)).toBeLessThan(Math.abs(rawAngle - targetAngle))
  })

  it('사거리(300) 밖의 적은 무시한다', () => {
    const rawAngle = 0
    const target = { x: 500, y: 0 }
    expect(applyAimAssist(rawAngle, player, [target])).toBe(rawAngle)
  })
})
