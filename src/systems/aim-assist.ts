const AIM_ASSIST_RANGE = 600
const AIM_ASSIST_CONE = 0.5
const AIM_ASSIST_STRENGTH = 0.85

export function angleDiff(a: number, b: number): number {
  const d = ((b - a + Math.PI) % (2 * Math.PI)) - Math.PI
  return d < -Math.PI ? d + 2 * Math.PI : d
}

const smoothstep = (t: number) => t * t * (3 - 2 * t)

export function applyAimAssist(
  rawAngle: number,
  player: { x: number; y: number },
  targets: { x: number; y: number }[],
): number {
  let best: { d: number; absD: number } | undefined

  for (const target of targets) {
    if (Math.hypot(target.x - player.x, target.y - player.y) > AIM_ASSIST_RANGE) continue
    const d = angleDiff(rawAngle, Math.atan2(target.y - player.y, target.x - player.x))
    const absD = Math.abs(d)
    if (absD > AIM_ASSIST_CONE) continue
    if (!best || absD < best.absD) best = { d, absD }
  }

  if (!best) return rawAngle
  const w = AIM_ASSIST_STRENGTH * (1 - smoothstep(best.absD / AIM_ASSIST_CONE))
  return rawAngle + w * best.d
}
