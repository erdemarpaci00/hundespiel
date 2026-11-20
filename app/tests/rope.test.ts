import { describe, expect, it } from 'vitest'
import { ropePoints } from '../src/scenes/tugRope'

describe('ropePoints', () => {
  it('beginnt und endet an den Enden und hat n+1 Punkte', () => {
    const p = ropePoints({ x: 10, y: 50 }, { x: 40, y: 50 }, 6, 1.3)
    expect(p).toHaveLength(7)
    expect(p[0]).toEqual({ x: 10, y: 50 })
    expect(p[6]).toEqual({ x: 40, y: 50 })
  })
  it('wackelt in der Mitte, aber nie an den Enden', () => {
    const p = ropePoints({ x: 0, y: 0 }, { x: 30, y: 0 }, 6, Math.PI / 2)
    expect(Math.abs(p[3].y)).toBeGreaterThan(0.5)
    expect(p[0].y).toBe(0)
    expect(p[6].y).toBe(0)
  })
})
