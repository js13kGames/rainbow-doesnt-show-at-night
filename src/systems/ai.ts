import type { World } from '../core/world.ts'
import type { Entity, System } from '../core/types.ts'
import type { Transform } from '../core/components.ts'
import type { Enemy, EnemyPhase } from '../components/index.ts'
import { type Node, action, condition, createBtSystem, selector, sequence } from '../core/behavior-tree.ts'
import { moveTransform } from './movement.ts'

export type AiCtx = {
  dt: number
  self: Transform
  target: Transform | null
  enemy: Enemy
  out: { transform: Transform; enemy: Enemy }
}

const dist = (a: Transform, b: Transform) => Math.hypot(a.x - b.x, a.y - b.y)

const isPhase = (p: EnemyPhase) => (ctx: AiCtx) => ctx.enemy.phase === p
const inWindupRange = (ctx: AiCtx) => ctx.target !== null && dist(ctx.self, ctx.target) <= ctx.enemy.windupRange
const inDetectRange = (ctx: AiCtx) => ctx.target !== null && dist(ctx.self, ctx.target) <= ctx.enemy.detectRange
const hasLastSeen = (ctx: AiCtx) => ctx.enemy.lastSeen !== null

const arriveThreshold = 8

const startWindup: Node<AiCtx> = action((ctx) => {
  ctx.out.enemy = { ...ctx.enemy, phase: 'windup', windupTimer: ctx.enemy.windupDuration }
  return 'success'
})

const continueWindup: Node<AiCtx> = action((ctx) => {
  const timer = ctx.enemy.windupTimer - ctx.dt
  if (timer > 0) {
    ctx.out.enemy = { ...ctx.enemy, windupTimer: timer }
    return 'success'
  }
  const target = ctx.target
  const dx = target ? target.x - ctx.self.x : 1
  const dy = target ? target.y - ctx.self.y : 0
  const len = Math.hypot(dx, dy) || 1
  ctx.out.enemy = {
    ...ctx.enemy,
    phase: 'charge',
    windupTimer: 0,
    chargeDir: { x: dx / len, y: dy / len },
    chargeRemaining: ctx.enemy.chargeDistance,
  }
  return 'success'
})

const continueCharge: Node<AiCtx> = action((ctx) => {
  const step = Math.min(ctx.enemy.chargeSpeed * ctx.dt, ctx.enemy.chargeRemaining)
  ctx.out.transform = moveTransform(ctx.self, ctx.enemy.chargeDir.x, ctx.enemy.chargeDir.y, ctx.enemy.chargeSpeed, ctx.dt)
  const remaining = ctx.enemy.chargeRemaining - step
  ctx.out.enemy = remaining > 0 ? { ...ctx.enemy, chargeRemaining: remaining } : { ...ctx.enemy, phase: 'chase', chargeRemaining: 0 }
  return 'success'
})

const chase: Node<AiCtx> = action((ctx) => {
  const target = ctx.target!
  const dx = target.x - ctx.self.x
  const dy = target.y - ctx.self.y
  const len = Math.hypot(dx, dy) || 1
  ctx.out.transform = moveTransform(ctx.self, dx / len, dy / len, ctx.enemy.speed, ctx.dt)
  ctx.out.enemy = { ...ctx.enemy, phase: 'chase', lastSeen: { x: target.x, y: target.y } }
  return 'success'
})

const search: Node<AiCtx> = action((ctx) => {
  const spot = ctx.enemy.lastSeen!
  const dx = spot.x - ctx.self.x
  const dy = spot.y - ctx.self.y
  const len = Math.hypot(dx, dy)
  if (len <= arriveThreshold) {
    ctx.out.enemy = { ...ctx.enemy, phase: 'idle', lastSeen: null }
    return 'success'
  }
  ctx.out.transform = moveTransform(ctx.self, dx / len, dy / len, ctx.enemy.speed, ctx.dt)
  ctx.out.enemy = { ...ctx.enemy, phase: 'search' }
  return 'success'
})

const idle: Node<AiCtx> = action((ctx) => {
  ctx.out.enemy = { ...ctx.enemy, phase: 'idle' }
  return 'success'
})

const enemyTree: Node<AiCtx> = selector(
  sequence(condition(isPhase('charge')), continueCharge),
  sequence(condition(isPhase('windup')), continueWindup),
  sequence(condition(inWindupRange), startWindup),
  sequence(condition(inDetectRange), chase),
  sequence(condition(hasLastSeen), search),
  idle,
)

function buildAiCtx(world: World, e: Entity, dt: number): AiCtx {
  const self = world.get<Transform>(e, 'transform')!
  const enemy = world.get<Enemy>(e, 'enemy')!
  const player = world.query('player')[0]
  const target = player ? world.get<Transform>(player, 'transform')! : null
  return { dt, self, target, enemy, out: { transform: self, enemy } }
}

function writeAiOut(world: World, e: Entity, ctx: AiCtx) {
  world.add(e, 'transform', ctx.out.transform)
  world.add(e, 'enemy', ctx.out.enemy)
}

export function createAiSystem(): System {
  return createBtSystem<AiCtx>(['transform', 'enemy'], buildAiCtx, enemyTree, writeAiOut)
}
