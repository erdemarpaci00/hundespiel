import { describe, expect, it, test } from 'vitest'
import type { Personality } from '../src/dog/behavior'
import { applyElapsed, feed, MIN_NEED, mood, pet, type Needs } from '../src/dog/needs'

const H = 3600 * 1000
const DAY = 24 * H
const p = (appetite: number, affection = 0.5): Personality => ({ energy: 0.5, courage: 0.5, affection, learning: 0.5, appetite })
const full: Needs = { hunger: 100, energy: 100, happiness: 100 }

test('nach 8 Stunden ist ein Hund mit appetite 0.5 hungrig, aber nie unter MIN_NEED', () => {
  const n = applyElapsed(full, 8 * H, p(0.5))
  expect(n.hunger).toBeLessThanOrEqual(30)
  expect(n.hunger).toBeGreaterThanOrEqual(MIN_NEED)
})

test('verfressener Hund verliert schneller Hunger als wählerischer', () => {
  const greedy = applyElapsed(full, 3 * H, p(1)).hunger
  const picky = applyElapsed(full, 3 * H, p(0)).hunger
  expect(greedy).toBeLessThan(picky)
})

test('Wochen ohne Besuch: Werte bleiben in [MIN_NEED, 100] und es werden höchstens 7 Tage angerechnet', () => {
  const a = applyElapsed(full, 60 * DAY, p(0.5))
  const b = applyElapsed(full, 7 * DAY, p(0.5))
  expect(a).toEqual(b)
  for (const v of Object.values(a)) {
    expect(v).toBeGreaterThanOrEqual(MIN_NEED)
    expect(v).toBeLessThanOrEqual(100)
  }
})

test('negative oder NaN-Zeit ändert nichts', () => {
  expect(applyElapsed(full, -5 * H, p(0.5))).toEqual(full)
  expect(applyElapsed(full, Number.NaN, p(0.5))).toEqual(full)
})

test('feed erhöht hunger um 40 höchstens auf 100 und happiness um 5', () => {
  const n = feed({ hunger: 30, energy: 50, happiness: 50 })
  expect(n).toEqual({ hunger: 70, energy: 50, happiness: 55 })
  expect(feed({ hunger: 90, energy: 50, happiness: 98 })).toEqual({ hunger: 100, energy: 50, happiness: 100 })
})

test('pet erhöht happiness, anhänglicher Hund mehr als zurückhaltender', () => {
  const base: Needs = { hunger: 50, energy: 50, happiness: 40 }
  const clingy = pet(base, p(0.5, 1)).happiness
  const aloof = pet(base, p(0.5, 0)).happiness
  expect(aloof).toBeGreaterThan(40)
  expect(clingy).toBeGreaterThan(aloof)
  expect(pet({ ...base, happiness: 99 }, p(0.5, 1)).happiness).toBe(100)
})

test('mood: Priorität sad vor hungry vor tired, happy ab 70, sonst ok', () => {
  expect(mood({ hunger: 100, energy: 100, happiness: 100 })).toBe('happy')
  expect(mood({ hunger: 60, energy: 60, happiness: 60 })).toBe('ok')
  expect(mood({ hunger: 20, energy: 60, happiness: 60 })).toBe('hungry')
  expect(mood({ hunger: 60, energy: 20, happiness: 60 })).toBe('tired')
  expect(mood({ hunger: 20, energy: 20, happiness: 20 })).toBe('sad')
})

test('moodPersonality: müde und traurige Hunde sind träger, glückliche aufgeweckter, Rest bleibt', async () => {
  const { moodPersonality } = await import('../src/dog/needs')
  const base = p(0.5)
  expect(moodPersonality(base, 'tired').energy).toBeLessThan(base.energy)
  expect(moodPersonality(base, 'sad').energy).toBeLessThan(base.energy)
  expect(moodPersonality(base, 'happy').energy).toBeGreaterThan(base.energy)
  expect(moodPersonality({ ...base, energy: 0.95 }, 'happy').energy).toBeLessThanOrEqual(1)
  expect(moodPersonality(base, 'tired').appetite).toBe(base.appetite)
  expect(moodPersonality(base, 'ok')).toEqual(base)
})

describe('Nachtschlaf', () => {
  const noon = new Date(2026, 0, 10, 12).getTime()
  const at = (h: number): number => new Date(2026, 0, 10 + (h >= 24 ? 1 : 0), h % 24).getTime()
  it('Energie steigt ueber Nacht', () => {
    const tired = { hunger: 80, energy: 20, happiness: 80 }
    const r = applyElapsed(tired, 8 * H, p(0.5), at(30))
    expect(r.energy).toBeGreaterThan(90)
  })
  it('Energie sinkt tagsueber wie bisher', () => {
    const r = applyElapsed({ hunger: 80, energy: 100, happiness: 80 }, 4 * H, p(0.5), noon + 4 * H)
    expect(r.energy).toBeCloseTo(76, 0)
  })
})
