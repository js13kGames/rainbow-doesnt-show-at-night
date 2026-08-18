import type { System } from '../core/types.ts'
import type { Transform } from '../core/components.ts'
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
  return (world, dt) => {
    const dx = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0)
    const dy = (keys.has('s') ? 1 : 0) - (keys.has('w') ? 1 : 0)
    if (dx === 0 && dy === 0) return
    const len = Math.hypot(dx, dy)
    world.query('transform', 'player').forEach((e) => {
      const player = world.get<Player>(e, 'player')!
      const s = keys.has('shift') ? player.runSpeed : player.walkSpeed
      const transform = world.get<Transform>(e, 'transform')!
      world.add(e, 'transform', moveTransform(transform, dx / len, dy / len, s, dt))
    })
  }
}
