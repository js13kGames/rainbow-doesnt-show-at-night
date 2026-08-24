import type { System } from './types.ts'
import type { Transform, Sprite } from './components.ts'
import type { createRenderer } from './renderer.ts'

export function createRenderSystem(renderer: ReturnType<typeof createRenderer>, canvas: HTMLCanvasElement): System {
  return (world) => {
    const playerEntity = world.query('player', 'transform')[0]
    const player = playerEntity ? world.get<Transform>(playerEntity, 'transform') : undefined
    const offsetX = canvas.width / 2 - (player?.x ?? canvas.width / 2)
    const offsetY = canvas.height / 2 - (player?.y ?? canvas.height / 2)

    const sprites = world.query('transform', 'sprite').map((e) => {
      const t = world.get<Transform>(e, 'transform')!
      const s = world.get<Sprite>(e, 'sprite')!
      return { ...t, ...s, x: t.x + offsetX, y: t.y + offsetY + (s.oy ?? 0) }
    })

    renderer.drawScene(sprites)
  }
}
