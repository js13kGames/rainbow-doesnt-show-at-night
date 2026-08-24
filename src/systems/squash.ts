import type { System, Entity } from '../core/types.ts'
import type { World } from '../core/world.ts'
import type { Sprite } from '../core/components.ts'
import type { Squash } from '../components/index.ts'

const AMPLITUDE = 0.9
const DECAY = 10 // 1/s
const FREQ = 15 // rad/s
const CUTOFF = 0.6 // s

export function createSquashSystem(world: World): System {
  world.on('land', (e: Entity) => {
    if (world.has(e, 'squash')) return
    const s = world.get<Sprite>(e, 'sprite')!
    world.add(e, 'squash', { t: 0, base: s.r2 ?? s.r } satisfies Squash)
  })

  return (world, dt) => {
    world.query('sprite', 'squash').forEach((e) => {
      const s = world.get<Sprite>(e, 'sprite')!
      const sq = world.get<Squash>(e, 'squash')!
      const t = sq.t + dt
      if (t >= CUTOFF) {
        world.add(e, 'sprite', { ...s, r2: sq.base, oy: 0 })
        world.remove(e, 'squash')
        return
      }
      const r2 = sq.base * (1 - AMPLITUDE * Math.exp(-DECAY * t) * Math.cos(FREQ * t))
      // feet stay planted: shrink toward the bottom instead of the sprite center
      world.add(e, 'sprite', { ...s, r2, oy: sq.base - r2 })
      world.add(e, 'squash', { t, base: sq.base } satisfies Squash)
    })
  }
}
