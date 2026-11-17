import { expect, test } from 'vitest'
import { nextTarget, stepToward, type Rect, type Vec } from '../src/dog/wander'
import { mulberry32 } from '../src/util/rng'

const B: Rect = { x: 20, y: 300, w: 320, h: 300 }
const inside = (v: Vec) =>
  v.x >= B.x && v.x <= B.x + B.w && v.y >= B.y && v.y <= B.y + B.h

test('nextTarget bleibt in den Grenzen, auch am Rand', () => {
  const rng = mulberry32(2)
  const corners: Vec[] = [{ x: 20, y: 300 }, { x: 340, y: 300 }, { x: 20, y: 600 }, { x: 340, y: 600 }]
  for (const c of corners) for (let i = 0; i < 125; i++) expect(inside(nextTarget(B, c, 150, rng))).toBe(true)
})

test('nextTarget geht höchstens maxStep weit', () => {
  const rng = mulberry32(3)
  const cur = { x: 180, y: 450 }
  for (let i = 0; i < 200; i++) {
    const t = nextTarget(B, cur, 80, rng)
    expect(Math.hypot(t.x - cur.x, t.y - cur.y)).toBeLessThanOrEqual(80 + 1e-9)
  }
})

test('stepToward erreicht das Ziel ohne es zu überschreiten', () => {
  expect(stepToward({ x: 0, y: 0 }, { x: 10, y: 0 }, 1, 100000)).toEqual({ x: 10, y: 0 })
})

test('stepToward bewegt sich bei dt = 0 nicht', () => {
  expect(stepToward({ x: 5, y: 5 }, { x: 50, y: 50 }, 0.05, 0)).toEqual({ x: 5, y: 5 })
})
