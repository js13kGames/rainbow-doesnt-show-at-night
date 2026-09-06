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
  // where the player appears on entering this stage, and where every respawn (fall-death,
  // night-toggle-death) snaps back to — most stages walk right, but nothing requires that
  spawn: { col: number; row: number }
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
export const deriveTiles = (base: number[][]): number[][] => {
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

export const parseMap = (rows: string[]): number[][] => deriveTiles(rows.map((row) => row.split('').map(Number)))

// every stage is a flat one-row floor (row 4) preceded by 4 empty rows — this generates the
// empty rows so each stage only has to write its floor pattern
const floor = (w: number, row: string): string[] => [...Array(4)].fill('0'.repeat(w)).concat(row)

// intro stage: a flat floor with nothing else on it, spawn at the far left (main.ts) and the
// portal at the far right — walking straight to it is the whole tutorial
export const STAGE_1: Scene = {
  spawn: { col: 0, row: 4 },
  day: parseMap(floor(10, '1111111111')),
  night: parseMap(floor(10, '1111111111')),
  portal: { col: 9, row: 4 },
  keys: { day: [{ col: 3, row: 4 }, { col: 6, row: 4 }], night: [] },
  switches: { day: [], night: [] },
}

// two single-tile pits (day == night) — just wide enough that walking in is fatal but a hop
// (space) clears them. First stage that requires jumping
export const STAGE_JUMP: Scene = {
  spawn: { col: 0, row: 4 },
  day: parseMap(floor(10, '1110111011')),
  night: parseMap(floor(10, '1110111011')),
  portal: { col: 9, row: 4 },
  keys: { day: [{ col: 5, row: 4 }, { col: 8, row: 4 }], night: [] },
  switches: { day: [], night: [] },
}

// first multi-row stage: a 6-tile floor pit (col3-8) far too wide to jump straight across, with
// an elevated bridge on row2 spanning the same gap. A jump straight up (W+space) at col2 clears
// the row3 gap onto the bridge, walk the bridge across, then a jump straight down (S+space) at
// col9 clears row3 again back to the floor — vertical jump uses the exact same 40px-gap math as
// a horizontal one, just rotated 90°. day == night (night not taught yet), day-only keys
export const STAGE_HEIGHT: Scene = {
  spawn: { col: 0, row: 4 },
  day: parseMap(['000000000000', '000000000000', '001111111100', '000000000000', '111000000111']),
  night: parseMap(['000000000000', '000000000000', '001111111100', '000000000000', '111000000111']),
  portal: { col: 11, row: 4 },
  keys: { day: [{ col: 1, row: 4 }, { col: 10, row: 4 }], night: [] },
  switches: { day: [], night: [] },
}

// a 2-tile day pit, too wide to jump, that's simply solid ground at night — toggling is the
// entire puzzle, no switch involved
export const STAGE_NIGHT: Scene = {
  spawn: { col: 0, row: 4 },
  day: parseMap(floor(10, '1111001111')),
  night: parseMap(floor(10, '1111111111')),
  portal: { col: 9, row: 4 },
  keys: { day: [{ col: 2, row: 4 }], night: [{ col: 7, row: 4 }] },
  switches: { day: [], night: [] },
}

// same 2-tile pit shape as STAGE_NIGHT, but this time it's blocked in BOTH day and night (no
// free toggle solution) — only the day switch (col2) raises a bridge over it, so this isolates
// the switch mechanic instead of night
export const STAGE_SWITCH: Scene = {
  spawn: { col: 0, row: 4 },
  day: parseMap(floor(10, '1111001111')),
  night: parseMap(floor(10, '1111001111')),
  portal: { col: 9, row: 4 },
  keys: { day: [{ col: 1, row: 4 }], night: [{ col: 1, row: 4 }] },
  switches: {
    day: [
      {
        col: 2,
        row: 4,
        bridge: [
          { col: 4, row: 4, night: false },
          { col: 5, row: 4, night: false },
        ],
      },
    ],
    night: [],
  },
}

// combines both isolated lessons in one run: a day pit (col4-5) that's solid at night — toggle
// to cross — followed by a day-switch pit (col7-8) that's ALSO blocked at night (so staying in
// night to skip it isn't possible), forcing day -> night -> day -> switch in order
export const STAGE_COMBO: Scene = {
  spawn: { col: 0, row: 4 },
  day: parseMap(floor(11, '11110010011')),
  night: parseMap(floor(11, '11111110011')),
  portal: { col: 10, row: 4 },
  keys: { day: [{ col: 2, row: 4 }], night: [{ col: 6, row: 4 }] },
  switches: { day: [{ col: 6, row: 4, bridge: [{ col: 7, row: 4, night: false }, { col: 8, row: 4, night: false }] }], night: [] },
}

// cross-mode switch: a 3-tile day pit (col4-6) blocked in BOTH day and night, opened only by a
// switch on the NIGHT side (col2) raising a day-only bridge. Portal only exists at night, so
// the forced order is day (grab key) -> night (hit switch) -> day (cross bridge) -> night
// (reach portal)
export const STAGE_CROSS: Scene = {
  spawn: { col: 0, row: 4 },
  day: parseMap(floor(10, '1111000111')),
  night: parseMap(floor(10, '1111000111')),
  portal: { col: 9, row: 4, night: true },
  keys: { day: [{ col: 1, row: 4 }], night: [{ col: 3, row: 4 }] },
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

// a longer run chaining four obstacle types: a shared jump pit (col3), a day-switch pit (col6-7,
// blocked at night too so it can't be skipped by staying in night), a night-is-the-answer pit
// (col9-10, blocked in day, free at night), then a multi-row detour (col12-17): the floor gap is
// too wide to jump directly, so the only way across is up onto a row2 platform — which is itself
// broken at col14, requiring one more horizontal jump mid-air before descending back to the
// floor at col17. Three jumps in a row (up / across the break / down) raises the bar past
// STAGE_HEIGHT's single unbroken platform
export const STAGE_MULTI: Scene = {
  spawn: { col: 0, row: 4 },
  day: parseMap(['00000000000000000000', '00000000000000000000', '00000000000011011100', '00000000000000000000', '11101100100110000111']),
  night: parseMap(['00000000000000000000', '00000000000000000000', '00000000000011011100', '00000000000000000000', '11101100111110000111']),
  portal: { col: 19, row: 4 },
  keys: { day: [{ col: 1, row: 4 }], night: [{ col: 1, row: 4 }] },
  switches: { day: [{ col: 5, row: 4, bridge: [{ col: 6, row: 4, night: false }, { col: 7, row: 4, night: false }] }], night: [] },
}

// toggle + jump combo, taught in isolation: a 3-tile day pit (col4-6) is too wide for any jump
// (even at max reach), but at night col5 becomes a solid island splitting it into two 1-tile
// gaps — each individually jumpable. Toggling is necessary but not sufficient: two precise jumps
// are still required after switching to night. No switches involved (pure day/night geometry)
export const STAGE_NIGHTJUMP: Scene = {
  spawn: { col: 0, row: 4 },
  day: parseMap(floor(10, '1111000111')),
  night: parseMap(floor(10, '1111010111')),
  portal: { col: 9, row: 4 },
  keys: { day: [{ col: 1, row: 4 }], night: [{ col: 8, row: 4 }] },
  switches: { day: [], night: [] },
}

// every obstacle type introduced so far, chained with a single solid tile between each: jump ->
// day-switch pit (blocked at night) -> free night pit (blocked in day) -> cross-mode switch
// (night switch raises a day bridge, also blocked at night) -> toggle+jump combo pit (STAGE_
// NIGHTJUMP's split-island trick) -> one more free night pit -> then the hardest link: a floor
// gap (col20-25) that's blocked in both modes with no toggle escape at all, crossable only by
// jumping straight up onto a row2 platform (from the day switch's own tile, col19) that is
// itself broken for 2 tiles (col22-23, too wide to jump over) until the switch bridges it —
// combining the vertical-jump skill from STAGE_HEIGHT with the switch-gating from STAGE_SWITCH,
// landing back on the floor at col26 for the final stretch to the night-only portal
export const STAGE_GAUNTLET: Scene = {
  spawn: { col: 0, row: 4 },
  day: parseMap([
    '00000000000000000000000000000',
    '00000000000000000000000000000',
    '00000000000000000001110011100',
    '00000000000000000000000000000',
    '10100100100100100011000000111',
  ]),
  night: parseMap([
    '00000000000000000000000000000',
    '00000000000000000000000000000',
    '00000000000000000001110011100',
    '00000000000000000000000000000',
    '10100111100111101011000000111',
  ]),
  portal: { col: 28, row: 4, night: true },
  keys: { day: [{ col: 0, row: 4 }], night: [{ col: 0, row: 4 }] },
  switches: {
    day: [
      { col: 2, row: 4, bridge: [{ col: 3, row: 4, night: false }, { col: 4, row: 4, night: false }] },
      { col: 19, row: 4, bridge: [{ col: 22, row: 2, night: false }, { col: 23, row: 2, night: false }] },
    ],
    night: [{ col: 8, row: 4, bridge: [{ col: 9, row: 4, night: false }, { col: 10, row: 4, night: false }] }],
  },
}

// the finale: a jump pit (col2), a free night pit (col4-5, blocked in day), and a toggle+jump
// combo pit (col7-9, STAGE_NIGHTJUMP's split-island trick) warm up the whole toolkit, then the
// capstone — STAGE_CROSS's trick reversed AND elevated: a DAY switch (col11) doubles as a
// vertical-jump takeoff (STAGE_HEIGHT's straight-up/down jump) onto a row2 platform that's
// broken for 2 tiles (col14-15, too wide to jump over) until the switch raises a bridge that
// only appears at NIGHT — so the player must climb up in day, then toggle to night while
// already on the platform to cross, landing back on the floor at col18 for the final stretch to
// the night-only portal
export const STAGE_FINAL: Scene = {
  spawn: { col: 0, row: 4 },
  day: parseMap([
    '000000000000000000000',
    '000000000000000000000',
    '000000000001110011100',
    '000000000000000000000',
    '110100100011000000111',
  ]),
  night: parseMap([
    '000000000000000000000',
    '000000000000000000000',
    '000000000001110011100',
    '000000000000000000000',
    '110111101011000000111',
  ]),
  portal: { col: 20, row: 4, night: true },
  keys: { day: [{ col: 1, row: 4 }], night: [{ col: 1, row: 4 }] },
  switches: { day: [{ col: 11, row: 4, bridge: [{ col: 14, row: 2, night: true }, { col: 15, row: 2, night: true }] }], night: [] },
}

// all stages ordered, easiest to hardest; how far the game extends is just how many entries
// live here — js13k budget decides the final count
export const STAGES: Scene[] = [
  STAGE_1,
  STAGE_JUMP,
  STAGE_HEIGHT,
  STAGE_NIGHT,
  STAGE_SWITCH,
  STAGE_COMBO,
  STAGE_CROSS,
  STAGE_MULTI,
  STAGE_NIGHTJUMP,
  STAGE_GAUNTLET,
  STAGE_FINAL,
]
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

// pixel-space spawn point for whichever stage is currently active — used for the initial spawn
// and every respawn (fall-death, night-toggle-death, stage-advance). y anchors to the row's top
// edge rather than its center, matching the player's collision-box convention (see state.ts)
export const spawnPoint = (): { x: number; y: number } => {
  const { col, row } = activeScene().spawn
  return { x: col * TILE_W + TILE_W / 2, y: row * GRID_H }
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
