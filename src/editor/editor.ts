// Dev-only visual map editor — not part of the js13k build (see AGENTS.md). Open via
// `pnpm dev` at /src/editor/index.html. Shares Scene/SwitchDef and the parseMap/deriveTiles
// pipeline with the real game so its export pastes straight into components/map.ts.
import { STAGES, deriveTiles, type Scene, type SwitchDef, type ObstacleDef } from '../components/map.ts'

type Pt = { col: number; row: number }
type Side = 'day' | 'night'
type Brush = 'tile' | 'spawn' | 'key' | 'portal' | 'switch' | 'bridge' | 'obstacle'

const CELL_PX = 16
const DISPLAY = 32
const CELL_GRASS = { x: 1, y: 1 }
const CELL_NIGHT_GRASS = { x: 0, y: 1 }
const CELL_DIRT = { x: 1, y: 2 }
const CELL_NIGHT_DIRT = { x: 0, y: 2 }
const CELL_PORTAL = { x: 3, y: 2 }
const CELL_KEY = { x: 44 / 16, y: 16 / 16, w: 4 / 16, h: 8 / 16 }
const CELL_SWITCH = { x: 2, y: 0 }
const CELL_BRIDGE = { x: 3, y: 1 }
const CELL_OBSTACLE = { x: 0, y: 4, w: 2, h: 1 }

const STAGE_NAMES = [
  'STAGE_1', 'STAGE_JUMP', 'STAGE_HEIGHT', 'STAGE_NIGHT', 'STAGE_SWITCH', 'STAGE_COMBO',
  'STAGE_CROSS', 'STAGE_MULTI', 'STAGE_NIGHTJUMP', 'STAGE_GAUNTLET', 'STAGE_FINAL',
]

const blank = (w: number, h: number): number[][] =>
  [...Array(h)].map(() => new Array(w).fill(0))

const state = {
  day: blank(10, 5),
  night: blank(10, 5),
  spawn: { col: 0, row: 4 } as Pt,
  portal: { col: 9, row: 4 } as Scene['portal'],
  keys: { day: [] as Pt[], night: [] as Pt[] },
  switches: { day: [] as SwitchDef[], night: [] as SwitchDef[] },
  obstacles: [] as ObstacleDef[],
  cursor: { col: 0, row: 4 } as Pt,
  mode: 'day' as Side,
  brush: 'tile' as Brush,
  activeSwitch: null as { side: Side; idx: number } | null,
  activeObstacle: null as number | null,
}

const w = () => state.day[0]!.length
const h = () => state.day.length
const activeSwitchDef = (): SwitchDef | undefined =>
  state.activeSwitch ? state.switches[state.activeSwitch.side][state.activeSwitch.idx] : undefined

function ensureSize(col: number, row: number) {
  const needW = Math.max(w(), col + 1)
  const needH = Math.max(h(), row + 1)
  ;(['day', 'night'] as const).forEach((m) => {
    const g = state[m]
    while (g.length < needH) g.push(new Array(g[0]?.length ?? needW).fill(0))
    g.forEach((r) => {
      while (r.length < needW) r.push(0)
    })
  })
}

function moveCursor(dc: number, dr: number) {
  const col = Math.max(0, state.cursor.col + dc)
  const row = Math.max(0, state.cursor.row + dr)
  ensureSize(col, row)
  state.cursor = { col, row }
  scrollToCursor()
  render()
}

function place() {
  const { col, row } = state.cursor
  if (state.brush === 'tile') state[state.mode][row]![col] = 1
  else if (state.brush === 'spawn') {
    state.spawn.col = col
    state.spawn.row = row
  } else if (state.brush === 'key') {
    const list = state.keys[state.mode]
    if (!list.some((k) => k.col === col && k.row === row)) list.push({ col, row })
  } else if (state.brush === 'portal') {
    state.portal.col = col
    state.portal.row = row
  } else if (state.brush === 'switch') {
    const list = state.switches[state.mode]
    let idx = list.findIndex((s) => s.col === col && s.row === row)
    if (idx < 0) {
      list.push({ col, row, bridge: [] })
      idx = list.length - 1
    }
    state.activeSwitch = { side: state.mode, idx }
  } else if (state.brush === 'bridge') {
    const sw = activeSwitchDef()
    if (sw && !(sw.col === col && sw.row === row)) {
      const night = state.mode === 'night'
      if (!sw.bridge.some((b) => b.col === col && b.row === row && b.night === night)) sw.bridge.push({ col, row, night })
    }
  } else if (state.brush === 'obstacle') {
    let idx = state.obstacles.findIndex((o) => o.col === col && o.row === row)
    if (idx < 0) {
      state.obstacles.push({ col, row, range: 1, axis: 'x' })
      idx = state.obstacles.length - 1
    }
    state.activeObstacle = idx
  }
  render()
}

