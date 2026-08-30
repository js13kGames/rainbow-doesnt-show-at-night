import { MAP, isWalkableBox } from '../components/map.ts'
import { player, activeBridgeTiles } from '../state.ts'
import { night } from './night.ts'

export function updateCollision(dt: number) {
  if (player.jump) return
  const bridges = activeBridgeTiles(night)
  const movedX = player.x + player.vx * dt
  if (isWalkableBox(MAP, movedX, player.y, player.hw, player.hh, player.foy, bridges)) player.x = movedX
  const movedY = player.y + player.vy * dt
  if (isWalkableBox(MAP, player.x, movedY, player.hw, player.hh, player.foy, bridges)) player.y = movedY
}
