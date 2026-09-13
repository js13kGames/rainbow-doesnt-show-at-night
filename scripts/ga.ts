// dev-only GA that evolves stage floor patterns against fitness.ts's scorer. Run with:
//   node --experimental-strip-types scripts/ga.ts
// Prints one Scene literal (STAGES-array-ready, same shape editor.ts's serialize() produces) per
// target difficulty — copy-paste a result into src/components/map.ts to use it — and writes the
// matching Snapshot JSON to scripts/ga-out/stage-N.json, pickable straight from the editor's
// Import file input (no manual copy/paste needed).
import { mkdirSync, writeFileSync } from 'node:fs'
import { parseMap, type Scene, type SwitchDef } from '../src/components/map.ts'
import { scoreScene, DEFAULT_WEIGHTS, type Weights } from '../src/editor/fitness.ts'

const OUT_DIR = new URL('./ga-out/', import.meta.url)

// `platforms[t]` is tier t's row bits, t=0 being the tier closest to the floor — each tier sits
// exactly 2 rows above the one below it (floor included), matching the hop's 2-row reach (see
// fitness.ts HOP_OFFSETS / systems/jump.ts DISTANCE), same spacing STAGE_HEIGHT/GAUNTLET use by
// hand. `tiers` is fixed per GA run so every genome in a population has matching array shapes.
type Genome = { width: number; tiers: number; day: number[]; night: number[]; platforms: number[][]; keys: number[]; useSwitch: boolean }

const rand = (n: number) => Math.floor(Math.random() * n)
const floorRowOf = (tiers: number) => 2 + 2 * tiers
const platformRowOf = (tiers: number, t: number) => floorRowOf(tiers) - 2 * (t + 1)

// bottom-up: floor, then each platform tier with a blank spacer row, then 2 blank ceiling-
// clearance rows on top (mirrors the hand-made stages' padding above their highest platform)
function buildRows(floorBits: number[], platforms: number[][]): string[] {
  const blank = '0'.repeat(floorBits.length)
  const rows: string[] = [floorBits.join('')]
  platforms.forEach((p) => rows.unshift(blank, p.join('')))
  rows.unshift(blank, blank)
  return rows
}

function randomBits(width: number, density: number, pinEdges: boolean): number[] {
  const bits = Array.from({ length: width }, () => (Math.random() < density ? 1 : 0))
  if (pinEdges) {
    bits[0] = 1
    bits[width - 1] = 1
  }
  return bits
}

function randomGenome(width: number, tiers: number): Genome {
  // a wider density spread per genome (instead of one fixed density for every stage) is what
  // makes generated floors/platforms look different from run to run instead of all converging on
  // the same ~85%-solid look
  const day = randomBits(width, 0.6 + Math.random() * 0.3, true)
  const night = randomBits(width, 0.6 + Math.random() * 0.3, true)
  const platforms = Array.from({ length: tiers }, () => randomBits(width, 0.3 + Math.random() * 0.3, false))
  const keyCols = Array.from({ length: width - 2 }, (_, i) => i + 1)
  const nKeys = rand(3) // 0, 1 or 2 keys
  const keys = Array.from({ length: nKeys }, () => keyCols[rand(keyCols.length)]!)
  return { width, tiers, day, night, platforms, keys, useSwitch: Math.random() < 0.5 }
}

// first maximal run of 0s in `day` that isn't touching either edge, with the switch sitting on
// the walkable tile right before it — mirrors how the hand-made STAGE_SWITCH is built
function findGap(day: number[]): { col: number; bridge: number[] } | null {
  for (let start = 1; start < day.length - 1; start++) {
    if (day[start] !== 0 || day[start - 1] !== 1) continue
    let end = start
    while (end + 1 < day.length - 1 && day[end + 1] === 0) end++
    return { col: start - 1, bridge: Array.from({ length: end - start + 1 }, (_, i) => start + i) }
  }
  return null
}

// resolves a genome to its actual day/night bit rows + switch def — a switch's bridge is the
// ONLY way across its gap, so this also blocks that gap in `night` (otherwise toggling would
// bypass the switch entirely and the GA would never need to use it)
function phenotype(g: Genome): { day: number[]; night: number[]; switches: SwitchDef[] } {
  const day = [...g.day]
  const night = [...g.night]
  const switches: SwitchDef[] = []
  if (g.useSwitch) {
    const gap = findGap(day)
    if (gap) {
      gap.bridge.forEach((c) => (night[c] = 0))
      switches.push({ col: gap.col, row: floorRowOf(g.tiers), bridge: gap.bridge.map((col) => ({ col, row: floorRowOf(g.tiers), night: false })) })
    }
  }
  return { day, night, switches }
}

function toScene(g: Genome): Scene {
  const { day, night, switches } = phenotype(g)
  const floorRow = floorRowOf(g.tiers)
  return {
    spawn: { col: 0, row: floorRow },
    day: parseMap(buildRows(day, g.platforms)),
    night: parseMap(buildRows(night, g.platforms)),
    portal: { col: g.width - 1, row: floorRow },
    keys: { day: g.keys.map((col) => ({ col, row: floorRow })), night: [] },
    switches: { day: switches, night: [] },
  }
}

