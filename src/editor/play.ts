// Playtest harness — boots the real game (main.ts, unmodified) against whatever Scene the editor
// currently holds, so a stage can be tried before being pasted into map.ts. Opened only via the
// editor's Play button/Enter key, which stashes the scene in sessionStorage first (shared with this
// tab since window.open() clones the opener's sessionStorage for same-origin tabs).
import { STAGES, setActiveMap, type Scene } from '../components/map.ts'

const raw = sessionStorage.getItem('js13k-editor-playtest')
if (!raw) {
  document.body.textContent = 'No playtest scene found — use the Play button in the editor.'
} else {
  const scene: Scene = JSON.parse(raw)
  // STAGES/MAP are live module bindings read by main.ts at its own top level, so both must be
  // updated here BEFORE dynamically importing it — a static import would run too early
  STAGES.splice(0, STAGES.length, scene)
  setActiveMap(false)
  import('../main.ts')
}
