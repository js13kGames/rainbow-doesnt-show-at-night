import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { World } from '../src/core/world.ts'
import type { Entity } from '../src/core/types.ts'

/**
 * requestAnimationFrame/performance.now을 결정론적으로 제어하기 위한 가짜 시계.
 * start()는 performance.now()를 한 번 읽고 requestAnimationFrame으로 다음 프레임을 예약한다.
 * advance(ms)는 시계를 ms만큼 전진시키고 예약된 프레임 콜백(World.tick)을 정확히 한 번 실행한다.
 */
function installFakeClock(startTime = 0) {
  let time = startTime
  let pending: FrameRequestCallback | null = null
  let cancelled = false

  vi.stubGlobal('performance', { now: () => time })
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    pending = cb
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', (_id: number) => {
    cancelled = true
    pending = null
  })

  return {
    get time() {
      return time
    },
    get isCancelled() {
      return cancelled
    },
    hasPendingFrame: () => pending !== null,
    /** 시계를 ms만큼 전진시키고 예약된 rAF 콜백을 실행한다 (= 프레임 한 번 진행). */
    advance(ms: number) {
      time += ms
      const cb = pending
      pending = null
      cb?.(time)
    },
  }
}

/**
 * dt는 프레임당 0.1초로 클램프되므로, 그보다 큰 시간을 흘려보내려면
 * 여러 프레임으로 쪼개서 진행해야 실제 누적 시간과 맞아떨어진다.
 */
function advanceInSteps(clock: ReturnType<typeof installFakeClock>, totalMs: number, stepMs = 100) {
  let remaining = totalMs
  while (remaining > 0) {
    const step = Math.min(stepMs, remaining)
    clock.advance(step)
    remaining -= step
  }
}

describe('World - entity lifecycle (spawn/despawn)', () => {
  it('spawn()은 컴포넌트 없이 엔티티를 생성할 수 있다', () => {
    const world = new World()
    const entity = world.spawn()
    expect(typeof entity).toBe('string')
    expect(entity.length).toBeGreaterThan(0)
  })

  it('spawn()은 전달된 모든 컴포넌트를 즉시 부착한다', () => {
    const world = new World()
    const entity = world.spawn({
      position: { x: 1, y: 2 },
      velocity: { x: 0, y: -1 },
    })
    expect(world.get(entity, 'position')).toEqual({ x: 1, y: 2 })
    expect(world.get(entity, 'velocity')).toEqual({ x: 0, y: -1 })
  })

  it('spawn()으로 만든 엔티티는 서로 고유하다', () => {
    const world = new World()
    const a = world.spawn()
    const b = world.spawn()
    expect(a).not.toBe(b)
  })

  it('despawn()은 모든 컴포넌트 스토어에서 엔티티를 제거한다', () => {
    const world = new World()
    const entity = world.spawn({ position: { x: 0, y: 0 }, hp: { value: 10 } })
    world.despawn(entity)
    expect(world.has(entity, 'position')).toBe(false)
    expect(world.has(entity, 'hp')).toBe(false)
    expect(world.get(entity, 'position')).toBeUndefined()
  })

  it('despawn()은 다른 엔티티의 컴포넌트에 영향을 주지 않는다', () => {
    const world = new World()
    const a = world.spawn({ position: { x: 1, y: 1 } })
    const b = world.spawn({ position: { x: 2, y: 2 } })
    world.despawn(a)
    expect(world.has(a, 'position')).toBe(false)
    expect(world.get(b, 'position')).toEqual({ x: 2, y: 2 })
  })

  it('컴포넌트가 하나도 없는 엔티티를 despawn해도 오류가 발생하지 않는다', () => {
    const world = new World()
    const entity = world.spawn()
    expect(() => world.despawn(entity)).not.toThrow()
  })

  it('존재한 적 없는 엔티티를 despawn해도 오류가 발생하지 않는다', () => {
    const world = new World()
    expect(() => world.despawn('ghost' as Entity)).not.toThrow()
  })
})

