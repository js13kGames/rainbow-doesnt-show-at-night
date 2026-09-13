import { TILE_W, GRID_H } from '../components/map.ts'
import { player, keys } from '../state.ts'
import { night } from './night.ts'
import { play, SND_PICKUP } from './sound.ts'

export function updateKey() {
  const pc = Math.floor(player.x / TILE_W)
  const pr = Math.floor((player.y + player.foy) / GRID_H)
  keys.forEach((k) => {
    if (k.collected || k.night !== night) return
    if (Math.floor(k.x / TILE_W) === pc && Math.floor(k.y / GRID_H) === pr) {
      k.collected = true
      play(...SND_PICKUP)
    }
  })
}
