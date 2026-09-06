import { createRenderer } from './core/renderer.ts'
import { createRender } from './core/render.ts'
import { updateMovement } from './systems/movement.ts'
import { createUpdateJump } from './systems/jump.ts'
import { updateWobble } from './systems/wobble.ts'
import { updateSquash } from './systems/squash.ts'
import { updateCollision } from './systems/collision.ts'
import { updateKey } from './systems/key.ts'
import { updateSwitch } from './systems/switch.ts'
import { initNightToggle, updateNightFade } from './systems/night.ts'
import { createUpdatePortal } from './systems/portal.ts'
import { updateFade } from './systems/fade.ts'
import { MAP, spawnPoint } from './components/map.ts'
import { player, spawnPlayer, respawnPlatforms, respawnPortal, respawnKeys, respawnSwitches } from './state.ts'

const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!

function resize() {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
}
window.addEventListener('resize', resize)
resize()

const renderer = createRenderer(canvas)

const { x: spawnX, y: spawnY } = spawnPoint()

respawnPlatforms(MAP, false)
respawnPortal()
respawnKeys()
respawnSwitches()
spawnPlayer(spawnX, spawnY)
player.cell = { x: 0, y: 0 }

const updateJump = createUpdateJump()
const updatePortal = createUpdatePortal()
const render = createRender(renderer, canvas)
initNightToggle()

let last = performance.now()
function tick(now: number) {
  let dt = (now - last) / 1000
  if (dt > 0.1) dt = 0.1
  if (dt < 0) dt = 0
  last = now

  updateMovement()
  updateJump(dt)
  updateCollision(dt)
  updateKey()
  updateSwitch()
  updateWobble(dt)
  updateSquash(dt)
  updateNightFade(dt)
  updatePortal()
  updateFade(dt)
  render()

  requestAnimationFrame(tick)
}
requestAnimationFrame(tick)
requestAnimationFrame(() => (canvas.style.opacity = '1'))
