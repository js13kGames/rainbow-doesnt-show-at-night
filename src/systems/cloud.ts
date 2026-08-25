import { clouds } from '../state.ts'

function driftX(x: number, speed: number, dt: number, r: number, canvasWidth: number): number {
  const next = x + speed * dt
  return next - r > canvasWidth ? -r : next
}

export function createUpdateClouds(canvas: HTMLCanvasElement) {
  return (dt: number) => {
    clouds.forEach((c) => {
      c.x = driftX(c.x, c.speed, dt, c.r, canvas.width)
    })
  }
}
