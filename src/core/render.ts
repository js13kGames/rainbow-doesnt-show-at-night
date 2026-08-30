import type { createRenderer } from './renderer.ts'
import { MAP_W, MAP_H, TILE_W, GRID_H } from '../components/map.ts'
import { colorT, night } from '../systems/night.ts'
import { fade } from '../systems/fade.ts'
import { idleFrame, IDLE_STEP } from '../systems/wobble.ts'
import {
  player,
  portal,
  platforms,
  clouds,
  keys,
  switches,
  TILE_R,
  PORTAL_OPEN_CELL,
  PORTAL_CLOSED_CELL,
  KEY_CELL,
  KEY_R,
  KEY_R2,
  SWITCH_CELL,
  SWITCH_STEPPED_CELL,
  BRIDGE_CELL,
  allKeysCollected,
} from '../state.ts'

const CLOUD_CELL = { x: 0, y: 3, w: 2, h: 1 }
type Cell = { x: number; y: number; w?: number; h?: number }
type RenderSprite = { x: number; y: number; rotation?: number; r: number; r2?: number; flip?: number; cell?: Cell }

export function createRender(renderer: ReturnType<typeof createRenderer>, canvas: HTMLCanvasElement) {
  return () => {
    // static offset centering the map in the canvas — not a camera, doesn't track the player
    const offsetX = canvas.width / 2 - MAP_W / 2
    const offsetY = canvas.height / 2 - MAP_H / 2

    // r2 omitted below (platforms/portal are square, so it just falls back to r in the renderer)
    const sprites: RenderSprite[] = platforms.map((p) => ({ x: p.x + offsetX, y: p.y + offsetY, r: TILE_R, cell: p.cell }))
    if (!night) clouds.forEach((c) => sprites.push({ x: c.x, y: c.y, r: c.r, r2: c.r2, flip: c.flip, cell: CLOUD_CELL }))
    switches.forEach((s) => {
      // switch icon only shows on its own side; each bridge tile shows on whichever side it
      // targets, independent of the switch's own side (see state.ts activeBridgeTiles)
      if (s.night === night) sprites.push({ x: s.x + offsetX, y: s.y + offsetY, r: TILE_R, cell: s.stepped ? SWITCH_STEPPED_CELL : SWITCH_CELL })
      if (s.stepped)
        s.bridge.forEach(({ col, row, night: bNight }) => {
          if (bNight !== night) return
          // same idle wiggle as the player, phase-offset per column so it ripples along the bridge
          const frame = idleFrame(performance.now() * 0.001 + col * IDLE_STEP)
          const r2 = TILE_R * frame.sy
          sprites.push({
            x: col * TILE_W + TILE_W / 2 + offsetX,
            y: row * GRID_H + GRID_H / 2 + offsetY + (TILE_R - r2),
            rotation: frame.rot,
            r: TILE_R,
            r2,
            cell: BRIDGE_CELL,
          })
        })
    })
    keys.forEach((k) => {
      if (!k.collected && k.night === night) sprites.push({ x: k.x + offsetX, y: k.y + offsetY, r: KEY_R, r2: KEY_R2, cell: KEY_CELL })
    })
    if (portal.night === undefined || portal.night === night)
      sprites.push({ x: portal.x + offsetX, y: portal.y + offsetY + portal.oy, r: TILE_R, cell: allKeysCollected() ? PORTAL_OPEN_CELL : PORTAL_CLOSED_CELL })
    sprites.push({
      x: player.x + offsetX,
      y: player.y + offsetY + player.oy,
      rotation: player.rotation,
      r: player.r,
      r2: player.r2,
      flip: player.flip,
      cell: player.cell,
    })

    // sky/sea split sits at the top of the floor row (last row of the grid), in screen space
    const horizonY = offsetY + MAP_H - GRID_H
    renderer.drawScene(sprites, colorT, fade, horizonY)
  }
}