describe('World - component storage (add/get/has/remove)', () => {
  it('add()는 처음 보는 컴포넌트 타입에 대해 스토어를 새로 만든다', () => {
    const world = new World()
    const entity = world.spawn()
    world.add(entity, 'stunned', { duration: 3 })
    expect(world.get(entity, 'stunned')).toEqual({ duration: 3 })
  })

  it('add()는 같은 (entity, type)에 대해 기존 값을 덮어쓴다', () => {
    const world = new World()
    const entity = world.spawn()
    world.add(entity, 'hp', { value: 10 })
    world.add(entity, 'hp', { value: 5 })
    expect(world.get(entity, 'hp')).toEqual({ value: 5 })
  })

  it('get()은 컴포넌트가 없는 엔티티에 대해 undefined를 반환한다', () => {
    const world = new World()
    const entity = world.spawn()
    expect(world.get(entity, 'position')).toBeUndefined()
  })

  it('get()은 등록된 적 없는 컴포넌트 타입에 대해 undefined를 반환한다', () => {
    const world = new World()
    const entity = world.spawn()
    expect(world.get(entity, 'never-registered')).toBeUndefined()
  })

  it('has()는 컴포넌트 존재 여부를 정확히 반환한다', () => {
    const world = new World()
    const entity = world.spawn({ position: { x: 0, y: 0 } })
    expect(world.has(entity, 'position')).toBe(true)
    expect(world.has(entity, 'velocity')).toBe(false)
  })

  it('has()는 등록된 적 없는 컴포넌트 타입에 대해 false를 반환한다', () => {
    const world = new World()
    const entity = world.spawn()
    expect(world.has(entity, 'never-registered')).toBe(false)
  })

  it('remove()는 해당 컴포넌트만 제거하고 다른 컴포넌트는 유지한다', () => {
    const world = new World()
    const entity = world.spawn({ position: { x: 0, y: 0 }, poisoned: { duration: 5 } })
    world.remove(entity, 'poisoned')
    expect(world.has(entity, 'poisoned')).toBe(false)
    expect(world.has(entity, 'position')).toBe(true)
  })

  it('remove()는 존재하지 않는 (entity, type) 조합에 대해서도 오류 없이 동작한다', () => {
    const world = new World()
    const entity = world.spawn()
    expect(() => world.remove(entity, 'never-registered')).not.toThrow()
  })

  it('컴포넌트 값으로 falsy/원시값도 그대로 저장할 수 있다', () => {
    const world = new World()
    const entity = world.spawn()
    world.add(entity, 'count', 0)
    world.add(entity, 'flag', false)
    world.add(entity, 'label', '')
    expect(world.get(entity, 'count')).toBe(0)
    expect(world.get(entity, 'flag')).toBe(false)
    expect(world.get(entity, 'label')).toBe('')
    expect(world.has(entity, 'count')).toBe(true)
  })
})

describe('World - query', () => {
  it('타입을 하나도 넘기지 않으면 빈 배열을 반환한다', () => {
    const world = new World()
    world.spawn({ position: { x: 0, y: 0 } })
    expect(world.query()).toEqual([])
  })

  it('한 번도 등록되지 않은 컴포넌트 타입을 요청하면 빈 배열을 반환한다', () => {
    const world = new World()
    world.spawn({ position: { x: 0, y: 0 } })
    expect(world.query('nonexistent')).toEqual([])
  })

  it('단일 타입 쿼리는 해당 컴포넌트를 가진 모든 엔티티를 반환한다', () => {
    const world = new World()
    const a = world.spawn({ position: { x: 0, y: 0 } })
    const b = world.spawn({ position: { x: 1, y: 1 } })
    world.spawn({ velocity: { x: 0, y: 0 } }) // position 없음
    const result = world.query('position')
    expect(result.sort()).toEqual([a, b].sort())
  })

  it('다중 타입 쿼리는 모든 타입을 가진 엔티티만 교집합으로 반환한다', () => {
    const world = new World()
    const both = world.spawn({ position: { x: 0, y: 0 }, velocity: { x: 1, y: 1 } })
    world.spawn({ position: { x: 0, y: 0 } }) // velocity 없음
    world.spawn({ velocity: { x: 1, y: 1 } }) // position 없음
    expect(world.query('position', 'velocity')).toEqual([both])
  })

  it('요청한 타입 중 하나라도 스토어 자체가 없으면 빈 배열을 반환한다', () => {
    const world = new World()
    world.spawn({ position: { x: 0, y: 0 } })
    expect(world.query('position', 'never-registered')).toEqual([])
  })

  it('가장 작은 스토어를 앵커로 골라도 결과 정확도에는 영향이 없다 (앵커가 첫 인자가 아닌 경우)', () => {
    const world = new World()
    // 'common' 컴포넌트를 가진 엔티티를 다수 생성 (큰 스토어)
    const commonOnly: Entity[] = []
    for (let i = 0; i < 20; i++) {
      commonOnly.push(world.spawn({ common: { i } }))
    }
    // 'rare' 컴포넌트를 가진, common도 함께 가진 엔티티 하나만 생성 (작은 스토어)
    const target = world.spawn({ common: { i: -1 }, rare: { flag: true } })

    // 쿼리 인자 순서를 'common'을 먼저 둬도 rare(더 작은 스토어)가 앵커로 선택되어야 한다
    const result = world.query('common', 'rare')
    expect(result).toEqual([target])
    expect(commonOnly).not.toContain(result[0])
  })

  it('컴포넌트를 remove한 이후에는 쿼리 결과에서 제외된다', () => {
    const world = new World()
    const entity = world.spawn({ position: { x: 0, y: 0 }, stunned: { duration: 1 } })
    world.remove(entity, 'stunned')
    expect(world.query('position', 'stunned')).toEqual([])
    expect(world.query('position')).toEqual([entity])
  })

  it('despawn된 엔티티는 쿼리 결과에서 제외된다', () => {
    const world = new World()
    const entity = world.spawn({ position: { x: 0, y: 0 } })
    world.despawn(entity)
    expect(world.query('position')).toEqual([])
  })
})

