import { MAP, GRID_H, isWalkableBox, spawnPoint } from '../components/map.ts'
import { player, activeBridgeTiles } from '../state.ts'
import { onLand, respawnPlayer } from './squash.ts'
import { isFading } from './fade.ts'
import { night } from './night.ts'

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

export function createUpdateJump() {
  return (dt: number) => {
    if (keys.has(' ') && !isFading()) {
      keys.delete(' ')
      if (!player.jump) {
        const dir = normalize(player.vx, player.vy) ?? { dx: 0, dy: 0 }
        player.jump = { ...dir, t: 0 }
      }
    }

    const j = player.jump
    if (!j) return
    const dir = normalize(player.vx, player.vy) ?? j
    const nextT = j.t + dt
    const progress = Math.min(nextT / DURATION, 1)
    const hopDelta = hopOffset(progress) - hopOffset(Math.min(j.t / DURATION, 1))

    const x = player.x + dir.dx * SPEED * dt
    const y = player.y + dir.dy * SPEED * dt - hopDelta

    if (nextT >= DURATION) {
      player.jump = null
      if (isWalkableBox(MAP, x, y, player.hw, player.hh, player.foy, activeBridgeTiles(night))) {
        player.x = x
        player.y = y
        onLand()
      } else {
        const p = spawnPoint()
        respawnPlayer(p.x, p.y)
      }
      return
    }

    player.x = x
    player.y = y
    player.jump = { ...dir, t: nextT }
  }
}
