import { activeScene, setActiveMap, isWalkableBox } from '../components/map.ts'
import { player, respawnPlatforms, activeBridgeTiles } from '../state.ts'
import { respawnPlayer } from './squash.ts'
import { isFading } from './fade.ts'

const PLAYER_CELL = { x: 0, y: 0 }
const PLAYER_NIGHT_CELL = { x: 1, y: 0 }
const FADE_DURATION = 0.4 // s

export let night = false
export let colorT = 0 // 0=day, 1=night — eased each frame toward `night` by updateNightFade

// toggles day/night on 'j': swaps the active map + platform layout, reskins the player,
// and drops the player back to spawn (with a landing bounce) if their footing vanished
export function initNightToggle(spawnX: number, spawnY: number) {
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'j' || isFading()) return
    night = !night
    setActiveMap(night)
    player.cell = night ? PLAYER_NIGHT_CELL : PLAYER_CELL
    const map = night ? activeScene().night : activeScene().day
    respawnPlatforms(map, night)

    if (player.jump) return // mid-hop: not standing on anything yet, jump.ts's own landing check applies
    if (isWalkableBox(map, player.x, player.y, player.hw, player.hh, player.foy, activeBridgeTiles(night))) return
    respawnPlayer(spawnX, spawnY)
  })
}

export function updateNightFade(dt: number) {
  const target = night ? 1 : 0
  const step = dt / FADE_DURATION
  colorT = target > colorT ? Math.min(colorT + step, target) : Math.max(colorT - step, target)
}
