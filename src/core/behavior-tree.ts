import type { World } from './world.ts'
import type { Entity, System } from './types.ts'

export type Status = 'success' | 'failure' | 'running'
export type Node<C> = { tick: (ctx: C) => Status }

export const condition = <C>(fn: (ctx: C) => boolean): Node<C> => ({
  tick: (ctx) => (fn(ctx) ? 'success' : 'failure'),
})

export const action = <C>(fn: (ctx: C) => Status): Node<C> => ({ tick: fn })

export const sequence = <C>(...nodes: Node<C>[]): Node<C> => ({
  tick: (ctx) => {
    for (const n of nodes) {
      const s = n.tick(ctx)
      if (s !== 'success') return s
    }
    return 'success'
  },
})

export const selector = <C>(...nodes: Node<C>[]): Node<C> => ({
  tick: (ctx) => {
    for (const n of nodes) {
      const s = n.tick(ctx)
      if (s !== 'failure') return s
    }
    return 'failure'
  },
})

export function createBtSystem<C>(
  query: string[],
  buildCtx: (world: World, e: Entity, dt: number) => C,
  tree: Node<C>,
  writeBack: (world: World, e: Entity, ctx: C) => void,
): System {
  return (world, dt) => {
    world.query(...query).forEach((e) => {
      const ctx = buildCtx(world, e, dt)
      tree.tick(ctx)
      writeBack(world, e, ctx)
    })
  }
}
