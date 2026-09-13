import { describe, expect, it } from 'vitest'
import { STAGES } from '../src/components/map.ts'
import { solve, difficulty, scoreScene } from '../src/editor/fitness.ts'

describe('solve', () => {
  it('finds a solving path for every hand-made stage', () => {
    const table = STAGES.map((scene, i) => {
      const r = solve(scene)
      expect(r, `STAGES[${i}] should be solvable`).not.toBeNull()
      return { i, D: difficulty(r!) }
    })
    // calibration reference for GA difficulty targets — should read as roughly non-decreasing
    // across the hand-authored easy-to-hard ordering
    console.log(table.map(({ i, D }) => `${i}: D=${D}`).join('\n'))
  })

  it('rejects an unsolvable stage (portal walled off)', () => {
    const scene = {
      ...STAGES[0]!,
      day: STAGES[0]!.day.map((row) => [...row]),
    }
    scene.day[4]![5] = 0
    scene.day[4]![6] = 0
    scene.day[4]![7] = 0
    expect(solve(scene)).toBeNull()
  })
})

describe('scoreScene', () => {
  it('gives an unsolvable scene zero fitness', () => {
    const scene = { ...STAGES[0]!, portal: { col: 999, row: 999 } }
    expect(scoreScene(scene, 5).fitness).toBe(0)
  })

  it('penalizes a key placed right next to spawn', () => {
    const near = { ...STAGES[1]!, keys: { day: [{ col: 1, row: 4 }], night: [] } }
    const far = { ...STAGES[1]!, keys: { day: [{ col: 8, row: 4 }], night: [] } }
    const target = difficulty(solve(STAGES[1]!)!)
    expect(scoreScene(near, target).fitness).toBeLessThan(scoreScene(far, target).fitness)
  })
})
