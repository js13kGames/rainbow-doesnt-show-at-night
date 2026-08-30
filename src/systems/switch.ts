import { TILE_W, GRID_H } from '../components/map.ts'
import { player, switches } from '../state.ts'
import { night } from './night.ts'

export function updateSwitch() {
  const pc = Math.floor(player.x / TILE_W)
  const pr = Math.floor((player.y + player.foy) / GRID_H)
  switches.forEach((s) => {
    if (s.stepped || s.night !== night) return
    if (Math.floor(s.x / TILE_W) === pc && Math.floor(s.y / GRID_H) === pr) s.stepped = true
  })
}
