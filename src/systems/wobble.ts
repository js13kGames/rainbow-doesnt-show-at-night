import type { System } from '../core/types.ts'
import type { Transform, Sprite } from '../core/components.ts'
import type { Wobble } from '../components/index.ts'

const MAX_ANGLE = (10 * Math.PI) / 180
const FREQ = 40 // rad/s while moving
const IDLE_ANGLE = (2 * Math.PI) / 180
const IDLE_STEP = 0.15 // s per frame while idle
// distinct per-frame distortion (rotation, vertical squish) for a chunkier, pixel-art idle wiggle
const IDLE_FRAMES = [
  { rot: -IDLE_ANGLE, sy: 0.96 },
  { rot: 0, sy: 1 },
  { rot: IDLE_ANGLE, sy: 1.04 },
  { rot: 0, sy: 1 },
]

let time = 0

function idleFrame(time: number): { rot: number; sy: number } {
  return IDLE_FRAMES[Math.floor(time / IDLE_STEP) % IDLE_FRAMES.length]
}

export function createWobbleSystem(): System {
  return (world, dt) => {
    time += dt
    world.query('transform', 'sprite', 'wobble').forEach((e) => {
      const t = world.get<Transform>(e, 'transform')!
      const s = world.get<Sprite>(e, 'sprite')!
      const w = world.get<Wobble>(e, 'wobble')!
      const dx = t.x - w.prevX
      const moving = dx !== 0 || t.y !== w.prevY
      const frame = idleFrame(time)
      const r2 = moving ? s.r : s.r * frame.sy
      world.add(e, 'transform', {
        ...t,
        rotation: moving ? Math.sin(time * FREQ) * MAX_ANGLE : frame.rot,
      })
      world.add(e, 'sprite', { ...s, flip: dx !== 0 ? Math.sign(dx) : s.flip, r2, oy: s.r - r2 })
      world.add(e, 'wobble', { prevX: t.x, prevY: t.y })
    })
  }
}
