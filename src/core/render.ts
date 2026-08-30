import type { createRenderer } from './renderer.ts'
import { MAP_W, MAP_H } from '../components/map.ts'
import { colorT, night } from '../systems/night.ts'
import { fade } from '../systems/fade.ts'
import { player, portal, platforms, clouds, keys, TILE_R, PORTAL_OPEN_CELL, PORTAL_CLOSED_CELL, KEY_CELL, KEY_R, KEY_R2, allKeysCollected } from '../state.ts'

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
    keys.forEach((k) => {
      if (!k.collected && k.night === night) sprites.push({ x: k.x + offsetX, y: k.y + offsetY, r: KEY_R, r2: KEY_R2, cell: KEY_CELL })
    })
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

    renderer.drawScene(sprites, colorT, fade)
  }
}
