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
// a bridge tile's `night` picks which side it appears on — independent of the switch's own
// side, so a day-side switch can raise a night-only bridge and vice versa
export type SwitchDef = { col: number; row: number; bridge: { col: number; row: number; night: boolean }[] }

export type Scene = {
  day: number[][]
  night: number[][]
  // `night` on the portal itself: undefined = reachable both day & night (default), true/false =
  // only exists on that side
  portal: { col: number; row: number; night?: boolean }
  keys: { day: { col: number; row: number }[]; night: { col: number; row: number }[] }
  switches: { day: SwitchDef[]; night: SwitchDef[] }
}

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
  keys: { day: [{ col: 3, row: 4 }], night: [{ col: 6, row: 4 }] },
  switches: { day: [], night: [] },
}

// day floor has a 2-tile pit too wide to jump across; night fills it with a bridge — crossing
// it is only possible after toggling night, teaching the mechanic. A second day-only pit
// (col8) follows it, crossed by stepping the switch (col6) that raises a rainbow bridge over
// it — so the player must toggle night to cross the first gap, then toggle back to day to
// reach the switch
export const STAGE_2: Scene = {
  day: parseMap(['0000000000', '0000000000', '0000000000', '0000000000', '1111001101']),
  night: parseMap(['0000000000', '0000000000', '0000000000', '0000000000', '1111111111']),
  portal: { col: 9, row: 4 },
  keys: { day: [{ col: 2, row: 4 }], night: [{ col: 7, row: 4 }] },
  switches: { day: [{ col: 6, row: 4, bridge: [{ col: 8, row: 4, night: false }] }], night: [] },
}

// QA-only: exercises the two cross-day/night features together — a night-side switch (col2)
// raises a 3-tile bridge over a day-side pit (col4-6), and the portal (night: true) only
// exists at night. Not real level content — pull this + its STAGES entry before submission.
export const STAGE_TEST: Scene = {
  day: parseMap(['0000000000', '0000000000', '0000000000', '0000000000', '1111000111']),
  night: parseMap(['0000000000', '0000000000', '0000000000', '0000000000', '1111111111']),
  portal: { col: 9, row: 4, night: true },
  keys: { day: [{ col: 1, row: 4 }], night: [{ col: 8, row: 4 }] },
  switches: {
    night: [
      {
        col: 2,
        row: 4,
        bridge: [
          { col: 4, row: 4, night: false },
          { col: 5, row: 4, night: false },
          { col: 6, row: 4, night: false },
        ],
      },
    ],
    day: [],
  },
}

// all stages ordered; how far the game currently extends is just how many entries live here —
// js13k budget decides the final count
export const STAGES: Scene[] = [STAGE_TEST, STAGE_1, STAGE_2]
export let stageIndex = 0
export const activeScene = () => STAGES[stageIndex]!

export let MAP = activeScene().day
// each scene can be a different size, so these are recomputed with MAP rather than fixed to
// STAGE_1 — a taller/wider stage centers and gets its own sea horizon correctly
export let MAP_W = MAP[0]!.length * TILE_W
export let MAP_H = MAP.length * GRID_H
export const setActiveMap = (night: boolean) => {
  MAP = night ? activeScene().night : activeScene().day
  MAP_W = MAP[0]!.length * TILE_W
  MAP_H = MAP.length * GRID_H
}
export const advanceStage = (night: boolean) => {
  stageIndex = (stageIndex + 1) % STAGES.length
  setActiveMap(night)
}

const isGreenAt = (map: number[][], px: number, py: number): boolean => {
  const col = Math.floor(px / TILE_W)
  const row = Math.floor(py / GRID_H)
  return map[row]?.[col] === TILE_GRASS
}

// inset by a hair so a box exactly tile-sized doesn't round its far edge into the next tile;
// skipped when hw/hh is 0 so a point collider (hw=hh=0) stays an exact single point
const EPS = 0.01

// `bridges` is a set of "col,row" keys for rainbow-bridge tiles currently raised by a stepped
// switch — those tiles are walkable even though the base map grid still has 0 there
export const isWalkableBox = (map: number[][], x: number, y: number, hw: number, hh: number, oy = 0, bridges?: Set<string>): boolean => {
  const cx = x
  const cy = y + oy
  const ex = hw > 0 ? EPS : 0
  const ey = hh > 0 ? EPS : 0
  return [
    [cx - hw, cy - hh],
    [cx + hw - ex, cy - hh],
    [cx - hw, cy + hh - ey],
    [cx + hw - ex, cy + hh - ey],
  ].every(([px, py]) => isGreenAt(map, px, py) || (bridges?.has(`${Math.floor(px / TILE_W)},${Math.floor(py / GRID_H)}`) ?? false))
}