describe('World - events (on/emit)', () => {
  it('emit()은 등록된 리스너를 등록 순서대로 호출한다', () => {
    const world = new World()
    const calls: number[] = []
    world.on('hit', () => calls.push(1))
    world.on('hit', () => calls.push(2))
    world.on('hit', () => calls.push(3))
    world.emit('hit')
    expect(calls).toEqual([1, 2, 3])
  })

  it('emit()은 인자를 그대로 리스너에 전달한다', () => {
    const world = new World()
    const entity = world.spawn()
    const received: unknown[] = []
    world.on('hit', (e: Entity, dmg: number) => received.push([e, dmg]))
    world.emit('hit', entity, 10)
    expect(received).toEqual([[entity, 10]])
  })

  it('리스너가 없는 이벤트를 emit해도 오류가 발생하지 않는다', () => {
    const world = new World()
    expect(() => world.emit('nothing-listens-here')).not.toThrow()
  })

  it('서로 다른 이벤트 타입의 리스너는 독립적으로 동작한다', () => {
    const world = new World()
    const hitCalls: unknown[] = []
    const healCalls: unknown[] = []
    world.on('hit', () => hitCalls.push('hit'))
    world.on('heal', () => healCalls.push('heal'))
    world.emit('hit')
    expect(hitCalls).toEqual(['hit'])
    expect(healCalls).toEqual([])
  })

  it('emit은 동기적으로 처리된다 (큐잉되지 않는다)', () => {
    const world = new World()
    let calledSynchronously = false
    world.on('sync-check', () => {
      calledSynchronously = true
    })
    world.emit('sync-check')
    // 마이크로태스크/매크로태스크를 기다리지 않고 즉시 true여야 한다
    expect(calledSynchronously).toBe(true)
  })

  it('같은 콜백을 여러 번 on()으로 등록하면 emit 시 여러 번 호출된다', () => {
    const world = new World()
    const fn = vi.fn()
    world.on('dup', fn)
    world.on('dup', fn)
    world.emit('dup')
    expect(fn).toHaveBeenCalledTimes(2)
  })
})

describe('World - systems', () => {
  it('addSystem으로 등록한 시스템은 등록 순서대로 실행된다', () => {
    const world = new World()
    const order: number[] = []
    world.addSystem(() => order.push(1))
    world.addSystem(() => order.push(2))
    world.addSystem(() => order.push(3))

    const clock = installFakeClock(0)
    world.start()
    clock.advance(16)

    expect(order).toEqual([1, 2, 3])
  })

  it('시스템은 매 프레임마다 (world, dt)를 인자로 받는다', () => {
    const world = new World()
    const received: [World, number][] = []
    world.addSystem((w, dt) => received.push([w, dt]))

    const clock = installFakeClock(1000)
    world.start()
    clock.advance(250) // 250ms 경과 -> dt는 0.1로 클램프되어야 함

    expect(received).toHaveLength(1)
    expect(received[0]![0]).toBe(world)
    expect(received[0]![1]).toBeCloseTo(0.1)
  })

  it('시스템은 프레임마다 반복 실행된다', () => {
    const world = new World()
    let count = 0
    world.addSystem(() => count++)

    const clock = installFakeClock(0)
    world.start()
    clock.advance(16)
    clock.advance(16)
    clock.advance(16)

    expect(count).toBe(3)
  })
})

