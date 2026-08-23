import type { System } from '../core/types.ts'
import type { Transform, Velocity, Collider } from '../core/components.ts'
import { MAP, isWalkableBox } from '../components/map.ts'

export function createCollisionSystem(): System {
  return (world, dt) => {
    world.query('transform', 'velocity', 'collider').forEach((e) => {
      const transform = world.get<Transform>(e, 'transform')!
      const velocity = world.get<Velocity>(e, 'velocity')!
      const collider = world.get<Collider>(e, 'collider')!

      const movedX = transform.x + velocity.dx * dt
      const x = isWalkableBox(MAP, movedX, transform.y, collider.hw, collider.hh, collider.oy) ? movedX : transform.x

      const movedY = transform.y + velocity.dy * dt
      const y = isWalkableBox(MAP, x, movedY, collider.hw, collider.hh, collider.oy) ? movedY : transform.y

      world.add(e, 'transform', { ...transform, x, y })
    })
  }
}
