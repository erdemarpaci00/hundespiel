import { describe, expect, it } from 'vitest'
import { isRestless, nightKey, resistsWaking } from '../src/nightlife'

const p = (energy: number, affection: number) => ({ energy, courage: 0.5, affection, learning: 0.5, appetite: 0.5 })

describe('nightKey', () => {
  it('rechnet die Zeit nach Mitternacht zum Vortag', () => {
    expect(nightKey(new Date(2026, 5, 2, 3, 0))).toBe(nightKey(new Date(2026, 5, 1, 23, 0)))
    expect(nightKey(new Date(2026, 5, 2, 23, 0))).not.toBe(nightKey(new Date(2026, 5, 1, 23, 0)))
  })
})

describe('isRestless', () => {
  it('bleibt in einer Nacht für denselben Hund gleich', () => {
    const a = isRestless('hund-1', p(0.5, 0.5), new Date(2026, 5, 1, 23, 0))
    expect(isRestless('hund-1', p(0.5, 0.5), new Date(2026, 5, 2, 4, 0))).toBe(a)
  })
  it('trifft energiegeladene Hunde öfter als träge', () => {
    let hi = 0, lo = 0
    for (let i = 0; i < 400; i++) {
      const d = new Date(2026, 5, 1 + (i % 28), 23, 0)
      if (isRestless(`h${i}`, p(1, 0.5), d)) hi++
      if (isRestless(`h${i}`, p(0, 0.5), d)) lo++
    }
    expect(hi).toBeGreaterThan(lo * 2)
  })
})

describe('resistsWaking', () => {
  it('anhängliche Hunde lassen sich eher wecken', () => {
    expect(resistsWaking(p(0.5, 1), 0, 0.01)).toBe(false)
    expect(resistsWaking(p(0.5, 0), 0, 0.5)).toBe(true)
  })
  it('gibt nach zwei Weigerungen nach', () => {
    expect(resistsWaking(p(0.5, 0), 2, 0)).toBe(false)
  })
})