describe('World - loop / dt 처리 (start/stop/tick)', () => {
  it('dt는 (now - last)/1000 초 단위로 계산된다', () => {
    const world = new World()
    let capturedDt = -1
    world.addSystem((_w, dt) => (capturedDt = dt))

    const clock = installFakeClock(0)
    world.start()
    clock.advance(50) // 50ms

    expect(capturedDt).toBeCloseTo(0.05)
  })

  it('dt는 0.1초를 넘지 않도록 클램프된다 (스파이럴 오브 데스 방지)', () => {
    const world = new World()
    const dts: number[] = []
    world.addSystem((_w, dt) => dts.push(dt))

    const clock = installFakeClock(0)
    world.start()
    clock.advance(5000) // 탭이 백그라운드에 있다가 돌아온 것처럼 큰 점프

    expect(dts).toEqual([0.1])
  })

  it('stop()은 다음 프레임 예약을 취소한다', () => {
    const world = new World()
    let count = 0
    world.addSystem(() => count++)

    const clock = installFakeClock(0)
    world.start()
    clock.advance(16)
    expect(count).toBe(1)
    expect(clock.hasPendingFrame()).toBe(true)

    world.stop()
    expect(clock.isCancelled).toBe(true)
    expect(clock.hasPendingFrame()).toBe(false)
  })

  it('start()는 매 tick마다 다음 프레임을 스스로 재예약한다', () => {
    const world = new World()
    const clock = installFakeClock(0)
    world.start()
    expect(clock.hasPendingFrame()).toBe(true)
    clock.advance(16)
    expect(clock.hasPendingFrame()).toBe(true)
  })
})