const activeObstacleDef = (): ObstacleDef | undefined =>
  state.activeObstacle === null ? undefined : state.obstacles[state.activeObstacle]

function cycleObstacleAxis() {
  const o = activeObstacleDef()
  if (o) o.axis = o.axis === 'x' ? 'y' : 'x'
  render()
}

function adjustObstacleRange(delta: number) {
  const o = activeObstacleDef()
  if (o) o.range = Math.max(1, o.range + delta)
  render()
}

function cycleObstacleNight() {
  const o = activeObstacleDef()
  if (!o) return
  o.night = o.night === undefined ? false : o.night === false ? true : undefined
  render()
}

// removes whatever occupies the cursor's cell, regardless of the currently selected brush —
// checked most-specific first (a bridge tile / entity) down to the plain terrain tile, since an
// entity can sit on top of a tile and "backspace" should mean "erase what I'm looking at here"
function erase() {
  const { col, row } = state.cursor
  const night = state.mode === 'night'

  const keyList = state.keys[state.mode]
  const ki = keyList.findIndex((k) => k.col === col && k.row === row)
  if (ki >= 0) {
    keyList.splice(ki, 1)
    render()
    return
  }

  const swList = state.switches[state.mode]
  const si = swList.findIndex((s) => s.col === col && s.row === row)
  if (si >= 0) {
    swList.splice(si, 1)
    if (state.activeSwitch?.side === state.mode) {
      if (state.activeSwitch.idx === si) state.activeSwitch = null
      else if (state.activeSwitch.idx > si) state.activeSwitch.idx--
    }
    render()
    return
  }

  const activeSwitch = activeSwitchDef()
  const bi = activeSwitch?.bridge.findIndex((b) => b.col === col && b.row === row && b.night === night) ?? -1
  if (bi >= 0) {
    activeSwitch!.bridge.splice(bi, 1)
    render()
    return
  }

  const oi = state.obstacles.findIndex((o) => o.col === col && o.row === row)
  if (oi >= 0) {
    state.obstacles.splice(oi, 1)
    if (state.activeObstacle === oi) state.activeObstacle = null
    else if (state.activeObstacle !== null && state.activeObstacle > oi) state.activeObstacle--
    render()
    return
  }

  state[state.mode][row]![col] = 0
  render()
}

function cycleSwitch() {
  const all: { side: Side; idx: number }[] = []
  ;(['day', 'night'] as const).forEach((side) => state.switches[side].forEach((_, idx) => all.push({ side, idx })))
  if (!all.length) return
  const cur = state.activeSwitch ? all.findIndex((a) => a.side === state.activeSwitch!.side && a.idx === state.activeSwitch!.idx) : -1
  state.activeSwitch = all[(cur + 1) % all.length]!
  render()
}

function toggleMode() {
  state.mode = state.mode === 'day' ? 'night' : 'day'
  render()
}

function copyModeGrid() {
  const src = state[state.mode].map((r) => [...r])
  state[state.mode === 'day' ? 'night' : 'day'] = src
  render()
}

function cyclePortalNight() {
  state.portal.night = state.portal.night === undefined ? false : state.portal.night === false ? true : undefined
  render()
}

