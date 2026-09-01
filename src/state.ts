import { TILE_W, GRID_H, TILE_DIRT, activeScene } from './components/map.ts'

type Cell = { x: number; y: number; w?: number; h?: number }

const PLATFORM_GRASS_CELL = { x: 1, y: 1, w: 1, h: 1 }
const PLATFORM_DIRT_CELL = { x: 1, y: 2, w: 1, h: 1 }
const PLATFORM_NIGHT_GRASS_CELL = { x: 0, y: 1, w: 1, h: 1 }
const PLATFORM_NIGHT_DIRT_CELL = { x: 0, y: 2, w: 1, h: 1 }
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
export const SWITCH_CELL = { x: 2, y: 0, w: 1, h: 1 }
export const SWITCH_STEPPED_CELL = { x: 3, y: 0, w: 1, h: 1 }
export const BRIDGE_CELL = { x: 3, y: 1, w: 1, h: 1 }

// only one moving entity exists (the player), so its "components" are just plain fields
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
