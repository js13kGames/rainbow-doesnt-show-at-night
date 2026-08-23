import type { Entity, System, Timer } from './types.ts'

export class World {
  private components = new Map<string, Map<Entity, unknown>>()
  private systems: System[] = []
  private listeners = new Map<string, ((...args: any[]) => void)[]>()
  private timers: Timer[] = []
  private raf = 0
  private last = 0

  spawn(components?: Record<string, unknown>): Entity {
    const entity = crypto.randomUUID() as Entity
    if (components) {
      for (const type in components) this.add(entity, type, components[type])
    }
    return entity
  }

  despawn(entity: Entity) {
    for (const store of this.components.values()) store.delete(entity)
  }

  add<T>(entity: Entity, type: string, data: T) {
    let store = this.components.get(type)
    if (!store) this.components.set(type, (store = new Map()))
    store.set(entity, data)
  }

  get<T>(entity: Entity, type: string): T | undefined {
    return this.components.get(type)?.get(entity) as T | undefined
  }

  has(entity: Entity, type: string): boolean {
    return this.components.get(type)?.has(entity) ?? false
  }

  remove(entity: Entity, type: string) {
    this.components.get(type)?.delete(entity)
  }

  query(...types: string[]): Entity[] {
    if (types.length === 0) return []

    const stores = types.map((t) => this.components.get(t))
    if (stores.some((s) => !s)) return []

    let anchorIndex = 0
    for (let i = 1; i < stores.length; i++) {
      if (stores[i]!.size < stores[anchorIndex]!.size) anchorIndex = i
    }
    const anchor = stores[anchorIndex]!

    const result: Entity[] = []
    outer: for (const entity of anchor.keys()) {
      for (let i = 0; i < stores.length; i++) {
        if (i !== anchorIndex && !stores[i]!.has(entity)) continue outer
      }
      result.push(entity)
    }
    return result
  }

  addSystem(fn: System) {
    this.systems.push(fn)
  }

  on(type: string, fn: (...args: any[]) => void) {
    let fns = this.listeners.get(type)
    if (!fns) this.listeners.set(type, (fns = []))
    fns.push(fn)
  }

  emit(type: string, ...args: any[]) {
    for (const fn of this.listeners.get(type) ?? []) fn(...args)
  }

  setTimer(delay: number, cb: () => void, repeat = false) {
    this.timers.push({ time: 0, delay, cb, repeat })
  }

  start() {
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.tick)
  }

  stop() {
    cancelAnimationFrame(this.raf)
  }

  private tick = (now: number) => {
    let dt = (now - this.last) / 1000
    if (dt > 0.1) dt = 0.1
    if (dt < 0) dt = 0
    this.last = now

    for (let i = this.timers.length - 1; i >= 0; i--) {
      const timer = this.timers[i]!
      timer.time += dt
      if (timer.time >= timer.delay) {
        timer.cb()
        if (timer.repeat) timer.time -= timer.delay
        else this.timers.splice(i, 1)
      }
    }

    for (const system of this.systems) system(this, dt)

    this.raf = requestAnimationFrame(this.tick)
  }
}
