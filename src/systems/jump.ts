import type { System } from '../core/types.ts'
import type { Transform, Velocity, Collider } from '../core/components.ts'
import type { Jump } from '../components/index.ts'
import { MAP, GRID_H, isWalkableBox } from '../components/map.ts'

const DISTANCE = GRID_H * 1.3 // 타일 한 칸보다 쪼오금 더
const DURATION = 0.25 // s
const SPEED = DISTANCE / DURATION
const HOP_HEIGHT = GRID_H * 0.6 // 점프 중 떠오르는 높이

const normalize = (dx: number, dy: number): { dx: number; dy: number } | null => {
  const len = Math.hypot(dx, dy)
  return len > 0 ? { dx: dx / len, dy: dy / len } : null
}

// 0(시작)→1(착지)로 갈수록 포물선을 그리며 떴다가 다시 0으로 내려오는 세로 오프셋
const hopOffset = (progress: number): number => HOP_HEIGHT * Math.sin(Math.PI * progress)

const keys = new Set<string>()
window.addEventListener('keydown', (e) => e.key === ' ' && keys.add(' '))

export function createJumpSystem(spawnX: number, spawnY: number): System {
  return (world, dt) => {
    if (keys.has(' ')) {
      keys.delete(' ')
      world.query('player', 'transform', 'velocity').forEach((e) => {
        if (world.has(e, 'jump')) return
        const v = world.get<Velocity>(e, 'velocity')!
        const dir = normalize(v.dx, v.dy) ?? { dx: 0, dy: 0 }
        world.add(e, 'jump', { ...dir, t: 0 } satisfies Jump)
      })
    }

    world.query('transform', 'jump', 'velocity').forEach((e) => {
      const t = world.get<Transform>(e, 'transform')!
      const v = world.get<Velocity>(e, 'velocity')!
      const j = world.get<Jump>(e, 'jump')!
      const dir = normalize(v.dx, v.dy) ?? j
      const nextT = j.t + dt
      const progress = Math.min(nextT / DURATION, 1)
      const hopDelta = hopOffset(progress) - hopOffset(Math.min(j.t / DURATION, 1))

      const x = t.x + dir.dx * SPEED * dt
      const y = t.y + dir.dy * SPEED * dt - hopDelta

      if (nextT >= DURATION) {
        const collider = world.get<Collider>(e, 'collider')!
        const landed = isWalkableBox(MAP, x, y, collider.hw, collider.hh, collider.oy)
        world.add(e, 'transform', landed ? { ...t, x, y } : { ...t, x: spawnX, y: spawnY })
        world.remove(e, 'jump')
        return
      }

      world.add(e, 'transform', { ...t, x, y })
      world.add(e, 'jump', { ...dir, t: nextT } satisfies Jump)
    })
  }
}
