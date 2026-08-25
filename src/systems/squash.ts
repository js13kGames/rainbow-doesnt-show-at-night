import { player } from '../state.ts'

const AMPLITUDE = 0.9
const DECAY = 10 // 1/s
const FREQ = 15 // rad/s
const CUTOFF = 0.6 // s

export function onLand() {
  if (player.sq) return
  player.sq = { t: 0, base: player.r2 }
}

export function updateSquash(dt: number) {
  const sq = player.sq
  if (!sq) return
  sq.t += dt
  if (sq.t >= CUTOFF) {
    player.r2 = sq.base
    player.oy = 0
    player.sq = null
    return
  }
  const r2 = sq.base * (1 - AMPLITUDE * Math.exp(-DECAY * sq.t) * Math.cos(FREQ * sq.t))
  // feet stay planted: shrink toward the bottom instead of the sprite center
  player.r2 = r2
  player.oy = sq.base - r2
}
