import { describe, expect, it } from 'vitest'
import { dayPhase, seasonOf, weatherAt } from '../src/daytime'

describe('dayPhase', () => {
  it.each([[0, 'night'], [3, 'night'], [6, 'night'], [7, 'dawn'], [8, 'day'], [18, 'day'], [19, 'dusk'], [22, 'dusk'], [23, 'night']])('%i Uhr ist %s', (h, p) => {
    expect(dayPhase(new Date(2026, 5, 1, h, 30))).toBe(p)
  })
})

describe('weatherAt', () => {
  it('ist innerhalb eines 3-Stunden-Blocks gleich', () => {
    const t = Math.floor(Date.UTC(2026, 5, 1) / 1e7) * 1e7
    expect(weatherAt(new Date(t + 1000))).toBe(weatherAt(new Date(t + 1000 + 60 * 1000)))
  })
  it('liefert über viele Blöcke alle drei Wetterarten, Sonne am häufigsten', () => {
    const c = { sun: 0, cloud: 0, rain: 0 }
    for (let i = 0; i < 400; i++) c[weatherAt(new Date(i * 3 * 3600 * 1000))]++
    expect(c.rain).toBeGreaterThan(0)
    expect(c.cloud).toBeGreaterThan(0)
    expect(c.sun).toBeGreaterThan(c.rain)
  })
})

describe('seasonOf', () => {
  it.each([[0, 'winter'], [1, 'winter'], [2, 'spring'], [4, 'spring'], [5, 'summer'], [7, 'summer'], [8, 'autumn'], [10, 'autumn'], [11, 'winter']])('Monat %i ist %s', (m, s) => {
    expect(seasonOf(new Date(2026, m, 15))).toBe(s)
  })
})
