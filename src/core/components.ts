export type Transform = { x: number; y: number; scale: number; rotation: number }
export type Sprite = {
  r: number
  r2?: number
  oy?: number
  flip: number
  cell?: { x: number; y: number; w?: number; h?: number }
}
export type Velocity = { dx: number; dy: number }
export type Collider = { hw: number; hh: number; oy?: number }
