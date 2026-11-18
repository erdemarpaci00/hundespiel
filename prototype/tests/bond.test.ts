import { describe, expect, it } from 'vitest'
import { bondLevel, bondLabel } from '../src/dog/bond'

describe('bond', () => {
  it('Stufen wachsen mit den Treffen', () => {
    expect(bondLevel(0)).toBe(0)
    expect(bondLevel(2)).toBe(1)
    expect(bondLevel(5)).toBe(2)
    expect(bondLevel(15)).toBe(3)
  })
  it('Beschriftung nach Stufe', () => {
    expect(bondLabel(0)).toBe('kennen sich kaum')
    expect(bondLabel(3)).toBe('Bekannte')
    expect(bondLabel(8)).toBe('Freunde')
    expect(bondLabel(30)).toBe('beste Freunde')
  })
})
