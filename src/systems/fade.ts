// generic fade-to-black-and-back timer: ramps 0->1 over the first half of `duration`,
// runs `cb` at the midpoint (screen is fully black), then ramps 1->0 over the second half.
// shared by the portal's stage transition and the player's fall-death respawn.
export let fade = 0
// true only during a fall-death fade (see squash.ts) — the player sprite shrinks with `fade`
// instead of the portal's plain black-screen transition
export let shrinkPlayer = false
// which way the shrinking sprite moves while it fades: 1 = sinks down (falling off the map),
// -1 = flies up (knocked away by an obstacle)
export let deathDir = 1
let t = -1 // -1 = idle
let half = 0
let swapped = false
let cb = () => {}

export const isFading = () => t >= 0

export function startFade(duration: number, onMidpoint: () => void, shrink = false, dir = 1) {
  if (t >= 0) return // ignore while already fading
  t = 0
  half = duration / 2
  swapped = false
  cb = onMidpoint
  shrinkPlayer = shrink
  deathDir = dir
}

export function updateFade(dt: number) {
  if (t < 0) return
  t += dt
  fade = t < half ? t / half : Math.max(0, 1 - (t - half) / half)
  if (!swapped && t >= half) {
    swapped = true
    cb()
  }
  if (t >= half * 2) {
    t = -1
    shrinkPlayer = false
  }
}
