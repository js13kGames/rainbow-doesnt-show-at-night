import type { System } from '../core/types.ts'
import type { Transform } from '../core/components.ts'
import type { Orbit } from '../components/index.ts'

export const tickOrbit = (o: Orbit, dt: number): Orbit => ({ angle: o.angle + dt })

export const orbitTransform = (t: Transform, o: Orbit, center: { x: number; y: number }): Transform => ({
  ...t,
  x: center.x + Math.cos(o.angle) * 100,
  y: center.y + Math.sin(o.angle) * 100,
})

export function createOrbitSystem(getCenter: () => { x: number; y: number }): System {
  return (world, dt) => {
    world.query('transform', 'orbit').forEach((e) => {
      const orbit = tickOrbit(world.get<Orbit>(e, 'orbit')!, dt)
      world.add(e, 'orbit', orbit)
      world.add(e, 'transform', orbitTransform(world.get<Transform>(e, 'transform')!, orbit, getCenter()))
    })
  }
}
