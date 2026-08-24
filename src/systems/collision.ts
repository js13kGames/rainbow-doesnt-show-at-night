import type { System } from '../core/types.ts'
import type { Transform, Velocity, Collider } from '../core/components.ts'
import { MAP, isWalkableBox } from '../components/map.ts'

export const collisionSystem: System = (world, dt) => {
  world.query('a', 'c', 'd').forEach((e) => {
    if (world.has(e, 'h')) return
    const transform = world.get<Transform>(e, 'a')!
    const velocity = world.get<Velocity>(e, 'c')!
    const collider = world.get<Collider>(e, 'd')!

    const movedX = transform.x + velocity.dx * dt
    const x = isWalkableBox(MAP, movedX, transform.y, collider.hw, collider.hh, collider.oy) ? movedX : transform.x

    const movedY = transform.y + velocity.dy * dt
    const y = isWalkableBox(MAP, x, movedY, collider.hw, collider.hh, collider.oy) ? movedY : transform.y

    world.add(e, 'a', { ...transform, x, y })
  })
}
