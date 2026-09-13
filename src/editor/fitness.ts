// dev-only stage scorer (not imported by main.ts, so it never reaches the js13k bundle) — used
// to validate hand-made STAGES and, later, to drive a GA over generated ones.
import { TILE_GRASS, type Scene } from '../components/map.ts'

export type EdgeType = 'walk' | 'hop' | 'toggle'

export type SolveResult = {
  length: number // edges on the shortest solving path
  hopCount: number
  toggleCount: number
  switchCount: number // distinct switches activated on the path
  mechanicSet: Set<EdgeType | 'switch'>
  turnCount: number // direction changes among consecutive walk/hop edges
  keyDist: number[] // edges from spawn to each key's first pickup, in day-then-night order
  deadTileRatio: number // walkable (col,row,night) tiles never visited by the solver, as a fraction
}

// a jump travels ~1.3 tiles in a straight line (see systems/jump.ts DISTANCE) — from the edge of
// a solid tile that lands one tile past a single empty gap, i.e. a chebyshev distance of 2 in
// grid terms. Diagonal jumps don't reach that far (the 1.3-tile distance is split across both
// axes), so only orthogonal hops are modeled.
const WALK_OFFSETS: [number, number][] = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
]
const HOP_OFFSETS: [number, number][] = [[2, 0], [-2, 0], [0, 2], [0, -2]]

type State = { col: number; row: number; night: boolean; sw: number; kb: number }
const stateKey = (s: State) => `${s.col},${s.row},${s.night ? 1 : 0},${s.sw},${s.kb}`
const popcount = (n: number) => n.toString(2).split('1').length - 1

// a hop covers 2 tiles of grid distance — costed slightly above 2 walk steps (not equal) so
// Dijkstra only picks a hop when it's the only way across (a real gap), never as a tied
// coin-flip alternative to walking the same distance over open ground.
const EDGE_COST: Record<EdgeType, number> = { walk: 1, hop: 2.5, toggle: 1 }

