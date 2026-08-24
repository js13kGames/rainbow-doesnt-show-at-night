import type { System } from '../core/types.ts'
import type { Transform, Sprite } from '../core/components.ts'
import type { Cloud } from '../components/index.ts'

export const driftX = (x: number, speed: number, dt: number, r: number, canvasWidth: number): number => {
  const next = x + speed * dt
  return next - r > canvasWidth ? -r : next
}

export function createCloudSystem(canvas: HTMLCanvasElement): System {
  return (world, dt) => {
    world.query('a', 'i').forEach((e) => {
      const t = world.get<Transform>(e, 'a')!
      const s = world.get<Sprite>(e, 'b')!
      const { speed } = world.get<Cloud>(e, 'i')!
      world.add(e, 'a', { ...t, x: driftX(t.x, speed, dt, s.r, canvas.width) })
    })
  }
}
