import { expect, test } from 'vitest'
import { clampDelta, mulberry32 } from '../src/util/rng'

test('mulberry32 mit gleichem Seed liefert dieselbe Folge', () => {
  const a = mulberry32(42), b = mulberry32(42)
  expect([a(), a(), a()]).toEqual([b(), b(), b()])
})
test('mulberry32 liefert Werte in [0,1)', () => {
  const r = mulberry32(7)
  for (let i = 0; i < 1000; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1) }
})
test('clampDelta kappt große Sprünge auf 100', () => { expect(clampDelta(60000)).toBe(100) })
test('clampDelta lässt kleine Werte durch und macht Negatives zu 0', () => {
  expect(clampDelta(16)).toBe(16); expect(clampDelta(-5)).toBe(0)
})
