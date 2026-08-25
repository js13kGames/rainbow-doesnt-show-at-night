import { player } from '../state.ts'

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

function idleFrame(t: number) {
  return IDLE_FRAMES[Math.floor(t / IDLE_STEP) % IDLE_FRAMES.length]
}

export function updateWobble(dt: number) {
  time += dt
  const dx = player.x - player.wpx
  const moving = dx !== 0 || player.y !== player.wpy
  const frame = idleFrame(time)
  const r2 = moving ? player.r : player.r * frame.sy
  player.rotation = moving ? Math.sin(time * FREQ) * MAX_ANGLE : frame.rot
  if (dx !== 0) player.flip = Math.sign(dx)
  player.r2 = r2
  player.oy = player.r - r2
  player.wpx = player.x
  player.wpy = player.y
}
