import { describe, expect, it, test } from 'vitest'
import type { Personality } from '../src/dog/behavior'
import { applyElapsed, feed, treat, MIN_NEED, mood, pet, type Needs } from '../src/dog/needs'

const H = 3600 * 1000
const DAY = 24 * H
const p = (appetite: number, affection = 0.5): Personality => ({ energy: 0.5, courage: 0.5, affection, learning: 0.5, appetite })
const full: Needs = { hunger: 100, energy: 100, happiness: 100 }

test('nach 10 Stunden ist ein Hund mit appetite 0.5 hungrig, aber nie unter MIN_NEED', () => {
  const n = applyElapsed(full, 10 * H, p(0.5), new Date(2026, 0, 10, 19).getTime())
  expect(n.hunger).toBeLessThanOrEqual(30)
  expect(n.hunger).toBeGreaterThanOrEqual(MIN_NEED)
})

test('verfressener Hund verliert schneller Hunger als wählerischer', () => {
  const greedy = applyElapsed(full, 3 * H, p(1), new Date(2026, 0, 10, 15).getTime()).hunger
  const picky = applyElapsed(full, 3 * H, p(0), new Date(2026, 0, 10, 15).getTime()).hunger
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

test('feed erhöht hunger um 60 höchstens auf 100 und happiness um 5', () => {
  const n = feed({ hunger: 30, energy: 50, happiness: 50 })
  expect(n).toEqual({ hunger: 90, energy: 50, happiness: 55 })
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
  it('Energie erholt sich tagsueber', () => {
    const r = applyElapsed({ hunger: 80, energy: 50, happiness: 80 }, 4 * H, p(0.5), noon + 4 * H)
    expect(r.energy).toBeCloseTo(82, 0)
  })
  it('Hunger sinkt nachts nur zu einem Drittel', () => {
    const day = applyElapsed({ hunger: 100, energy: 50, happiness: 80 }, 6 * H, p(0.5), at(18))
    const night = applyElapsed({ hunger: 100, energy: 50, happiness: 80 }, 6 * H, p(0.5), at(30))
    expect(100 - night.hunger).toBeCloseTo((100 - day.hunger) / 3, 0)
  })
})

test('treat gibt etwas Hunger und viel Laune, nie ueber 100', () => {
  expect(treat({ hunger: 50, energy: 50, happiness: 50 })).toEqual({ hunger: 60, energy: 50, happiness: 62 })
  expect(treat({ hunger: 98, energy: 50, happiness: 99 })).toEqual({ hunger: 100, energy: 50, happiness: 100 })
})