function mutate(g: Genome, rate: number): Genome {
  const flipFloor = (bits: number[]) => bits.map((b, i) => (i > 0 && i < bits.length - 1 && Math.random() < rate ? 1 - b : b))
  const flipPlatform = (bits: number[]) => bits.map((b) => (Math.random() < rate ? 1 - b : b))
  const keys = g.keys
    .map((c) => (Math.random() < rate ? Math.max(1, Math.min(g.width - 2, c + (rand(3) - 1))) : c))
    .filter(() => Math.random() > rate * 0.3)
  if (Math.random() < rate * 0.5 && keys.length < 2) keys.push(1 + rand(g.width - 2))
  const useSwitch = Math.random() < rate * 0.5 ? !g.useSwitch : g.useSwitch
  return { width: g.width, tiers: g.tiers, day: flipFloor(g.day), night: flipFloor(g.night), platforms: g.platforms.map(flipPlatform), keys, useSwitch }
}

function crossover(a: Genome, b: Genome): Genome {
  const mix = (x: number[], y: number[]) => {
    const cut = 1 + rand(x.length - 2)
    return x.map((v, i) => (i < cut ? v : y[i]!))
  }
  const keys = Math.random() < 0.5 ? a.keys : b.keys
  const useSwitch = Math.random() < 0.5 ? a.useSwitch : b.useSwitch
  const platforms = a.platforms.map((p, t) => mix(p, b.platforms[t]!))
  return { width: a.width, tiers: a.tiers, day: mix(a.day, b.day), night: mix(a.night, b.night), platforms, keys: [...keys], useSwitch }
}

function tournament(pop: Genome[], scores: number[], k = 3): Genome {
  let best = rand(pop.length)
  for (let i = 1; i < k; i++) {
    const c = rand(pop.length)
    if (scores[c]! > scores[best]!) best = c
  }
  return pop[best]!
}

function runGA(width: number, tiers: number, target: number, weights: Weights, popSize = 40, generations = 150) {
  let pop = Array.from({ length: popSize }, () => randomGenome(width, tiers))
  let best: { genome: Genome; fitness: number } | null = null

  for (let gen = 0; gen < generations; gen++) {
    const scores = pop.map((g) => scoreScene(toScene(g), target, weights).fitness)
    scores.forEach((s, i) => {
      if (!best || s > best.fitness) best = { genome: pop[i]!, fitness: s }
    })

    const ranked = pop.map((g, i) => ({ g, s: scores[i]! })).sort((a, b) => b.s - a.s)
    const next: Genome[] = ranked.slice(0, 2).map((r) => r.g) // elitism
    while (next.length < popSize) {
      const a = tournament(pop, scores)
      const b = tournament(pop, scores)
      next.push(mutate(crossover(a, b), 0.06))
    }
    pop = next
  }
  return best!
}

// Snapshot shape matches the editor's save-slot / import format (raw pre-deriveTiles grids) —
// paste this line into the editor's "Import" box to see/playtest the generated stage
function toSnapshot(g: Genome) {
  const { day, night, switches } = phenotype(g)
  const floorRow = floorRowOf(g.tiers)
  const grid = (bits: string[]) => bits.map((r) => r.split('').map(Number))
  return {
    day: grid(buildRows(day, g.platforms)),
    night: grid(buildRows(night, g.platforms)),
    spawn: { col: 0, row: floorRow },
    portal: { col: g.width - 1, row: floorRow },
    keys: { day: g.keys.map((col) => ({ col, row: floorRow })), night: [] },
    switches: { day: switches, night: [] },
  }
}

// serializes the RAW authoring rows (pre-deriveTiles) so the output matches how STAGE_1 etc. are
// hand-written in map.ts — `toScene`'s day/night grids have already been through parseMap and
// would double up if wrapped in another parseMap([...]) call
function serialize(g: Genome): string {
  const { day, night, switches } = phenotype(g)
  const floorRow = floorRowOf(g.tiers)
  const lines = (rows: string[]) => rows.map((r) => `    '${r}',`).join('\n')
  const pt = (col: number) => `{ col: ${col}, row: ${floorRow} }`
  const bridge = (b: { col: number; row: number; night: boolean }) => `{ col: ${b.col}, row: ${b.row}, night: ${b.night} }`
  const sw = (s: SwitchDef) => `{ col: ${s.col}, row: ${s.row}, bridge: [${s.bridge.map(bridge).join(', ')}] }`
  return `{
  spawn: { col: 0, row: ${floorRow} },
  day: parseMap([
${lines(buildRows(day, g.platforms))}
  ]),
  night: parseMap([
${lines(buildRows(night, g.platforms))}
  ]),
  portal: { col: ${g.width - 1}, row: ${floorRow} },
  keys: { day: [${g.keys.map(pt).join(', ')}], night: [] },
  switches: { day: [${switches.map(sw).join(', ')}], night: [] },
}`
}

// targets pulled from fitness.test.ts's calibration table (difficulty of the 11 hand-made
// stages) — a spread across that range gives a comparable easy-to-hard set
const TARGETS = [2, 4, 6, 9, 12, 16, 20]

mkdirSync(OUT_DIR, { recursive: true })

TARGETS.forEach((target, i) => {
  const width = 12 + i * 3 // wider than before, and grows faster across the target spread
  const tiers = 1 + (i % 2) // alternate flat (5-row) / two-tier (7-row) stages for vertical variety
  const { genome, fitness } = runGA(width, tiers, target, DEFAULT_WEIGHTS)
  console.log(`// target D=${target}, tiers=${tiers}, fitness=${fitness.toFixed(2)}`)
  console.log(`export const STAGE_GA_${i}: Scene = ${serialize(genome)}\n`)

  const outFile = new URL(`./stage-${i}.json`, OUT_DIR)
  writeFileSync(outFile, JSON.stringify(toSnapshot(genome)))
  console.log(`-> wrote ${outFile.pathname} (pick it in the editor's Import file picker)\n`)
})
