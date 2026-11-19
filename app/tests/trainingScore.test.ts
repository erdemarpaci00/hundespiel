import { describe, expect, it } from 'vitest'
import { commandScore, jumpScore, rhythmScore, sprintScore } from '../src/dog/trainingScore'

describe('Trainingsspiele', () => {
  it('Sprint: mehr Tippen ist besser, gedeckelt bei 1', () => {
    expect(sprintScore(0)).toBe(0)
    expect(sprintScore(35)).toBe(1)
    expect(sprintScore(100)).toBe(1)
    expect(sprintScore(14)).toBeCloseTo(0.4)
  })
  it('Takt: genau getroffen zaehlt voll, verpasst zaehlt null', () => {
    expect(rhythmScore([50, 50, 50, 50])).toBe(1)
    expect(rhythmScore([50, null, 200, 400])).toBeCloseTo(0.375)
    expect(rhythmScore([])).toBe(0)
  })
  it('Huerde: Mitte der Zone ist 1, 0.25 daneben ist 0', () => {
    expect(jumpScore(0.6, 0.6)).toBe(1)
    expect(jumpScore(0.35, 0.6)).toBe(0)
    expect(jumpScore(0.5, 0.6)).toBeCloseTo(0.6)
  })
  it('Kommandos: richtige Stelle zaehlt', () => {
    expect(commandScore(['a', 'b', 'c', 'd'], ['a', 'b', 'c', 'd'])).toBe(1)
    expect(commandScore(['a', 'b', 'c', 'd'], ['a', 'c', 'c', 'x'])).toBe(0.5)
    expect(commandScore(['a', 'b'], [])).toBe(0)
  })
})