// Dijkstra over (position, day/night, activated switches, collected keys) — small enough state
// space (a handful of keys/switches per stage) that a plain O(V^2) extract-min needs no heap.
export function solve(scene: Scene): SolveResult | null {
  const keys = [...scene.keys.day.map((k) => ({ ...k, night: false })), ...scene.keys.night.map((k) => ({ ...k, night: true }))]
  const switches = [...scene.switches.day.map((s) => ({ ...s, night: false })), ...scene.switches.night.map((s) => ({ ...s, night: true }))]
  const grid = (night: boolean) => (night ? scene.night : scene.day)

  const walkable = (col: number, row: number, night: boolean, sw: number): boolean =>
    grid(night)[row]?.[col] === TILE_GRASS ||
    switches.some((s, i) => (sw & (1 << i)) !== 0 && s.bridge.some((b) => b.col === col && b.row === row && b.night === night))

  const bitsAt = (col: number, row: number, night: boolean) => ({
    kb: keys.reduce((bit, k, i) => (k.col === col && k.row === row && k.night === night ? bit | (1 << i) : bit), 0),
    sw: switches.reduce((bit, s, i) => (s.col === col && s.row === row && s.night === night ? bit | (1 << i) : bit), 0),
  })

  const step = (cur: State, col: number, row: number, night: boolean): State | null => {
    if (!walkable(col, row, night, cur.sw)) return null
    const at = bitsAt(col, row, night)
    return { col, row, night, sw: cur.sw | at.sw, kb: cur.kb | at.kb }
  }

  const startAt = bitsAt(scene.spawn.col, scene.spawn.row, false)
  const start: State = { col: scene.spawn.col, row: scene.spawn.row, night: false, sw: startAt.sw, kb: startAt.kb }
  const allKeys = keys.length ? (1 << keys.length) - 1 : 0
  const isGoal = (s: State) =>
    s.col === scene.portal.col &&
    s.row === scene.portal.row &&
    (scene.portal.night === undefined || scene.portal.night === s.night) &&
    s.kb === allKeys

  type Parent = { from: string; edge: EdgeType; dir: [number, number] | null } | null
  const parent = new Map<string, Parent>()
  const byKey = new Map<string, State>()
  const visitedTiles = new Set<string>()
  const dist = new Map<string, number>()
  const done = new Set<string>()

  const startKey = stateKey(start)
  parent.set(startKey, null)
  byKey.set(startKey, start)
  dist.set(startKey, 0)
  visitedTiles.add(`${start.col},${start.row},${start.night ? 1 : 0}`)

  const frontier: string[] = [startKey]
  let goalKey: string | null = null

  while (frontier.length) {
    let bestIdx = 0
    for (let i = 1; i < frontier.length; i++) if (dist.get(frontier[i]!)! < dist.get(frontier[bestIdx]!)!) bestIdx = i
    const curKey = frontier.splice(bestIdx, 1)[0]!
    if (done.has(curKey)) continue
    done.add(curKey)
    const cur = byKey.get(curKey)!
    if (isGoal(cur)) { goalKey = curKey; break }

    const candidates: { s: State; edge: EdgeType; dir: [number, number] | null }[] = []
    const toggled = step(cur, cur.col, cur.row, !cur.night)
    if (toggled) candidates.push({ s: toggled, edge: 'toggle', dir: null })
    WALK_OFFSETS.forEach(([dc, dr]) => {
      const s = step(cur, cur.col + dc, cur.row + dr, cur.night)
      if (s) candidates.push({ s, edge: 'walk', dir: [dc, dr] })
    })
    HOP_OFFSETS.forEach(([dc, dr]) => {
      const s = step(cur, cur.col + dc, cur.row + dr, cur.night)
      if (s) candidates.push({ s, edge: 'hop', dir: [dc, dr] })
    })

    for (const { s, edge, dir } of candidates) {
      const k = stateKey(s)
      if (done.has(k)) continue
      const cost = dist.get(curKey)! + EDGE_COST[edge]
      if (dist.has(k) && dist.get(k)! <= cost) continue
      dist.set(k, cost)
      parent.set(k, { from: curKey, edge, dir })
      byKey.set(k, s)
      visitedTiles.add(`${s.col},${s.row},${s.night ? 1 : 0}`)
      frontier.push(k)
    }
  }
  if (!goalKey) return null

  const pathStates: State[] = []
  const edges: { edge: EdgeType; dir: [number, number] | null }[] = []
  let cursor: string | null = goalKey
  while (cursor) {
    pathStates.unshift(byKey.get(cursor)!)
    const p: Parent = parent.get(cursor)!
    if (p) edges.unshift({ edge: p.edge, dir: p.dir })
    cursor = p ? p.from : null
  }

  const hopCount = edges.filter((e) => e.edge === 'hop').length
  const toggleCount = edges.filter((e) => e.edge === 'toggle').length
  const finalState = pathStates[pathStates.length - 1]!
  const switchCount = popcount(finalState.sw)

  const moveDirs = edges.filter((e): e is { edge: EdgeType; dir: [number, number] } => e.dir !== null).map((e) => [Math.sign(e.dir[0]), Math.sign(e.dir[1])])
  const turnCount = moveDirs.slice(1).filter((d, i) => d[0] !== moveDirs[i]![0] || d[1] !== moveDirs[i]![1]).length

  const mechanicSet = new Set<EdgeType | 'switch'>()
  if (edges.some((e) => e.edge === 'walk')) mechanicSet.add('walk')
  if (hopCount) mechanicSet.add('hop')
  if (toggleCount) mechanicSet.add('toggle')
  if (switchCount) mechanicSet.add('switch')

  const keyDist = keys.map((_, i) => pathStates.findIndex((s) => (s.kb >> i) & 1))

  let totalWalkable = 0
  ;(['day', 'night'] as const).forEach((side) => scene[side].forEach((row) => row.forEach((v) => v === TILE_GRASS && totalWalkable++)))
  const deadTileRatio = totalWalkable ? Math.max(0, 1 - visitedTiles.size / totalWalkable) : 0

  return { length: edges.length, hopCount, toggleCount, switchCount, mechanicSet, turnCount, keyDist, deadTileRatio }
}

// difficulty proxy: toggles/switches are weighted above plain hops since they gate a puzzle step,
// not just a platforming beat
export const difficulty = (r: SolveResult): number => r.hopCount * 2 + r.toggleCount * 3 + r.switchCount * 3

export type Weights = { difficulty: number; mechanic: number; turn: number; deadTile: number; keyDist: number }
export const DEFAULT_WEIGHTS: Weights = { difficulty: 5, mechanic: 2, turn: 1, deadTile: 3, keyDist: 3 }
const DIFFICULTY_SIGMA = 3
const MIN_KEY_RATIO = 0.3 // a key closer to spawn than this fraction of the solve path gets penalized

export type FitnessResult = { fitness: number; solve: SolveResult | null; difficulty: number }

export function scoreScene(scene: Scene, target: number, weights: Weights = DEFAULT_WEIGHTS): FitnessResult {
  const r = solve(scene)
  if (!r) return { fitness: 0, solve: null, difficulty: NaN }
  const d = difficulty(r)
  const totalLength = r.length || 1
  const keyPenalty = r.keyDist.reduce((sum, dist) => sum + Math.max(0, MIN_KEY_RATIO - dist / totalLength), 0)
  const fitness =
    weights.difficulty * Math.exp(-((d - target) ** 2) / (2 * DIFFICULTY_SIGMA ** 2)) +
    weights.mechanic * r.mechanicSet.size +
    weights.turn * r.turnCount -
    weights.deadTile * r.deadTileRatio -
    weights.keyDist * keyPenalty
  return { fitness, solve: r, difficulty: d }
}
