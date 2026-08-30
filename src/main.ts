import { createRenderer } from './core/renderer.ts'
import { createRender } from './core/render.ts'
import { updateMovement } from './systems/movement.ts'
import { createUpdateJump } from './systems/jump.ts'
import { updateWobble } from './systems/wobble.ts'
import { updateSquash } from './systems/squash.ts'
import { updateCollision } from './systems/collision.ts'
import { updateKey } from './systems/key.ts'
import { updateSwitch } from './systems/switch.ts'
import { createUpdateClouds } from './systems/cloud.ts'
import { initNightToggle, updateNightFade } from './systems/night.ts'
import { createUpdatePortal } from './systems/portal.ts'
import { updateFade } from './systems/fade.ts'
import { MAP, TILE_W, GRID_H } from './components/map.ts'
import { player, spawnPlayer, respawnPlatforms, respawnPortal, respawnKeys, respawnSwitches, spawnClouds } from './state.ts'

const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!

function resize() {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
}
window.addEventListener('resize', resize)
resize()

const renderer = createRenderer(canvas)

// far left edge of the floor — the portal sits at the far right, so the intro stage is just
// "walk right"
const spawnX = TILE_W / 2
const spawnY = 4 * GRID_H

spawnClouds(canvas, 10)
respawnPlatforms(MAP, false)
respawnPortal()
respawnKeys()
respawnSwitches()
spawnPlayer(spawnX, spawnY)
player.cell = { x: 0, y: 0 }

const updateJump = createUpdateJump(spawnX, spawnY)
const updateClouds = createUpdateClouds(canvas)
const updatePortal = createUpdatePortal(spawnX, spawnY)
const render = createRender(renderer, canvas)
initNightToggle(spawnX, spawnY)

let last = performance.now()
function tick(now: number) {
  let dt = (now - last) / 1000
  if (dt > 0.1) dt = 0.1
  if (dt < 0) dt = 0
  last = now

  updateClouds(dt)
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
