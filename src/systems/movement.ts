import type { System } from '../core/types.ts'
import type { Velocity } from '../core/components.ts'
import type { Player } from '../components/index.ts'

const keys = new Set<string>()
window.addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()))
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()))

export const movementSystem: System = (world) => {
  const dx = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0)
  const dy = (keys.has('s') ? 1 : 0) - (keys.has('w') ? 1 : 0)
  const len = Math.hypot(dx, dy) || 1
  world.query('c', 'e').forEach((e) => {
    const { speed } = world.get<Player>(e, 'e')!
    world.add(e, 'c', { dx: (dx / len) * speed, dy: (dy / len) * speed } satisfies Velocity)
  })
}
