import { expect, test } from 'vitest'
import { behaviorDuration, pickBehavior, randomPersonality, type Behavior, type Personality } from '../src/dog/behavior'
import { mulberry32 } from '../src/util/rng'

const ALL: Behavior[] = ['wander', 'sniff', 'sit', 'sleep']
const uniform = (v: number): Personality => ({ energy: v, courage: v, affection: v, learning: v, appetite: v })

function share(p: Personality, b: Behavior, n = 2000): number {
  const rng = mulberry32(1)
  let c = 0
  for (let i = 0; i < n; i++) if (pickBehavior(p, rng) === b) c++
  return c / n
}

test('randomPersonality liefert fünf Werte in [0,1]', () => {
  const p = randomPersonality(mulberry32(3))
  expect(Object.keys(p).sort()).toEqual(['affection', 'appetite', 'courage', 'energy', 'learning'])
  for (const v of Object.values(p)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1) }
})

test('energiegeladener Hund wandert öfter als er schläft', () => {
  const p = { ...uniform(0.5), energy: 1 }
  expect(share(p, 'wander')).toBeGreaterThan(share(p, 'sleep'))
})

test('träger Hund schläft öfter als er wandert', () => {
  const p = { ...uniform(0.5), energy: 0 }
  expect(share(p, 'sleep')).toBeGreaterThan(share(p, 'wander'))
})

test('Extremwerte liefern immer ein gültiges Verhalten', () => {
  for (const v of [0, 1]) {
    const rng = mulberry32(9)
    for (let i = 0; i < 500; i++) expect(ALL).toContain(pickBehavior(uniform(v), rng))
  }
})

test('behaviorDuration ist positiv, schlafen dauert länger als schnüffeln', () => {
  const rng = mulberry32(4), p = uniform(0.5)
  const mean = (b: Behavior) => { let s = 0; for (let i = 0; i < 200; i++) { const d = behaviorDuration(b, p, rng); expect(d).toBeGreaterThan(0); s += d } return s / 200 }
  expect(mean('sleep')).toBeGreaterThan(mean('sniff'))
})
