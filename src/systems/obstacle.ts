import { TILE_R, obstacles, player } from '../state.ts'
import { spawnPoint } from '../components/map.ts'
import { respawnPlayer } from './squash.ts'

const FREQ = 1 // rad/s — patrol cycle speed

// pure: elapsed time -> signed offset from center, sine ping-pong within [-range, range]
export const patrolOffset = (t: number, range: number, speed = 1): number => Math.sin(t * FREQ * speed) * range

// pure: is the player's foot point inside the obstacle's tile-sized hitbox
export const overlaps = (px: number, py: number, ox: number, oy: number): boolean =>
  Math.abs(px - ox) < TILE_R && Math.abs(py - oy) < TILE_R

export function updateObstacles(dt: number) {
  obstacles.forEach((o) => {
    o.t += dt
    const off = patrolOffset(o.t, o.range, o.speed)
    if (o.axis === 'x') o.x = o.x0 + off
    else o.y = o.y0 + off
  })
}

export function updateObstacleHit() {
  const hit = obstacles.some((o) => overlaps(player.x, player.y + player.foy, o.x, o.y))
  if (hit) {
    const p = spawnPoint()
    respawnPlayer(p.x, p.y, -1) // knocked upward, unlike a fall-death's downward sink
  }
}
