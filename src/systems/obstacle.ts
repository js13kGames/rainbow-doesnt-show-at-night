import { obstacles, player, OBSTACLE_R, OBSTACLE_R2 } from '../state.ts'
import { spawnPoint, GRID_H } from '../components/map.ts'
import { respawnPlayer } from './squash.ts'
import { night } from './night.ts'

const FREQ = 1 // rad/s — patrol cycle speed
// obstacle sprite is drawn raised by this much (see render.ts) — the hitbox must follow it
export const OBSTACLE_RENDER_OY = -GRID_H / 2

// pure: elapsed time -> signed offset from center, sine ping-pong within [-range, range]
export const patrolOffset = (t: number, range: number, speed = 1): number => Math.sin(t * FREQ * speed) * range

// pure: is the player's foot point inside the obstacle's sprite-sized hitbox
export const overlaps = (px: number, py: number, ox: number, oy: number): boolean =>
  Math.abs(px - ox) < OBSTACLE_R && Math.abs(py - oy) < OBSTACLE_R2

export function updateObstacles(dt: number) {
  obstacles.forEach((o) => {
    o.t += dt
    const off = patrolOffset(o.t, o.range, o.speed)
    if (o.axis === 'x') o.x = o.x0 + off
    else o.y = o.y0 + off
  })
}

export function updateObstacleHit() {
  // hit-test against the obstacle's actual tile position, not the render-raised sprite —
  // otherwise the hitbox drifts off the tile the obstacle is standing on
  const hit = obstacles.some((o) => (o.night === undefined || o.night === night) && overlaps(player.x, player.y + player.foy, o.x, o.y))
  if (hit) {
    const p = spawnPoint()
    respawnPlayer(p.x, p.y, -1) // knocked upward, unlike a fall-death's downward sink
  }
}
