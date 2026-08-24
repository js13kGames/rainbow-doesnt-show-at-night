import type { System } from '../core/types.ts'
import type { Transform, Velocity } from '../core/components.ts'
import type { Player } from '../components/index.ts'

const keys = new Set<string>()
window.addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()))
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()))

export const moveTransform = (t: Transform, dx: number, dy: number, speed: number, dt: number): Transform => ({
  ...t,
  x: t.x + dx * speed * dt,
  y: t.y + dy * speed * dt,
})

export function createMovementSystem(): System {
  return (world) => {
    const dx = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0)
    const dy = (keys.has('s') ? 1 : 0) - (keys.has('w') ? 1 : 0)
    const len = Math.hypot(dx, dy) || 1
    world.query('velocity', 'player').forEach((e) => {
      const { speed } = world.get<Player>(e, 'player')!
      world.add(e, 'velocity', { dx: (dx / len) * speed, dy: (dy / len) * speed } satisfies Velocity)
    })
  }
}
