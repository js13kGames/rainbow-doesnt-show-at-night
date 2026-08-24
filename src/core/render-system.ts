import type { System } from './types.ts'
import type { Transform, Sprite } from './components.ts'
import type { createRenderer } from './renderer.ts'
import { MAP_W, MAP_H } from '../components/map.ts'

export function createRenderSystem(renderer: ReturnType<typeof createRenderer>, canvas: HTMLCanvasElement): System {
  return (world) => {
    // static offset centering the map in the canvas — not a camera, doesn't track the player
    const offsetX = canvas.width / 2 - MAP_W / 2
    const offsetY = canvas.height / 2 - MAP_H / 2

    const sprites = world.query('transform', 'sprite').map((e) => {
      const t = world.get<Transform>(e, 'transform')!
      const s = world.get<Sprite>(e, 'sprite')!
      const isBg = world.has(e, 'cloud')
      return { ...t, ...s, x: t.x + (isBg ? 0 : offsetX), y: t.y + (isBg ? 0 : offsetY) + (s.oy ?? 0) }
    })

    renderer.drawScene(sprites)
  }
}
