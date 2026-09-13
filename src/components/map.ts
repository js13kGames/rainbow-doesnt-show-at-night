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

// a patrolling hazard: rides a sine ping-pong of `range` tiles either side of (col,row) along
// `axis`, active in both day & night (unlike keys/switches/bridges there's no toggle-driven
// state to gate it on)
// `night` follows the portal's convention: undefined = active both day & night, true/false = one side only
export type ObstacleDef = { col: number; row: number; range: number; axis: 'x' | 'y'; speed?: number; night?: boolean }

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
  obstacles?: ObstacleDef[]
  // one-line control reminder shown above the player while this stage is active — only set on
  // the stage that first introduces the relevant key, so it never repeats once a player has seen it
  hint?: string
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
  hint: 'WASD MOVE',
}

// two single-tile pits (day == night) — just wide enough that walking in is fatal but a hop
// (space) clears them. First stage that requires jumping.
export const STAGE_JUMP: Scene = {
  spawn: { col: 0, row: 4 },
  day: parseMap(floor(10, '1110111011')),
  night: parseMap(floor(10, '1110111011')),
  portal: { col: 9, row: 4 },
  keys: { day: [{ col: 5, row: 4 }, { col: 8, row: 4 }], night: [] },
  switches: { day: [], night: [] },
  hint: 'SPACE JUMP',
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
  hint: 'J NIGHT',
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

// stages.md 3.1: a lattice of isolated 1-tile stepping stones (every stone one gap away from its
// neighbor, both by row and by column, so every move is a jump — no straight walking anywhere).
// Keys sit on the two safe outer edges (top row, left column); the portal sits dead center, where
// a row-patrolling obstacle and a column-patrolling obstacle cross paths, so the final approach
// always means timing both at once
export const STAGE_OBSTACLE_1: Scene = {
  spawn: { col: 0, row: 0 },
  day: parseMap(['10101', '00000', '10101', '00000', '10101']),
  night: parseMap(['10101', '00000', '10101', '00000', '10101']),
  portal: { col: 2, row: 2 },
  keys: { day: [{ col: 4, row: 0 }, { col: 0, row: 4 }], night: [] },
  switches: { day: [], night: [] },
  obstacles: [
    { col: 2, row: 2, range: 2, axis: 'x' },
    { col: 2, row: 2, range: 2, axis: 'y' },
  ],
}

// stages.md 3.2: a floor patrolled end-to-end by one obstacle, its stones spaced one gap apart
// (col0,2,4,6,8) so crossing it is a chain of jumps, never a walk — key at its far stone (col8).
// Spawn and portal sit on a shelf one row up (row2), also gapped: an easy key one jump from
// spawn, the portal two more jumps along — reachable only by jumping back up from the floor
// after the round trip for the far key, so the patrol's speed has to leave enough room for that
// whole there-and-back
export const STAGE_OBSTACLE_2: Scene = {
  spawn: { col: 2, row: 2 },
  day: parseMap(['000000000', '000000000', '101010000', '000000000', '101010101']),
  night: parseMap(['000000000', '000000000', '101010000', '000000000', '101010101']),
  portal: { col: 4, row: 2 },
  keys: { day: [{ col: 0, row: 2 }, { col: 8, row: 4 }], night: [] },
  switches: { day: [], night: [] },
  obstacles: [{ col: 4, row: 4, range: 4, axis: 'x', speed: 0.5 }],
}

// stages.md 3.3: a row patrolled end-to-end by a fast obstacle, in both day & night — but the
// night version of that row sits one jump further down than the day version, so the two modes
// aren't just a reskin of the same floor, they're different destinations. Every tile everywhere
// (shelf, day floor, night floor) is gapped to every-other-column (0,2,4,6,8, the STAGE_OBSTACLE_2
// convention) so every single move anywhere in this stage is a jump, never a walk.
// Spawn/portal share the row0 shelf, one tile apart (col0/col2, gap at col1). By day: drop one
// jump to row2, which is the hazard floor itself (day obstacle, key at col8), then jump back up to
// the shelf. By night: row2 is merely a safe two-stone bridge (col0/col2, no hazard) — you jump
// down to it, then jump down again through another empty row to row4, the real night hazard floor
// (night obstacle, its own key at col8), then reverse both jumps to reach the portal
export const STAGE_DODGE: Scene = {
  spawn: { col: 0, row: 0 },
  // trailing all-zero row on `day` matches the dirt row deriveTiles auto-grows under night's
  // row4 floor — without it day/night settle at different total heights, which shifts where
  // MAP_H centers the stage (and with it, the player/portal's apparent position) on toggle
  day: parseMap(['101000000', '000000000', '101010101', '000000000', '000000000', '000000000']),
  night: parseMap(['101000000', '000000000', '101000000', '000000000', '101010101']),
  portal: { col: 2, row: 0 },
  keys: { day: [{ col: 8, row: 2 }], night: [{ col: 8, row: 4 }] },
  switches: { day: [], night: [] },
  // one obstacle per floor, opposite-signed speed between them (sin(-x) = -sin(x)) — the day
  // obstacle and the night obstacle patrol in mirrored directions, even though they're never on
  // screen at the same time, so switching modes always flips which way the hazard is heading
  obstacles: [
    { col: 4, row: 2, range: 4, axis: 'x', speed: 1, night: false },
    { col: 4, row: 4, range: 4, axis: 'x', speed: -1, night: true },
  ],
}

// stages.md 3.4 (as redrawn): day row0 reads "P xRRx S" — portal(col0), gap, a plain platform
// (col2), the 2-tile rainbow-bridge gap (col3-4), another plain platform (col5), gap, spawn
// (col7). The bridge sits squarely between spawn and portal, so it's the one thing standing
// between the player and the exit, not an optional detour. The only way to raise it is a
// night-only switch on a lower floor (row2), reached by dropping through a gap row (row1) that
// only exists at night — day's row0 is solid there, so falling through isn't a day option; at
// night, row0 only keeps the spawn tile itself, forcing the drop. Row2's leftmost stone shares
// spawn's column (col7) in both modes, matching the doc's space-counts exactly: day's row2 is 3
// widely-spaced stones (col7,11,15, decorative, not on the critical path — nothing above it is
// walkable pre-bridge so it was never reachable anyway), night's row2 is 5 one-gap-apart stones
// (col7,9,11,13,15) patrolled by a night-only obstacle, switch at the center (col11), key at the
// far end (col15). Return path: retrace row2 back to col7, jump up to the spawn tile, toggle to
// day, then walk left across the now-bridged row0 (col5, col4, col3, col2) and a plain jump over
// the col1 gap to the portal at col0
export const STAGE_NIGHT_SWITCH: Scene = {
  spawn: { col: 7, row: 0 },
  // trailing all-zero row3 pads day out to match the dirt row deriveTiles auto-grows under
  // night's row2 floor — keeps day/night at the same total height so MAP_H (and the
  // player/portal's apparent position) doesn't shift on toggle
  day: parseMap(['1010010100000000', '0000000000000000', '0000000100010001', '0000000000000000']),
  night: parseMap(['0000000100000000', '0000000000000000', '0000000101010101']),
  portal: { col: 0, row: 0, night: false },
  keys: { day: [], night: [{ col: 15, row: 2 }] },
  switches: {
    night: [{ col: 11, row: 2, bridge: [{ col: 3, row: 0, night: false }, { col: 4, row: 0, night: false }] }],
    day: [],
  },
  obstacles: [{ col: 11, row: 2, range: 4, axis: 'x', night: true }],
}

// the "완료" (finished) stage: not a level, just a resting place. A plain 3x3 island, identical
// day and night, spawn dead center — nothing to solve, nothing to reach. portal.ts calls
// endGame() the instant this stage is entered, which (see render.ts) both hides the portal
// sprite and stamps FINISHED across the screen, so this stage's own `portal` coordinate is never
// actually rendered or reachable; it's set to the spawn tile purely to satisfy Scene's type
export const STAGE_FINAL: Scene = {
  spawn: { col: 1, row: 1 },
  day: parseMap(['111', '111', '111']),
  night: parseMap(['111', '111', '111']),
  portal: { col: 1, row: 1 },
  keys: { day: [], night: [] },
  switches: { day: [], night: [] },
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
  STAGE_OBSTACLE_1,
  STAGE_OBSTACLE_2,
  STAGE_DODGE,
  STAGE_NIGHT_SWITCH,
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
// grass tiles with open air directly above — the only spots decorative flowers can sit on top of
export const decorationSpots = (map: number[][]): { col: number; row: number }[] => {
  const spots: { col: number; row: number }[] = []
  map.forEach((row, r) => row.forEach((v, c) => v === TILE_GRASS && !map[r - 1]?.[c] && spots.push({ col: c, row: r })))
  return spots
}

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
