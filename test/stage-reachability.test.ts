import { describe, expect, it } from 'vitest'
import { STAGES, isWalkableBox, TILE_W, GRID_H } from '../src/components/map.ts'

// BFS over (col, row, night, steppedSwitches, collectedKeys), mirroring the real game's rules:
// - walking: 4-directional adjacency to an adjacent walkable tile
// - jumping: skip exactly one unwalkable tile in a straight line (horizontal or vertical — a
//   diagonal jump would need sqrt(TILE_W^2+GRID_H^2) > the game's max jump distance, so it's
//   never a valid move and isn't modeled here)
// - toggling night in place (only valid if the destination tile is walkable in the new mode)
// - stepping a switch / collecting a key when standing on its tile
// - reaching the portal only counts if every key has been collected
//
// This mirrors state.ts's activeBridgeTiles: ALL switches (day-defined and night-defined)
// contribute bridge tiles, filtered only by each bridge tile's own `night` flag — not by which
// side the switch itself was defined on.
//
// IDs use `_` (not `,`) between a tile's col/row so a joined multi-entry string can be safely
// split on `,` without an individual entry's own separator colliding with it.
type State = { col: number; row: number; night: boolean; switches: string; keys: string }

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const

describe('stage reachability', () => {
  STAGES.forEach((scene, i) => {
    it(`stage ${i} is solvable and has no switch bypass`, () => {
      const map = (night: boolean) => (night ? scene.night : scene.day)
      const height = scene.day.length
      const width = scene.day[0]!.length
      const px = (col: number) => col * TILE_W + TILE_W / 2
      const py = (row: number) => row * GRID_H + GRID_H / 2

      const bridgeSet = (night: boolean, stepped: Set<string>) => {
        const s = new Set<string>()
        for (const sw of [...scene.switches.day, ...scene.switches.night]) {
          if (!stepped.has(`sw${sw.col}_${sw.row}`)) continue
          for (const b of sw.bridge) if (b.night === night) s.add(`${b.col},${b.row}`)
        }
        return s
      }

      const walkable = (col: number, row: number, night: boolean, stepped: Set<string>) =>
        col >= 0 && col < width && row >= 0 && row < height && isWalkableBox(map(night), px(col), py(row), 0, 0, 0, bridgeSet(night, stepped))

      const allKeys = new Set<string>()
      scene.keys.day.forEach((k) => allKeys.add(`d${k.col}_${k.row}`))
      scene.keys.night.forEach((k) => allKeys.add(`n${k.col}_${k.row}`))

      const start: State = { col: scene.spawn.col, row: scene.spawn.row, night: false, switches: '', keys: '' }
      const idOf = (s: State) => `${s.col}_${s.row}|${s.night}|${s.switches}|${s.keys}`
      const seen = new Set<string>([idOf(start)])
      const q: State[] = [start]
      let reachedPortal = false
      let sawBypassWithoutAnySwitch = false
      const hasSwitches = scene.switches.day.length + scene.switches.night.length > 0
      let steps = 0

      while (q.length) {
        expect(++steps).toBeLessThan(50000)
        const s = q.shift()!
        const steppedSet = new Set(s.switches ? s.switches.split(',') : [])
        if (!walkable(s.col, s.row, s.night, steppedSet)) continue

        let keys = s.keys
        const kside = s.night ? scene.keys.night : scene.keys.day
        const kmatch = kside.find((k) => k.col === s.col && k.row === s.row)
        if (kmatch) {
          const kk = (s.night ? 'n' : 'd') + s.col + '_' + s.row
          if (!keys.split(',').includes(kk)) keys = keys ? keys + ',' + kk : kk
        }

        let switches = s.switches
        const swside = s.night ? scene.switches.night : scene.switches.day
        const swmatch = swside.find((sw) => sw.col === s.col && sw.row === s.row)
        if (swmatch) {
          const swk = `sw${swmatch.col}_${swmatch.row}`
          if (!switches.split(',').includes(swk)) switches = switches ? switches + ',' + swk : swk
        }

        if (s.col === scene.portal.col && s.row === scene.portal.row && (scene.portal.night === undefined || scene.portal.night === s.night)) {
          const gotAll = [...allKeys].every((k) => keys.split(',').includes(k))
          if (gotAll) {
            reachedPortal = true
            if (hasSwitches && switches === '') sawBypassWithoutAnySwitch = true
          }
        }

        const next = (ns: State) => {
          const nid = idOf(ns)
          if (!seen.has(nid)) {
            seen.add(nid)
            q.push(ns)
          }
        }
        for (const [dc, dr] of DIRS) {
          next({ col: s.col + dc, row: s.row + dr, night: s.night, switches, keys })
          // jump: skip exactly one unwalkable tile in the same direction
          if (!walkable(s.col + dc, s.row + dr, s.night, new Set(switches ? switches.split(',') : [])))
            next({ col: s.col + dc * 2, row: s.row + dr * 2, night: s.night, switches, keys })
        }
        next({ col: s.col, row: s.row, night: !s.night, switches, keys })
      }

      expect(reachedPortal).toBe(true)
      expect(sawBypassWithoutAnySwitch).toBe(false)
    })
  })
})
