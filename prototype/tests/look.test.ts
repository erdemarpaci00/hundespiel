import { expect, test } from 'vitest'
import { randomLook } from '../src/dog/look'
import { mulberry32 } from '../src/util/rng'

test('gleicher Seed ergibt gleichen Look', () => {
  expect(randomLook(mulberry32(5))).toEqual(randomLook(mulberry32(5)))
})

test('size liegt in [0.7, 1.3] und Farben sind gültige 0xRRGGBB-Werte', () => {
  for (let seed = 0; seed < 300; seed++) {
    const l = randomLook(mulberry32(seed))
    expect(l.size).toBeGreaterThanOrEqual(0.7)
    expect(l.size).toBeLessThanOrEqual(1.3)
    for (const c of [l.coat, l.patternColor]) {
      expect(Number.isInteger(c)).toBe(true)
      expect(c).toBeGreaterThanOrEqual(0)
      expect(c).toBeLessThanOrEqual(0xffffff)
    }
    expect(l.patternColor).not.toBe(l.coat)
  }
})

test('über viele Seeds kommen alle Ohren-, Schwanz- und Mustertypen vor', () => {
  const ears = new Set<string>(), tails = new Set<string>(), patterns = new Set<string>()
  for (let seed = 0; seed < 300; seed++) {
    const l = randomLook(mulberry32(seed))
    ears.add(l.ear); tails.add(l.tail); patterns.add(l.pattern)
  }
  expect(ears.size).toBe(3)
  expect(tails.size).toBe(3)
  expect(patterns.size).toBe(3)
})
