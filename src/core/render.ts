import type { createRenderer } from './renderer.ts'
import { MAP_W, MAP_H, TILE_W, GRID_H } from '../components/map.ts'
import { colorT, night } from '../systems/night.ts'
import { fade, shrinkPlayer } from '../systems/fade.ts'
import { idleFrame, IDLE_STEP } from '../systems/wobble.ts'
import {
  player,
  portal,
  platforms,
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

type Cell = { x: number; y: number; w?: number; h?: number }
type RenderSprite = { x: number; y: number; rotation?: number; r: number; r2?: number; flip?: number; cell?: Cell; alpha?: number; alpha2?: number }

export function createRender(renderer: ReturnType<typeof createRenderer>, canvas: HTMLCanvasElement) {
  return () => {
    // static offset centering the map in the canvas — not a camera, doesn't track the player
    const offsetX = canvas.width / 2 - MAP_W / 2
    const offsetY = canvas.height / 2 - MAP_H / 2

    // water reflection: mirror the grass+dirt stack below the water line. The dirt atlas cell
    // is only opaque in its top half (a thin trim under the grass, transparent below) — cropped
    // to just that opaque sliver so the reflection touches the seam with no dead transparent gap.
    // Order matches a true mirror: dirt (closest to the seam) first, grass further down —
    // both rippling via the bridge's idle-wiggle, phase-offset per column, fading with depth.
    // Pushed before the real platform sprites below so a reflection that reaches into another
    // platform (a stack 2+ tiles tall) is painted over by the real tile, not the other way round
    const sprites: RenderSprite[] = []
    // single-tile mirror for anything that isn't a grass+dirt platform stack (rainbow bridge
    // tiles, the portal): flip the same cell below its own bottom edge with the same fading
    // gradient and ripple as the grass reflection above
    const reflect = (x: number, bottomY: number, cell: Cell, phase: number) => {
      const frame = idleFrame(performance.now() * 0.001 + phase)
      sprites.push({ x, y: bottomY + TILE_R, rotation: frame.rot, r: TILE_R, r2: -TILE_R * frame.sy, cell, alpha: 0.5, alpha2: 0.03 })
    }
    platforms.forEach((p) => {
      if (p.cell.y !== 1) return
      const seamY = p.y + offsetY + GRID_H // dirt tile's own center — where its opaque half ends
      const t = performance.now() * 0.001 + (p.x / TILE_W) * IDLE_STEP
      // height is the sprite's own half-extent (r2 magnitude) — the dirt sliver is cropped to
      // half a tile so it gets half-height, but the full grass cell keeps full height (no squash)
      const push = (cy: number, cell: Cell, height: number, alpha: number, alpha2: number, phase: number) => {
        const frame = idleFrame(t + phase)
        sprites.push({ x: p.x + offsetX, y: cy, rotation: frame.rot, r: TILE_R, r2: -height * frame.sy, cell, alpha, alpha2 })
      }

      push(seamY + TILE_R / 2, { x: p.cell.x, y: 2, w: 1, h: 0.5 }, TILE_R / 2, 0.35, 0.35, 0)
      // one full-size grass tile right below it, with a real top-to-bottom gradient (not chunked
      // alpha steps) — vivid where it touches the dirt reflection, fading to near-nothing by its
      // far edge, keeping the tile's true proportions throughout
      push(seamY + TILE_R + TILE_R, p.cell, TILE_R, 0.5, 0.03, IDLE_STEP)
    })
    // r2 omitted below (platforms/portal are square, so it just falls back to r in the renderer)
    platforms.forEach((p) => sprites.push({ x: p.x + offsetX, y: p.y + offsetY, r: TILE_R, cell: p.cell }))
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
          const x = col * TILE_W + TILE_W / 2 + offsetX
          const bottomY = row * GRID_H + GRID_H / 2 + offsetY + TILE_R // fixed — wiggle grows the tile from this edge, doesn't move it
          reflect(x, bottomY, BRIDGE_CELL, col * IDLE_STEP)
          sprites.push({
            x,
            y: bottomY - r2,
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
    // shrinks (and grows back) much faster than the screen fade itself, and sinks straight down
    // while doing so — reads as falling/sinking away rather than just fading out in place
    const deathT = shrinkPlayer ? Math.min(1, fade * 4) : 0
    const deathScale = 1 - deathT
    sprites.push({
      x: player.x + offsetX,
      y: player.y + offsetY + player.oy + deathT * GRID_H,
      rotation: player.rotation,
      r: player.r * deathScale,
      r2: player.r2 * deathScale,
      flip: player.flip,
      cell: player.cell,
    })

    renderer.drawScene(sprites, colorT, fade)
  }
}