function loadStage(i: number) {
  if (Number.isNaN(i)) {
    state.day = blank(10, 5)
    state.night = blank(10, 5)
    state.spawn = { col: 0, row: 4 }
    state.portal = { col: 9, row: 4 }
    state.keys = { day: [], night: [] }
    state.switches = { day: [], night: [] }
    state.obstacles = []
  } else {
    const s = STAGES[i]!
    const strip = (g: number[][]) => g.map((r) => r.map((v) => (v === 1 ? 1 : 0)))
    state.day = strip(s.day)
    state.night = strip(s.night)
    state.spawn = { ...s.spawn }
    state.portal = { ...s.portal }
    state.keys = { day: s.keys.day.map((k) => ({ ...k })), night: s.keys.night.map((k) => ({ ...k })) }
    state.switches = {
      day: s.switches.day.map((sw) => ({ col: sw.col, row: sw.row, bridge: sw.bridge.map((b) => ({ ...b })) })),
      night: s.switches.night.map((sw) => ({ col: sw.col, row: sw.row, bridge: sw.bridge.map((b) => ({ ...b })) })),
    }
    state.obstacles = (s.obstacles ?? []).map((o) => ({ ...o }))
  }
  state.cursor = { ...state.spawn }
  state.activeSwitch = null
  state.activeObstacle = null
  render()
}

// named save slots in localStorage — separate from serialize()'s Scene-literal export: this is
// raw editable state meant to survive a reload/tab-close, not something you'd paste into map.ts
const STORAGE_KEY = 'js13k-editor-saves'
type Snapshot = Pick<typeof state, 'day' | 'night' | 'spawn' | 'portal' | 'keys' | 'switches' | 'obstacles'>

function getSaves(): Record<string, Snapshot> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function saveAs(name: string) {
  const { day, night, spawn, portal, keys, switches, obstacles } = state
  const saves = getSaves()
  saves[name] = { day, night, spawn, portal, keys, switches, obstacles }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saves))
  refreshSaveList(name)
  saveStatus.textContent = `saved "${name}" at ${new Date().toLocaleTimeString()}`
}

function applySnapshot(snap: Snapshot) {
  state.day = snap.day
  state.night = snap.night
  state.spawn = snap.spawn
  state.portal = snap.portal
  state.keys = snap.keys
  state.switches = snap.switches
  state.obstacles = snap.obstacles ?? []
  state.cursor = { ...state.spawn }
  state.activeSwitch = null
  state.activeObstacle = null
  render()
}

function loadSave(name: string) {
  const snap = getSaves()[name]
  if (!snap) return
  applySnapshot(snap)
  saveStatus.textContent = `loaded "${name}"`
}

// pastes in a Snapshot (same shape as a save slot) from outside the browser — e.g. scripts/ga.ts
// prints one per generated stage so a GA result can be inspected/playtested without hand-copying
// tile grids
function importJSON(text: string) {
  try {
    applySnapshot(JSON.parse(text) as Snapshot)
    importStatus.textContent = `imported at ${new Date().toLocaleTimeString()}`
  } catch (e) {
    importStatus.textContent = `invalid JSON: ${(e as Error).message}`
  }
}

function deleteSave(name: string) {
  const saves = getSaves()
  delete saves[name]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saves))
  refreshSaveList()
  saveStatus.textContent = `deleted "${name}"`
}

function refreshSaveList(selectName?: string) {
  const names = Object.keys(getSaves())
  saveList.innerHTML = ''
  names.forEach((name) => {
    const opt = document.createElement('option')
    opt.value = name
    opt.textContent = name
    saveList.appendChild(opt)
  })
  if (selectName) saveList.value = selectName
}

function buildScene(): Scene {
  return {
    spawn: { ...state.spawn },
    day: deriveTiles(state.day),
    night: deriveTiles(state.night),
    portal: { ...state.portal },
    keys: { day: state.keys.day.map((k) => ({ ...k })), night: state.keys.night.map((k) => ({ ...k })) },
    switches: {
      day: state.switches.day.map((s) => ({ col: s.col, row: s.row, bridge: s.bridge.map((b) => ({ ...b })) })),
      night: state.switches.night.map((s) => ({ col: s.col, row: s.row, bridge: s.bridge.map((b) => ({ ...b })) })),
    },
    obstacles: state.obstacles.map((o) => ({ ...o })),
  }
}

function playtest() {
  sessionStorage.setItem('js13k-editor-playtest', JSON.stringify(buildScene()))
  window.open('./play.html', '_blank')
}

