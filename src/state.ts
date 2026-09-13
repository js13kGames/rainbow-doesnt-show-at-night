import { TILE_W, GRID_H, TILE_DIRT, activeScene, decorationSpots } from './components/map.ts'

type Cell = { x: number; y: number; w?: number; h?: number }

const PLATFORM_GRASS_CELL = { x: 1, y: 1, w: 1, h: 1 }
const PLATFORM_DIRT_CELL = { x: 1, y: 2, w: 1, h: 1 }
const PLATFORM_NIGHT_GRASS_CELL = { x: 0, y: 1, w: 1, h: 1 }
const PLATFORM_NIGHT_DIRT_CELL = { x: 0, y: 2, w: 1, h: 1 }
// hazard art: a 2x1-cell strip at atlas row 4 (pixels (0,64)-(31,79))
export const OBSTACLE_CELL = { x: 0, y: 4, w: 2, h: 1 }
export const PORTAL_OPEN_CELL = { x: 3, y: 2, w: 1, h: 1 }
export const PORTAL_CLOSED_CELL = { x: 2, y: 2, w: 1, h: 1 }
// key art is a tiny icon at atlas pixels (44,16)-(47,23) inclusive, not a full 16x16 cell —
// inclusive bounds mean a 4x8px region (47-44+1, 23-16+1); cell coords are in cell units
// (px/16), so this addresses that sub-region exactly, including its right/bottom edge pixels
export const KEY_CELL = { x: 44 / 16, y: 16 / 16, w: 4 / 16, h: 8 / 16 }
// tiles are square (TILE_W === GRID_H), so every platform/portal shares one half-extent
export const TILE_R = TILE_W / 2
// matches the SCALE=2.5 rule other sprites use (source px * SCALE / 2), sized to the icon's
// actual 4x8 aspect ratio instead of stretching it into a square
export const KEY_R = (4 * 2.5) / 2
export const KEY_R2 = (8 * 2.5) / 2
// obstacle art is a 2x1-cell strip (2:1 aspect), unlike the square platform/portal cells
export const OBSTACLE_R = (32 * 2.5) / 2
export const OBSTACLE_R2 = (16 * 2.5) / 2
export const SWITCH_CELL = { x: 2, y: 0, w: 1, h: 1 }
export const SWITCH_STEPPED_CELL = { x: 3, y: 0, w: 1, h: 1 }
export const BRIDGE_CELL = { x: 3, y: 1, w: 1, h: 1 }

// decoration art (flowers, bushes): small icons on the atlas (see scripts/flower.ts and
// scripts/bushes.ts for their pixel boxes), each converted from an inclusive pixel box to cell
// units (px/16) like KEY_CELL, with r/r2 derived the same way as KEY_R/KEY_R2 but per-icon
// since these aren't all the same pixel size
const spriteFromBox = (x0: number, y0: number, x1: number, y1: number) => {
  const w = x1 - x0 + 1
  const h = y1 - y0 + 1
  return { cell: { x: x0 / 16, y: y0 / 16, w: w / 16, h: h / 16 }, r: (w * 2.5) / 2, r2: (h * 2.5) / 2 }
}
// day-only: scripts/flower.ts
const FLOWER_SPRITES = [spriteFromBox(32, 24, 34, 31), spriteFromBox(36, 26, 38, 31), spriteFromBox(40, 24, 42, 31), spriteFromBox(44, 24, 46, 31)]
// night-only: scripts/bushes.ts
const BUSH_SPRITES = [spriteFromBox(0, 53, 4, 63), spriteFromBox(6, 51, 9, 63), spriteFromBox(12, 57, 14, 63)]

// only one moving entity exists (the player), so its "components" are just plain fields
// true once the final stage's portal has been reached — freezes the stage-advance loop so the
// last scene stays on screen instead of wrapping back to STAGE_1
export let ended = false
export const endGame = () => (ended = true)

