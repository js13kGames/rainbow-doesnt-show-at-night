import { TILE_W, GRID_H, MAP, activeScene, advanceStage } from '../components/map.ts'
import { player, respawnPortal, respawnPlatforms } from '../state.ts'
import { night } from './night.ts'
import { onLand } from './squash.ts'

// when the player's feet land on the portal tile: advance to the next stage (wrapping) and
// drop the player back at spawn — mirrors night.ts's toggle-triggered respawn
export function createUpdatePortal(spawnX: number, spawnY: number) {
  return () => {
    const { col, row } = activeScene().portal
    const pc = Math.floor(player.x / TILE_W)
    const pr = Math.floor((player.y + player.foy) / GRID_H)
    if (pc !== col || pr !== row) return

    advanceStage(night)
    respawnPlatforms(MAP, night)
    respawnPortal()
    player.x = spawnX
    player.y = spawnY
    onLand()
  }
}
