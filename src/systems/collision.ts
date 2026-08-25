import { MAP, isWalkableBox } from '../components/map.ts'
import { player } from '../state.ts'

export function updateCollision(dt: number) {
  if (player.jump) return
  const movedX = player.x + player.vx * dt
  if (isWalkableBox(MAP, movedX, player.y, player.hw, player.hh, player.foy)) player.x = movedX
  const movedY = player.y + player.vy * dt
  if (isWalkableBox(MAP, player.x, movedY, player.hw, player.hh, player.foy)) player.y = movedY
}