function toRows(g: number[][]): string[] {
  return g.map((r) => r.map((v) => (v ? '1' : '0')).join(''))
}

function serialize(): string {
  const lines = (strs: string[]) => strs.map((r) => `    '${r}',`).join('\n')
  const pt = (p: Pt) => `{ col: ${p.col}, row: ${p.row} }`
  const bridge = (b: { col: number; row: number; night: boolean }) => `{ col: ${b.col}, row: ${b.row}, night: ${b.night} }`
  const sw = (s: SwitchDef) => `{ col: ${s.col}, row: ${s.row}, bridge: [${s.bridge.map(bridge).join(', ')}] }`
  const obstacle = (o: ObstacleDef) =>
    `{ col: ${o.col}, row: ${o.row}, range: ${o.range}, axis: '${o.axis}'${o.speed === undefined ? '' : `, speed: ${o.speed}`}${o.night === undefined ? '' : `, night: ${o.night}`} }`
  const portalNight = state.portal.night === undefined ? '' : `, night: ${state.portal.night}`
  return `{
  spawn: { col: ${state.spawn.col}, row: ${state.spawn.row} },
  day: parseMap([
${lines(toRows(state.day))}
  ]),
  night: parseMap([
${lines(toRows(state.night))}
  ]),
  portal: { col: ${state.portal.col}, row: ${state.portal.row}${portalNight} },
  keys: { day: [${state.keys.day.map(pt).join(', ')}], night: [${state.keys.night.map(pt).join(', ')}] },
  switches: { day: [${state.switches.day.map(sw).join(', ')}], night: [${state.switches.night.map(sw).join(', ')}] },
  obstacles: [${state.obstacles.map(obstacle).join(', ')}],
}`
}

// --- DOM wiring ---

const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!
const ctx = canvas.getContext('2d')!
const viewport = document.querySelector<HTMLDivElement>('#viewport')!
const modeBadge = document.querySelector<HTMLSpanElement>('#modeBadge')!
const brushLabel = document.querySelector<HTMLSpanElement>('#brushLabel')!
const sizeLabel = document.querySelector<HTMLSpanElement>('#sizeLabel')!
const spawnLabel = document.querySelector<HTMLSpanElement>('#spawnLabel')!
const portalLabel = document.querySelector<HTMLSpanElement>('#portalLabel')!
const keyList = document.querySelector<HTMLUListElement>('#keyList')!
const switchList = document.querySelector<HTMLUListElement>('#switchList')!
const obstacleList = document.querySelector<HTMLUListElement>('#obstacleList')!
const output = document.querySelector<HTMLTextAreaElement>('#output')!
const loadSelect = document.querySelector<HTMLSelectElement>('#loadSelect')!
const saveStatus = document.querySelector<HTMLSpanElement>('#saveStatus')!
const saveName = document.querySelector<HTMLInputElement>('#saveName')!
const saveList = document.querySelector<HTMLSelectElement>('#saveList')!
const importInput = document.querySelector<HTMLTextAreaElement>('#importInput')!
const importStatus = document.querySelector<HTMLSpanElement>('#importStatus')!
const importFile = document.querySelector<HTMLInputElement>('#importFile')!

STAGE_NAMES.forEach((name, i) => {
  const opt = document.createElement('option')
  opt.value = String(i)
  opt.textContent = `${i}: ${name}`
  loadSelect.appendChild(opt)
})
loadSelect.addEventListener('change', () => loadStage(Number(loadSelect.value)))
document.querySelector<HTMLButtonElement>('#copyBtn')!.addEventListener('click', () => navigator.clipboard.writeText(output.value))
document.querySelector<HTMLButtonElement>('#saveBtn')!.addEventListener('click', () => saveAs(saveName.value.trim() || 'untitled'))
document.querySelector<HTMLButtonElement>('#loadSavedBtn')!.addEventListener('click', () => saveList.value && loadSave(saveList.value))
document.querySelector<HTMLButtonElement>('#deleteSavedBtn')!.addEventListener('click', () => saveList.value && deleteSave(saveList.value))
document.querySelector<HTMLButtonElement>('#playBtn')!.addEventListener('click', playtest)
document.querySelector<HTMLButtonElement>('#importBtn')!.addEventListener('click', () => importJSON(importInput.value))
importFile.addEventListener('change', async () => {
  const file = importFile.files?.[0]
  if (!file) return
  importJSON(await file.text())
  importFile.value = ''
})
refreshSaveList()
document.querySelector<HTMLButtonElement>('#growBtn')!.addEventListener('click', () => {
  ensureSize(w(), h())
  render()
})

