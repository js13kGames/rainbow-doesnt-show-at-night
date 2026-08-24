import type { System, Entity } from '../core/types.ts'
import type { World } from '../core/world.ts'
import type { Sprite } from '../core/components.ts'
import type { Squash } from '../components/index.ts'

const AMPLITUDE = 0.9
const DECAY = 10 // 1/s
const FREQ = 15 // rad/s
const CUTOFF = 0.6 // s

export function initSquash(world: World) {
  world.on('l', (e: Entity) => {
    if (world.has(e, 'g')) return
    const s = world.get<Sprite>(e, 'b')!
    world.add(e, 'g', { t: 0, base: s.r2 ?? s.r } satisfies Squash)
  })
}

export const squashSystem: System = (world, dt) => {
  world.query('b', 'g').forEach((e) => {
    const s = world.get<Sprite>(e, 'b')!
    const sq = world.get<Squash>(e, 'g')!
    const t = sq.t + dt
    if (t >= CUTOFF) {
      world.add(e, 'b', { ...s, r2: sq.base, oy: 0 })
      world.remove(e, 'g')
      return
    }
    const r2 = sq.base * (1 - AMPLITUDE * Math.exp(-DECAY * t) * Math.cos(FREQ * t))
    // feet stay planted: shrink toward the bottom instead of the sprite center
    world.add(e, 'b', { ...s, r2, oy: sq.base - r2 })
    world.add(e, 'g', { t, base: sq.base } satisfies Squash)
  })
}