export const player = {
  x: 0,
  y: 0,
  rotation: 0,
  r: 20,
  r2: 20, // always overwritten by updateWobble before the first render — never actually undefined
  oy: 0, // same
  flip: undefined as number | undefined, // genuinely optional: unset until the player first moves horizontally
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

export const portal = { x: 0, y: 0, oy: -GRID_H / 2, night: undefined as boolean | undefined }

export function respawnPortal() {
  const { col, row, night } = activeScene().portal
  portal.x = col * TILE_W + TILE_W / 2
  portal.y = row * GRID_H + GRID_H / 2
  portal.night = night
}

export type KeyEnt = { x: number; y: number; night: boolean; collected: boolean }
export let keys: KeyEnt[] = []

export function respawnKeys() {
  const { day, night } = activeScene().keys
  const toEnt = (isNight: boolean) => ({ col, row }: { col: number; row: number }) => ({
    x: col * TILE_W + TILE_W / 2,
    y: row * GRID_H + GRID_H / 2,
    night: isNight,
    collected: false,
  })
  keys = [...day.map(toEnt(false)), ...night.map(toEnt(true))]
}

export const allKeysCollected = () => keys.every((k) => k.collected)

export type SwitchEnt = { x: number; y: number; bridge: { col: number; row: number; night: boolean }[]; night: boolean; stepped: boolean }
export let switches: SwitchEnt[] = []

export function respawnSwitches() {
  const { day, night } = activeScene().switches
  const toEnt = (isNight: boolean) => (s: { col: number; row: number; bridge: { col: number; row: number; night: boolean }[] }) => ({
    x: s.col * TILE_W + TILE_W / 2,
    y: s.row * GRID_H + GRID_H / 2,
    bridge: s.bridge,
    night: isNight,
    stepped: false,
  })
  switches = [...day.map(toEnt(false)), ...night.map(toEnt(true))]
}

// switches stay stepped across day/night toggles and stage transitions rebuild them fresh — only
// a fall-death resets them, so a raised bridge is a temporary reprieve, not a permanent shortcut
export function resetSwitches() {
  switches.forEach((s) => (s.stepped = false))
}

// a switch's own `night` only gates when it can be stepped on (which side its platform sits
// on) — each bridge tile carries its own `night`, so a stepped switch can raise tiles on either
// side regardless of which side the switch itself is on
export function activeBridgeTiles(isNight: boolean): Set<string> {
  const tiles = new Set<string>()
  switches.forEach((s) => {
    if (!s.stepped) return
    s.bridge.forEach(({ col, row, night }) => night === isNight && tiles.add(`${col},${row}`))
  })
  return tiles
}

export type ObstacleEnt = { x0: number; y0: number; range: number; axis: 'x' | 'y'; speed: number; t: number; x: number; y: number; night: boolean | undefined }
export let obstacles: ObstacleEnt[] = []

export function respawnObstacles() {
  obstacles = (activeScene().obstacles ?? []).map((o) => {
    const x = o.col * TILE_W + TILE_W / 2
    const y = o.row * GRID_H + GRID_H / 2
    const range = o.range * (o.axis === 'x' ? TILE_W : GRID_H)
    return { x0: x, y0: y, range, axis: o.axis, speed: o.speed ?? 1, t: 0, x, y, night: o.night }
  })
}

// decorative flowers (day-only) and bushes (night-only), grown in patches across grass tops
// each time a stage loads — `night` picks which side a given decoration shows on, same
// convention as KeyEnt/SwitchEnt, since day and night maps can have different tile layouts
export type Decoration = { x: number; y: number; r: number; r2: number; cell: Cell; night: boolean }
export let decorations: Decoration[] = []
// run-length clumping instead of an independent coin-flip per tile — reads as patches of
// growth separated by bare ground, not dust scattered evenly across the whole floor
const CLUMP_CHANCE = 0.4
const runLength = (min: number, span: number) => min + Math.floor(Math.random() * span)

const scatter = (map: number[][], sprites: { cell: Cell; r: number; r2: number }[], night: boolean): Decoration[] => {
  const decos: Decoration[] = []
  let inClump = Math.random() < CLUMP_CHANCE
  let remaining = inClump ? runLength(2, 3) : runLength(2, 4)
  let spots = decorationSpots(map)
  // bushes cluster into one tight patch instead of scattering across the whole map
  if (night) {
    const width = Math.min(spots.length, runLength(4, 5))
    const start = Math.floor(Math.random() * Math.max(1, spots.length - width))
    spots = spots.slice(start, start + width)
  }
  spots.forEach(({ col, row }) => {
    if (remaining-- === 0) {
      inClump = !inClump
      remaining = inClump ? runLength(2, 3) : runLength(2, 4)
    }
    if (!inClump) return
    const { cell, r, r2 } = sprites[Math.floor(Math.random() * sprites.length)]!
    // random spot anywhere inside the tile's own bounds (clamped so the sprite doesn't poke
    // past the tile edge), not pinned to the tile center — off-grid so a patch doesn't look
    // like a row of icons
    const x = col * TILE_W + r + Math.random() * (TILE_W - 2 * r)
    const y = row * GRID_H + r2 + Math.random() * (GRID_H - 2 * r2)
    decos.push({ x, y, r, r2, cell, night })
  })
  return decos
}

export function respawnDecorations() {
  const { day, night } = activeScene()
  decorations = [...scatter(day, FLOWER_SPRITES, false), ...scatter(night, BUSH_SPRITES, true)]
}

export type PlatformTile = { x: number; y: number; cell: Cell }
export let platforms: PlatformTile[] = []

export function respawnPlatforms(map: number[][], night: boolean) {
  platforms = []
  map.forEach((row, r) =>
    row.forEach((tile, c) => {
      if (tile === 0) return
      const isDirt = tile === TILE_DIRT
      const cell = isDirt ? (night ? PLATFORM_NIGHT_DIRT_CELL : PLATFORM_DIRT_CELL) : night ? PLATFORM_NIGHT_GRASS_CELL : PLATFORM_GRASS_CELL
      platforms.push({ x: c * TILE_W + TILE_W / 2, y: r * GRID_H + GRID_H / 2, cell })
    }),
  )
}