const img = new Image()
let imgReady = false
img.onload = () => {
  imgReady = true
  render()
}
img.src = '/sprite-sheet.png'

function drawCell(cell: { x: number; y: number; w?: number; h?: number }, dx: number, dy: number, dw = DISPLAY, dh = DISPLAY) {
  if (!imgReady) return
  ctx.drawImage(img, cell.x * CELL_PX, cell.y * CELL_PX, (cell.w ?? 1) * CELL_PX, (cell.h ?? 1) * CELL_PX, dx, dy, dw, dh)
}

function scrollToCursor() {
  const x = state.cursor.col * DISPLAY
  const y = state.cursor.row * DISPLAY
  if (x < viewport.scrollLeft) viewport.scrollLeft = x
  if (x + DISPLAY > viewport.scrollLeft + viewport.clientWidth) viewport.scrollLeft = x + DISPLAY - viewport.clientWidth
  if (y < viewport.scrollTop) viewport.scrollTop = y
  if (y + DISPLAY > viewport.scrollTop + viewport.clientHeight) viewport.scrollTop = y + DISPLAY - viewport.clientHeight
}

function render() {
  const cols = w()
  const rows = h()
  canvas.width = cols * DISPLAY
  canvas.height = rows * DISPLAY
  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = state.mode === 'night' ? '#141013' : '#249fde'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const night = state.mode === 'night'
  deriveTiles(state[state.mode]).forEach((r, ri) =>
    r.forEach((v, ci) => {
      if (!v) return
      const cell = v === 1 ? (night ? CELL_NIGHT_GRASS : CELL_GRASS) : night ? CELL_NIGHT_DIRT : CELL_DIRT
      drawCell(cell, ci * DISPLAY, ri * DISPLAY)
    }),
  )

  // spawn point — every stage must keep this walkable in both day and night (see main.ts)
  ctx.strokeStyle = '#0f0'
  ctx.lineWidth = 2
  ctx.strokeRect(state.spawn.col * DISPLAY + 2, state.spawn.row * DISPLAY + 2, DISPLAY - 4, DISPLAY - 4)

  const activeSwitch = activeSwitchDef()
  activeSwitch?.bridge.forEach((b) => {
    if (b.night !== night) return
    ctx.globalAlpha = 0.7
    drawCell(CELL_BRIDGE, b.col * DISPLAY, b.row * DISPLAY)
    ctx.globalAlpha = 1
  })

  state.keys[state.mode].forEach((k) => {
    const kw = CELL_KEY.w * CELL_PX * 2
    const kh = CELL_KEY.h * CELL_PX * 2
    drawCell(CELL_KEY, k.col * DISPLAY + (DISPLAY - kw) / 2, k.row * DISPLAY + (DISPLAY - kh) / 2, kw, kh)
  })

  state.switches[state.mode].forEach((s) => drawCell(CELL_SWITCH, s.col * DISPLAY, s.row * DISPLAY))

  state.obstacles.forEach((o, idx) => {
    if (o.night !== undefined && o.night !== night) return
    const ow = CELL_OBSTACLE.w * DISPLAY
    const oh = CELL_OBSTACLE.h * DISPLAY
    ctx.globalAlpha = idx === state.activeObstacle ? 1 : 0.6
    drawCell(CELL_OBSTACLE, o.col * DISPLAY + (DISPLAY - ow) / 2, o.row * DISPLAY + (DISPLAY - oh) / 2, ow, oh)
    ctx.globalAlpha = 1
    ctx.strokeStyle = idx === state.activeObstacle ? '#f0f' : '#f0f8'
    ctx.lineWidth = 1
    if (o.axis === 'x') {
      ctx.strokeRect((o.col - o.range) * DISPLAY, o.row * DISPLAY, (o.range * 2 + 1) * DISPLAY, DISPLAY)
    } else {
      ctx.strokeRect(o.col * DISPLAY, (o.row - o.range) * DISPLAY, DISPLAY, (o.range * 2 + 1) * DISPLAY)
    }
  })

  if (state.portal.night === undefined || state.portal.night === night) drawCell(CELL_PORTAL, state.portal.col * DISPLAY, state.portal.row * DISPLAY)

  ctx.strokeStyle = '#ffd54a'
  ctx.lineWidth = 3
  ctx.strokeRect(state.cursor.col * DISPLAY + 1, state.cursor.row * DISPLAY + 1, DISPLAY - 2, DISPLAY - 2)

  output.value = serialize()
  modeBadge.textContent = state.mode.toUpperCase()
  modeBadge.className = `badge ${state.mode}`
  brushLabel.textContent = `brush: ${state.brush}`
  sizeLabel.textContent = `${cols} x ${rows}`
  spawnLabel.textContent = `col ${state.spawn.col}, row ${state.spawn.row}`
  const lock = state.portal.night === undefined ? '' : state.portal.night ? ' (night only)' : ' (day only)'
  portalLabel.textContent = `col ${state.portal.col}, row ${state.portal.row}${lock}`

  keyList.innerHTML = ''
  ;(['day', 'night'] as const).forEach((side) =>
    state.keys[side].forEach((k) => {
      const li = document.createElement('li')
      li.textContent = `[${side}] col ${k.col}, row ${k.row}`
      keyList.appendChild(li)
    }),
  )

  switchList.innerHTML = ''
  ;(['day', 'night'] as const).forEach((side) =>
    state.switches[side].forEach((s, idx) => {
      const li = document.createElement('li')
      const isActive = state.activeSwitch?.side === side && state.activeSwitch.idx === idx
      if (isActive) li.className = 'active'
      li.textContent = `[${side}] col ${s.col}, row ${s.row} — ${s.bridge.length} bridge tile(s)${isActive ? ' *' : ''}`
      switchList.appendChild(li)
    }),
  )

  obstacleList.innerHTML = ''
  state.obstacles.forEach((o, idx) => {
    const li = document.createElement('li')
    const isActive = idx === state.activeObstacle
    if (isActive) li.className = 'active'
    const lock = o.night === undefined ? '' : o.night ? ' (night only)' : ' (day only)'
    li.textContent = `col ${o.col}, row ${o.row} — ${o.axis} range ${o.range}${lock}${isActive ? ' *' : ''}`
    obstacleList.appendChild(li)
  })
}

