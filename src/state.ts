import { TILE_W, GRID_H, TILE_DIRT, activeScene } from './components/map.ts'

type Cell = { x: number; y: number; w?: number; h?: number }

const PLATFORM_GRASS_CELL = { x: 1, y: 1, w: 1, h: 1 }
const PLATFORM_DIRT_CELL = { x: 1, y: 2, w: 1, h: 1 }
const PLATFORM_NIGHT_GRASS_CELL = { x: 0, y: 1, w: 1, h: 1 }
const PLATFORM_NIGHT_DIRT_CELL = { x: 0, y: 2, w: 1, h: 1 }
const PORTAL_CELL = { x: 3, y: 2, w: 1, h: 1 }

// only one moving entity exists (the player), so its "components" are just plain fields
export const player = {
  x: 0,
  y: 0,
  rotation: 0,
  r: 20,
  r2: undefined as number | undefined,
  oy: undefined as number | undefined,
  flip: undefined as number | undefined,
  cell: { x: 0, y: 0 } as Cell,
  vx: 0,
  vy: 0,
  hw: 0,
  hh: 0,
  foy: 20, // collider foot offset
  wpx: 0,
  wpy: 0, // wobble's previous position
  jump: null as null | { dx: number; dy: number; t: number },
  sq: null as null | { t: number; base: number },
}

export function spawnPlayer(x: number, y: number) {
  player.x = x
  player.y = y
  player.wpx = x
  player.wpy = y
}

export const portal = { x: 0, y: 0, r: TILE_W / 2, r2: GRID_H / 2, oy: -GRID_H / 2, cell: PORTAL_CELL }

export function respawnPortal() {
  const { col, row } = activeScene().portal
  portal.x = col * TILE_W + TILE_W / 2
  portal.y = row * GRID_H + GRID_H / 2
}

export type PlatformTile = { x: number; y: number; r: number; r2: number; cell: Cell }
export let platforms: PlatformTile[] = []

export function respawnPlatforms(map: number[][], night: boolean) {
  platforms = []
  map.forEach((row, r) =>
    row.forEach((tile, c) => {
      if (tile === 0) return
      const isDirt = tile === TILE_DIRT
      const cell = isDirt ? (night ? PLATFORM_NIGHT_DIRT_CELL : PLATFORM_DIRT_CELL) : night ? PLATFORM_NIGHT_GRASS_CELL : PLATFORM_GRASS_CELL
      platforms.push({ x: c * TILE_W + TILE_W / 2, y: r * GRID_H + GRID_H / 2, r: TILE_W / 2, r2: GRID_H / 2, cell })
    }),
  )
}

export type CloudEnt = { x: number; y: number; r: number; r2: number; flip: number; speed: number }
export const clouds: CloudEnt[] = []

export function spawnClouds(canvas: HTMLCanvasElement, count: number) {
  const slotW = canvas.width / count
  for (let i = 0; i < count; i++) {
    const depth = Math.random() // 0=멀리/위/작게, 1=가까이/아래/크게
    const scale = 0.4 + depth * 1.4
    clouds.push({
      x: slotW * i + Math.random() * slotW,
      y: canvas.height * (0.05 + depth * 0.75),
      r: 40 * scale,
      r2: 20 * scale,
      flip: Math.random() < 0.5 ? -1 : 1,
      speed: 15 + depth * 15,
    })
  }
}
