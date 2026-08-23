export type Orbit = { angle: number }
export type Player = { walkSpeed: number; runSpeed: number }
export type Wobble = { prevX: number; prevY: number }
export type Squash = { t: number; base: number }
export type Jump = { dx: number; dy: number; t: number }

export type EnemyPhase = 'idle' | 'chase' | 'search' | 'windup' | 'charge'

export type Enemy = {
  speed: number
  detectRange: number
  windupRange: number
  windupDuration: number
  chargeSpeed: number
  chargeDistance: number

  phase: EnemyPhase
  windupTimer: number
  chargeDir: { x: number; y: number }
  chargeRemaining: number
  lastSeen: { x: number; y: number } | null
}
