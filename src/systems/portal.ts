import { TILE_W, GRID_H, MAP, activeScene, advanceStage } from '../components/map.ts'
import { player, respawnPortal, respawnPlatforms, respawnKeys, allKeysCollected } from '../state.ts'
import { night } from './night.ts'
import { onLand } from './squash.ts'
import { isFading, startFade } from './fade.ts'

const DURATION = 3 // s — full fade-out + fade-in

// when the player's feet land on the portal tile: fade to black, swap stages at the midpoint
// (advance to the next stage, wrapping, and drop the player back at spawn — mirrors
// night.ts's toggle-triggered respawn), then fade back in
export function createUpdatePortal(spawnX: number, spawnY: number) {
  return () => {
    if (isFading() || !allKeysCollected()) return
    const { col, row } = activeScene().portal
    const pc = Math.floor(player.x / TILE_W)
    const pr = Math.floor((player.y + player.foy) / GRID_H)
    if (pc !== col || pr !== row) return

    startFade(DURATION, () => {
      advanceStage(night)
      respawnPlatforms(MAP, night)
      respawnPortal()
      respawnKeys()
      player.x = spawnX
      player.y = spawnY
      onLand()
    })
  }
}
