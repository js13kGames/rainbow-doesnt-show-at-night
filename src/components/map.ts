// matches the player/enemy sprite scale (r: 20 over a 16px-wide source sprite)
const SCALE = 2.5
// every tile is a uniform 16x16 atlas cell — grid step and render size are the same
export const TILE_W = 16 * SCALE
export const GRID_H = 16 * SCALE

// tile values: 0=empty, 1=grass (atlas row1), 2=dirt (atlas row2, directly below grass)
export const TILE_GRASS = 1
export const TILE_DIRT = 2

// a Scene = one stage: its day/night tile layouts, plus where the portal to the next stage
// spawns. The portal is its own entity (see systems/portal.ts), not a tile value — `col`/`row`
// here only pick its spawn position, same grid units as the tile arrays, on the ground row so
// it's reachable in both day & night
export type Scene = { day: number[][]; night: number[][]; portal: { col: number; row: number } }

// authoring format: 1=walkable, 0=empty. Grass is the default surface; any walkable tile with
// no walkable tile directly below it (unsupported — the bottom of a platform, or the map floor)
// gets a dirt tile generated one row beneath it, growing the grid downward if that row doesn't
// exist yet. This is why the map floor ends up dirt (nothing exists past the last row) while a
// tile resting on more ground above further ground stays plain grass.
const deriveTiles = (base: number[][]): number[][] => {
  const tiles = base.map((row) => [...row])
  base.forEach((row, r) =>
    row.forEach((v, c) => {
      if (v !== 1 || base[r + 1]?.[c] === 1) return
      tiles[r + 1] ??= new Array(row.length).fill(0)
      tiles[r + 1]![c] = TILE_DIRT
    }),
  )
  return tiles
}

const parseMap = (rows: string[]): number[][] => deriveTiles(rows.map((row) => row.split('').map(Number)))

// intro stage: a flat floor with nothing else on it, spawn at the far left (main.ts) and the
// portal at the far right — walking straight to it is the whole tutorial
export const STAGE_1: Scene = {
  day: parseMap(['0000000000', '0000000000', '0000000000', '0000000000', '1111111111']),
  night: parseMap(['0000000000', '0000000000', '0000000000', '0000000000', '1111111111']),
  portal: { col: 9, row: 4 },
}

// day floor has a 2-tile pit too wide to jump across; night fills it with a bridge — crossing
// it is only possible after toggling night, teaching the mechanic
export const STAGE_2: Scene = {
  day: parseMap(['0000000000', '0000000000', '0000000000', '0000000000', '1111001111']),
  night: parseMap(['0000000000', '0000000000', '0000000000', '0000000000', '1111111111']),
  portal: { col: 9, row: 4 },
}

// all stages ordered; how far the game currently extends is just how many entries live here —
// js13k budget decides the final count
export const STAGES: Scene[] = [STAGE_1, STAGE_2]
export let stageIndex = 0
export const activeScene = () => STAGES[stageIndex]!

export let MAP = activeScene().day
export const setActiveMap = (night: boolean) => (MAP = night ? activeScene().night : activeScene().day)
export const advanceStage = (night: boolean) => {
  stageIndex = (stageIndex + 1) % STAGES.length
  setActiveMap(night)
}

export const MAP_W = STAGE_1.day[0]!.length * TILE_W
export const MAP_H = STAGE_1.day.length * GRID_H

const isGreenAt = (map: number[][], px: number, py: number): boolean => {
  const col = Math.floor(px / TILE_W)
  const row = Math.floor(py / GRID_H)
  return map[row]?.[col] === TILE_GRASS
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
