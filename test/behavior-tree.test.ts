import { describe, expect, it } from 'vitest'
import { action, condition, sequence, selector } from '../src/core/behavior-tree.ts'
import type { Status } from '../src/core/behavior-tree.ts'

const node = (s: Status) => action<undefined>(() => s)

describe('behavior-tree - condition', () => {
  it('predicate가 참이면 success를 반환한다', () => {
    expect(condition<undefined>(() => true).tick(undefined)).toBe('success')
  })

  it('predicate가 거짓이면 failure를 반환한다', () => {
    expect(condition<undefined>(() => false).tick(undefined)).toBe('failure')
  })
})

describe('behavior-tree - sequence', () => {
  it('모든 자식이 success면 success를 반환한다', () => {
    expect(sequence(node('success'), node('success')).tick(undefined)).toBe('success')
  })

  it('자식 중 하나가 failure면 그 즉시 failure를 반환하고 이후 자식은 실행하지 않는다', () => {
    const calls: number[] = []
    const track = (s: Status, id: number) => action<undefined>(() => (calls.push(id), s))
    sequence(track('success', 1), track('failure', 2), track('success', 3)).tick(undefined)
    expect(calls).toEqual([1, 2])
  })

  it('자식 중 하나가 running이면 running을 반환한다', () => {
    expect(sequence(node('success'), node('running'), node('success')).tick(undefined)).toBe('running')
  })
})

describe('behavior-tree - selector', () => {
  it('모든 자식이 failure면 failure를 반환한다', () => {
    expect(selector(node('failure'), node('failure')).tick(undefined)).toBe('failure')
  })

  it('자식 중 하나가 success면 그 즉시 success를 반환하고 이후 자식은 실행하지 않는다', () => {
    const calls: number[] = []
    const track = (s: Status, id: number) => action<undefined>(() => (calls.push(id), s))
    selector(track('failure', 1), track('success', 2), track('failure', 3)).tick(undefined)
    expect(calls).toEqual([1, 2])
  })

  it('자식 중 하나가 running이면 running을 반환하고 이후 자식은 실행하지 않는다', () => {
    const calls: number[] = []
    const track = (s: Status, id: number) => action<undefined>(() => (calls.push(id), s))
    const result = selector(track('failure', 1), track('running', 2), track('success', 3)).tick(undefined)
    expect(result).toBe('running')
    expect(calls).toEqual([1, 2])
  })
})

describe('behavior-tree - 조합', () => {
  it('selector(sequence(condition, action), fallback) 형태로 우선순위 분기를 표현할 수 있다', () => {
    type Ctx = { hasTarget: boolean; attacked: boolean; idled: boolean }
    const attack = action<Ctx>((ctx) => {
      ctx.attacked = true
      return 'success'
    })
    const idle = action<Ctx>((ctx) => {
      ctx.idled = true
      return 'success'
    })
    const tree = selector(sequence(condition<Ctx>((c) => c.hasTarget), attack), idle)

    const withTarget: Ctx = { hasTarget: true, attacked: false, idled: false }
    tree.tick(withTarget)
    expect(withTarget).toEqual({ hasTarget: true, attacked: true, idled: false })

    const withoutTarget: Ctx = { hasTarget: false, attacked: false, idled: false }
    tree.tick(withoutTarget)
    expect(withoutTarget).toEqual({ hasTarget: false, attacked: false, idled: true })
  })
})
