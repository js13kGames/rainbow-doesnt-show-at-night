import { player } from '../state.ts'
import { isFading } from './fade.ts'

const keys = new Set<string>()
window.addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()))
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()))

const SPEED = 130

export function updateMovement() {
  if (isFading()) {
    player.vx = 0
    player.vy = 0
    return
  }
  const dx = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0)
  const dy = (keys.has('s') ? 1 : 0) - (keys.has('w') ? 1 : 0)
  const len = Math.hypot(dx, dy) || 1
  player.vx = (dx / len) * SPEED
  player.vy = (dy / len) * SPEED
}
