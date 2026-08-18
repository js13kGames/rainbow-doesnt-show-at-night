import type { System } from './types.ts'
import type { Transform, Sprite } from './components.ts'
import type { createRenderer } from './renderer.ts'
import { applyAimAssist } from '../systems/aim-assist.ts'

const AIM_LENGTH = 40
const AIM_THICKNESS = 2
const AIM_GAP = 14

let mouseX = 0
let mouseY = 0

export function createRenderSystem(renderer: ReturnType<typeof createRenderer>, canvas: HTMLCanvasElement): System {
  canvas.addEventListener('mousemove', (e) => {
    mouseX = e.offsetX
    mouseY = e.offsetY
  })

  return (world) => {
    const playerEntity = world.query('player', 'transform')[0]
    const player = playerEntity ? world.get<Transform>(playerEntity, 'transform') : undefined
    const offsetX = canvas.width / 2 - (player?.x ?? canvas.width / 2)
    const offsetY = canvas.height / 2 - (player?.y ?? canvas.height / 2)

    const sprites = world
      .query('transform', 'sprite')
      .map((e) => {
        const t = world.get<Transform>(e, 'transform')!
        const s = world.get<Sprite>(e, 'sprite')!
        return { ...t, ...s, x: t.x + offsetX, y: t.y + offsetY + (s.oy ?? 0) }
      })
      // terrain tiles (flat color) are background — draw them first so characters render on top
      .sort((a, b) => (a.color ? 0 : 1) - (b.color ? 0 : 1))

    if (player) {
      const rawAngle = Math.atan2(mouseY - canvas.height / 2, mouseX - canvas.width / 2)
      const enemies = world.query('enemy', 'transform').map((e) => world.get<Transform>(e, 'transform')!)
      const angle = applyAimAssist(rawAngle, player, enemies)
      const dist = AIM_GAP + AIM_LENGTH / 2
      sprites.push({
        x: canvas.width / 2 + Math.cos(angle) * dist,
        y: canvas.height / 2 + Math.sin(angle) * dist,
        scale: 1,
        rotation: angle,
        r: AIM_LENGTH / 2,
        r2: AIM_THICKNESS,
        flip: 1,
        color: [1, 0, 0],
      })
    }

    renderer.drawScene(sprites)
  }
}
