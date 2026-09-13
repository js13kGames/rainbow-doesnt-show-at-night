import { player, resetSwitches, respawnKeys } from '../state.ts'
import { startFade } from './fade.ts'
import { play, SND_LAND, SND_DEATH } from './sound.ts'

const AMPLITUDE = 0.9
const DECAY = 10 // 1/s
const FREQ = 15 // rad/s
const CUTOFF = 0.6 // s
const DEATH_FADE = 1 // s — quick fade for a fall-death respawn, vs the portal's longer one

export function onLand() {
  if (player.sq) return
  player.sq = { t: 0, base: player.r2 }
  play(...SND_LAND)
}

// death respawn: fell off the map, night toggle removed the ground, or an obstacle hit the
// player. A quick fade to black, snap back to the stage's spawn point, fade back in. `dir`
// picks which way the shrinking sprite moves as it fades out — down (fall) or up (knockback)
export function respawnPlayer(x: number, y: number, dir: 1 | -1 = 1) {
  play(...SND_DEATH)
  startFade(
    DEATH_FADE,
    () => {
      player.x = x
      player.y = y
      resetSwitches()
      respawnKeys()
      onLand()
    },
    true, // shrink the sprite out as it fades, then grow back in on respawn
    dir,
  )
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