describe('World - timers', () => {
  let clock: ReturnType<typeof installFakeClock>

  beforeEach(() => {
    clock = installFakeClock(0)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('delay에 도달하기 전에는 콜백이 호출되지 않는다', () => {
    const world = new World()
    const cb = vi.fn()
    world.setTimer(1, cb)
    world.start()
    advanceInSteps(clock, 500) // 0.5s < 1s, dt 클램프(0.1s) 감안해 여러 프레임으로 진행

    expect(cb).not.toHaveBeenCalled()
  })

  it('단발성(repeat=false) 타이머는 delay 도달 시 정확히 한 번 호출된다', () => {
    const world = new World()
    const cb = vi.fn()
    world.setTimer(1, cb) // repeat 기본값 false
    world.start()

    advanceInSteps(clock, 600) // 0.6s
    expect(cb).not.toHaveBeenCalled()
    advanceInSteps(clock, 500) // 누적 1.1s -> 발동 (부동소수점 오차 대비 여유분 포함)
    expect(cb).toHaveBeenCalledTimes(1)

    advanceInSteps(clock, 1000) // 이후 더 지나도 다시 호출되지 않아야 함
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('반복(repeat=true) 타이머는 delay마다 계속 호출된다', () => {
    const world = new World()
    const cb = vi.fn()
    world.setTimer(1, cb, true)
    world.start()

    advanceInSteps(clock, 1050) // 1s + 여유분(부동소수점 누적 오차 대비)
    expect(cb).toHaveBeenCalledTimes(1)
    advanceInSteps(clock, 1000)
    expect(cb).toHaveBeenCalledTimes(2)
    advanceInSteps(clock, 1000)
    expect(cb).toHaveBeenCalledTimes(3)
  })

  it('반복 타이머는 초과분(overflow)을 다음 주기로 이월한다', () => {
    const world = new World()
    const cb = vi.fn()
    world.setTimer(1, cb, true)
    world.start()

    // dt 클램프(0.1s) 때문에 여러 프레임으로 나눠 누적시켜 delay를 두 번 넘긴다
    advanceInSteps(clock, 2450) // 1s, 2s 두 번 발동, 0.45s는 다음 주기로 이월

    expect(cb).toHaveBeenCalledTimes(2)

    advanceInSteps(clock, 600) // 남은 이월분을 채워 3번째 발동
    expect(cb).toHaveBeenCalledTimes(3)
  })

  it('서로 다른 타이머는 독립적인 스케줄로 동작한다', () => {
    const world = new World()
    const fast = vi.fn()
    const slow = vi.fn()
    world.setTimer(1, fast, true)
    world.setTimer(3, slow, true)
    world.start()

    advanceInSteps(clock, 1050) // 총 ~1.05s
    expect(fast).toHaveBeenCalledTimes(1)
    expect(slow).toHaveBeenCalledTimes(0)

    advanceInSteps(clock, 2050) // 누적 총 ~3.1s
    expect(fast).toHaveBeenCalledTimes(3)
    expect(slow).toHaveBeenCalledTimes(1)
  })

  it('setTimer는 start() 이전에 등록해도 루프 시작 후 정상 동작한다', () => {
    const world = new World()
    const cb = vi.fn()
    world.setTimer(0.5, cb)
    world.start()
    advanceInSteps(clock, 550)
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('setTimer는 start() 이후에도 등록 가능하며 다음 프레임부터 카운트된다', () => {
    const world = new World()
    world.start()
    advanceInSteps(clock, 500) // 워밍업 프레임

    const cb = vi.fn()
    world.setTimer(0.2, cb)
    clock.advance(100) // 0.1s < 0.2s
    expect(cb).not.toHaveBeenCalled()
    clock.advance(200) // 누적 0.3s >= 0.2s
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('delay가 0인 타이머는 다음 tick에서 즉시 발동한다', () => {
    const world = new World()
    const cb = vi.fn()
    world.setTimer(0, cb)
    world.start()
    clock.advance(0)
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('콜백 안에서 world를 조작해도(엔티티 spawn 등) 안전하게 동작한다', () => {
    const world = new World()
    let spawned: Entity | undefined
    world.setTimer(0.1, () => {
      spawned = world.spawn({ position: { x: 0, y: 0 } })
    })
    world.start()
    clock.advance(100)

    expect(spawned).toBeDefined()
    expect(world.has(spawned!, 'position')).toBe(true)
  })
})

describe('World - 통합 시나리오', () => {
  it('시스템이 컴포넌트를 읽고 순수 함수로 다음 상태를 계산해 다시 기록하는 흐름이 정상 동작한다', () => {
    type Stunned = { duration: number }
    const tickStunned = (s: Stunned, dt: number): Stunned => ({
      duration: Math.max(0, s.duration - dt),
    })

    const world = new World()
    const entity = world.spawn({ stunned: { duration: 0.25 } })

    world.addSystem((w, dt) => {
      w.query('stunned')
        .map((e) => [e, w.get<Stunned>(e, 'stunned')!] as const)
        .filter(([, s]) => s.duration > 0)
        .forEach(([e, s]) => w.add(e, 'stunned', tickStunned(s, dt)))
    })

    const clock = installFakeClock(0)
    world.start()
    clock.advance(100) // dt=0.1 -> duration 0.25 -> 0.15
    expect(world.get<Stunned>(entity, 'stunned')!.duration).toBeCloseTo(0.15)

    clock.advance(100) // dt=0.1 -> 0.15 -> 0.05
    expect(world.get<Stunned>(entity, 'stunned')!.duration).toBeCloseTo(0.05)

    clock.advance(100) // dt=0.1 -> filter는 갱신 전 duration(0.05>0)을 기준으로 판단하므로 한 번 더 감소해 0으로 클램프된다
    expect(world.get<Stunned>(entity, 'stunned')!.duration).toBe(0)

    clock.advance(100) // duration이 0이 되면 filter(duration > 0)에 의해 더 이상 갱신되지 않는다
    expect(world.get<Stunned>(entity, 'stunned')!.duration).toBe(0)
  })

  it('타이머 콜백이 이벤트를 emit하고, 이를 시스템이 구독한 상태와 함께 동작한다', () => {
    const world = new World()
    const entity = world.spawn({ hp: { value: 10 } })

    world.on('hit', (e: Entity, dmg: number) => {
      const hp = world.get<{ value: number }>(e, 'hp')!
      world.add(e, 'hp', { value: hp.value - dmg })
    })

    world.setTimer(0.1, () => world.emit('hit', entity, 3))

    const clock = installFakeClock(0)
    world.start()
    clock.advance(100)

    expect(world.get<{ value: number }>(entity, 'hp')!.value).toBe(7)
  })
})
