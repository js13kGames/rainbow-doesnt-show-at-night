import type { World } from './world.ts'

export type Entity = string & { readonly __brand: unique symbol }
export type System = (world: World, dt: number) => void
export type Timer = { time: number; delay: number; cb: () => void; repeat: boolean }
