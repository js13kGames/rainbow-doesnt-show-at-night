// matches the player/enemy sprite scale (r: 20 over a 16px-wide source sprite)
const SCALE = 2.5
export const TILE_W = 16 * SCALE
// sprite render height (16px grass + 8px dirt skirt) — taller than one grid row on purpose,
// so consecutive rows overlap and a tile's dirt skirt is covered by the row drawn after it
export const TILE_H = 24 * SCALE
// actual grid row height = the grass portion only; this is what map layout/collision step by
export const GRID_H = 16 * SCALE
export const PLATFORM_CELL = { x: 1, y: 1, w: 1, h: 1.5 }

export const DAY_MAP: number[][] = [
  '0000000000',
  '0000011010',
  '0001111000',
  '0000110000',
  '1111111111',
].map((row) => row.split('').map(Number))

// night layout drops the elevated platforms — standing on one when toggling makes you fall
export const NIGHT_MAP: number[][] = [
  '0000000000',
  '0000000000',
  '0001111000',
  '0000000000',
  '1111111111',
].map((row) => row.split('').map(Number))

export let MAP = DAY_MAP
export const setActiveMap = (night: boolean) => (MAP = night ? NIGHT_MAP : DAY_MAP)

export const MAP_W = DAY_MAP[0]!.length * TILE_W
export const MAP_H = DAY_MAP.length * GRID_H

const isGreenAt = (map: number[][], px: number, py: number): boolean => {
  const col = Math.floor(px / TILE_W)
  const row = Math.floor(py / GRID_H)
  return map[row]?.[col] === 1
}

// inset by a hair so a box exactly tile-sized doesn't round its far edge into the next tile;
// skipped when hw/hh is 0 so a point collider (hw=hh=0) stays an exact single point
const EPS = 0.01

export const isWalkableBox = (map: number[][], x: number, y: number, hw: number, hh: number, oy = 0): boolean => {
  const cx = x
  const cy = y + oy
  const ex = hw > 0 ? EPS : 0
  const ey = hh > 0 ? EPS : 0
  return [
    [cx - hw, cy - hh],
    [cx + hw - ex, cy - hh],
    [cx - hw, cy + hh - ey],
    [cx + hw - ex, cy + hh - ey],
  ].every(([px, py]) => isGreenAt(map, px, py))
}
