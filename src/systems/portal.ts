import { TILE_W, GRID_H, MAP, STAGES, stageIndex, activeScene, advanceStage, spawnPoint } from '../components/map.ts'
import { player, respawnPortal, respawnPlatforms, respawnKeys, respawnSwitches, respawnObstacles, respawnDecorations, allKeysCollected, ended, endGame } from '../state.ts'
import { night } from './night.ts'
import { onLand } from './squash.ts'
import { isFading, startFade } from './fade.ts'
import { play, SND_STAGE } from './sound.ts'

const DURATION = 3 // s — full fade-out + fade-in

// when the player's feet land on the portal tile: fade to black, swap stages at the midpoint
// (advance to the next stage, wrapping, and drop the player back at spawn — mirrors
// night.ts's toggle-triggered respawn), then fade back in
export function createUpdatePortal() {
  return () => {
    if (isFading() || ended || !allKeysCollected()) return
    const { col, row, night: portalNight } = activeScene().portal
    if (portalNight !== undefined && portalNight !== night) return
    const pc = Math.floor(player.x / TILE_W)
    const pr = Math.floor((player.y + player.foy) / GRID_H)
    if (pc !== col || pr !== row) return

    const isFinal = stageIndex === STAGES.length - 1
    play(...SND_STAGE)
    startFade(DURATION, () => {
      if (isFinal) return endGame()
      advanceStage(night)
      respawnPlatforms(MAP, night)
      respawnPortal()
      respawnKeys()
      respawnSwitches()
      respawnObstacles()
      respawnDecorations()
      const p = spawnPoint()
      player.x = p.x
      player.y = p.y
      onLand()
    })
  }
}