window.addEventListener('keydown', (e) => {
  const el = document.activeElement
  if (el === loadSelect || el === output || el === saveName || el === saveList) return
  const brushKeys: Record<string, Brush> = { '1': 'tile', '2': 'spawn', '3': 'key', '4': 'portal', '5': 'switch', '6': 'bridge', '7': 'obstacle' }
  if (e.key in brushKeys) {
    state.brush = brushKeys[e.key]!
    render()
    return
  }
  switch (e.key) {
    case 'ArrowLeft': moveCursor(-1, 0); e.preventDefault(); break
    case 'ArrowRight': moveCursor(1, 0); e.preventDefault(); break
    case 'ArrowUp': moveCursor(0, -1); e.preventDefault(); break
    case 'ArrowDown': moveCursor(0, 1); e.preventDefault(); break
    case ' ': place(); e.preventDefault(); break
    case 'Backspace':
    case 'Delete': erase(); e.preventDefault(); break
    case 'n':
    case 'N': toggleMode(); break
    case 'Tab': cycleSwitch(); e.preventDefault(); break
    case 'd':
    case 'D': copyModeGrid(); break
    case 'p':
    case 'P': cyclePortalNight(); break
    case 'x':
    case 'X': cycleObstacleAxis(); break
    case '[': adjustObstacleRange(-1); break
    case ']': adjustObstacleRange(1); break
    case 'o':
    case 'O': cycleObstacleNight(); break
    case 'c':
    case 'C': navigator.clipboard.writeText(output.value); break
    case 's':
    case 'S': saveAs(saveName.value.trim() || 'untitled'); break
    case 'Enter': playtest(); break
  }
})

render()
