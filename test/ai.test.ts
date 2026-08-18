import { describe, expect, it, vi } from 'vitest'
import { World } from '../src/core/world.ts'
import type { Transform } from '../src/core/components.ts'
import type { Enemy } from '../src/components/index.ts'

// movement.ts가 모듈 최상단에서 window.addEventListener를 호출하므로,
// node 테스트 환경에서 ai.ts를 import하기 전에 window를 스텁해야 한다.
vi.stubGlobal('window', { addEventListener: () => {} })
const { createAiSystem } = await import('../src/systems/ai.ts')

const transform = (x: number, y: number): Transform => ({ x, y, scale: 1, rotation: 0 })

const baseEnemy = (overrides: Partial<Enemy> = {}): Enemy => ({
  speed: 80,
  detectRange: 250,
  windupRange: 120,
  windupDuration: 1,
  chargeSpeed: 260,
  chargeDistance: 180,
  phase: 'idle',
  windupTimer: 0,
  chargeDir: { x: 0, y: 0 },
  chargeRemaining: 0,
  lastSeen: null,
  ...overrides,
})

describe('ai - phase 전이', () => {
  it('windupRange 안에 들어오면 windup 상태로 전환하고 타이머를 채운다', () => {
    const world = new World()
    world.spawn({ transform: transform(0, 0), player: { walkSpeed: 100, runSpeed: 180 } })
    const enemy = world.spawn({ transform: transform(100, 0), enemy: baseEnemy({ phase: 'chase' }) })

    createAiSystem()(world, 0.016)

    const result = world.get<Enemy>(enemy, 'enemy')!
    expect(result.phase).toBe('windup')
    expect(result.windupTimer).toBeCloseTo(1)
  })

  it('windup 타이머가 소진되면 charge로 전환되며 그 순간 target 방향으로 chargeDir이 고정된다', () => {
    const world = new World()
    world.spawn({ transform: transform(0, 0), player: { walkSpeed: 100, runSpeed: 180 } })
    const enemy = world.spawn({
      transform: transform(100, 0),
      enemy: baseEnemy({ phase: 'windup', windupTimer: 0.01 }),
    })

    createAiSystem()(world, 0.5)

    const result = world.get<Enemy>(enemy, 'enemy')!
    expect(result.phase).toBe('charge')
    expect(result.chargeDir).toEqual({ x: -1, y: 0 })
    expect(result.chargeRemaining).toBe(180)
  })

  it('charge 중 chargeRemaining이 소진되면 chase로 복귀한다', () => {
    const world = new World()
    world.spawn({ transform: transform(1000, 0), player: { walkSpeed: 100, runSpeed: 180 } })
    const enemy = world.spawn({
      transform: transform(0, 0),
      enemy: baseEnemy({ phase: 'charge', chargeDir: { x: 1, y: 0 }, chargeRemaining: 5 }),
    })

    createAiSystem()(world, 1) // chargeSpeed(260) * dt(1) >> remaining(5)

    const result = world.get<Enemy>(enemy, 'enemy')!
    expect(result.phase).toBe('chase')
    expect(result.chargeRemaining).toBe(0)
  })

  it('detectRange를 넘어서면 idle로 전환된다', () => {
    const world = new World()
    world.spawn({ transform: transform(0, 0), player: { walkSpeed: 100, runSpeed: 180 } })
    const enemy = world.spawn({ transform: transform(9999, 0), enemy: baseEnemy({ phase: 'chase' }) })

    createAiSystem()(world, 0.016)

    expect(world.get<Enemy>(enemy, 'enemy')!.phase).toBe('idle')
  })

  it('detectRange 안, windupRange 밖이면 chase 상태를 유지한다', () => {
    const world = new World()
    world.spawn({ transform: transform(0, 0), player: { walkSpeed: 100, runSpeed: 180 } })
    const enemy = world.spawn({ transform: transform(200, 0), enemy: baseEnemy({ phase: 'idle' }) })

    createAiSystem()(world, 0.016)

    expect(world.get<Enemy>(enemy, 'enemy')!.phase).toBe('chase')
  })

  it('charge 진행 중에는 detectRange를 넘어서도 committed 상태가 유지된다', () => {
    const world = new World()
    world.spawn({ transform: transform(99999, 0), player: { walkSpeed: 100, runSpeed: 180 } })
    const enemy = world.spawn({
      transform: transform(0, 0),
      enemy: baseEnemy({ phase: 'charge', chargeDir: { x: 1, y: 0 }, chargeRemaining: 180 }),
    })

    createAiSystem()(world, 0.016)

    expect(world.get<Enemy>(enemy, 'enemy')!.phase).toBe('charge')
  })

  it('chase 중에는 target 위치를 lastSeen으로 기록한다', () => {
    const world = new World()
    world.spawn({ transform: transform(200, 0), player: { walkSpeed: 100, runSpeed: 180 } })
    const enemy = world.spawn({ transform: transform(0, 0), enemy: baseEnemy({ phase: 'chase' }) })

    createAiSystem()(world, 0.016)

    expect(world.get<Enemy>(enemy, 'enemy')!.lastSeen).toEqual({ x: 200, y: 0 })
  })

  it('detectRange를 넘어서도 lastSeen이 있으면 그 지점을 조사하러 이동한다', () => {
    const world = new World()
    world.spawn({ transform: transform(9999, 0), player: { walkSpeed: 100, runSpeed: 180 } })
    const enemy = world.spawn({
      transform: transform(0, 0),
      enemy: baseEnemy({ phase: 'chase', lastSeen: { x: 100, y: 0 } }),
    })

    createAiSystem()(world, 0.016)

    const result = world.get<Enemy>(enemy, 'enemy')!
    expect(result.phase).toBe('search')
    const t = world.get<Transform>(enemy, 'transform')!
    expect(t.x).toBeGreaterThan(0)
  })

  it('조사 지점에 도달하면 idle로 전환되고 lastSeen이 지워진다', () => {
    const world = new World()
    world.spawn({ transform: transform(9999, 0), player: { walkSpeed: 100, runSpeed: 180 } })
    const enemy = world.spawn({
      transform: transform(100, 0),
      enemy: baseEnemy({ phase: 'search', lastSeen: { x: 100, y: 0 } }),
    })

    createAiSystem()(world, 0.016)

    const result = world.get<Enemy>(enemy, 'enemy')!
    expect(result.phase).toBe('idle')
    expect(result.lastSeen).toBeNull()
  })
})
