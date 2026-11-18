import { describe, expect, it } from 'vitest'
import { BREEDS } from '../src/dog/breeds'
import { train } from '../src/dog/needs'
import { NO_TRAINING, statValue, trainGain, trainGainWith } from '../src/dog/stats'

describe('statValue', () => {
  it('Corgi ist ab Start schneller als Husky ist ausdauernd gestartet', () => {
    const corgi = BREEDS.find((b) => b.id === 'corgi')!
    const husky = BREEDS.find((b) => b.id === 'husky')!
    expect(statValue('corgi', NO_TRAINING, 'tempo')).toBe(Math.round(corgi.stats.tempo * 60))
    expect(statValue('husky', NO_TRAINING, 'ausdauer')).toBeGreaterThan(statValue('corgi', NO_TRAINING, 'ausdauer'))
  })
  it('Training addiert sich und ist bei 100 gedeckelt', () => {
    expect(statValue('corgi', { ...NO_TRAINING, tempo: 10 }, 'tempo')).toBe(statValue('corgi', NO_TRAINING, 'tempo') + 10)
    expect(statValue('corgi', { ...NO_TRAINING, tempo: 100 }, 'tempo')).toBe(100)
  })
  it('kennt auch Hunde ohne Rasse', () => {
    expect(statValue(undefined, NO_TRAINING, 'gehorsam')).toBe(18)
  })
})

describe('trainGain', () => {
  it('wächst mit der Lernfreude', () => {
    expect([trainGain(0.1), trainGain(0.5), trainGain(0.9)]).toEqual([1, 2, 3])
  })
})

describe('train', () => {
  it('kostet Energie und Hunger, macht zufriedener, bleibt im Rahmen', () => {
    expect(train({ hunger: 80, energy: 60, happiness: 50 })).toEqual({ hunger: 72, energy: 40, happiness: 54 })
    expect(train({ hunger: 12, energy: 15, happiness: 100 })).toEqual({ hunger: 10, energy: 10, happiness: 100 })
  })
})

import { play } from '../src/dog/needs'
describe('play', () => {
  it('macht froh und müde, bleibt im Rahmen', () => {
    expect(play({ hunger: 80, energy: 60, happiness: 50 })).toEqual({ hunger: 76, energy: 48, happiness: 65 })
    expect(play({ hunger: 2, energy: 5, happiness: 95 })).toEqual({ hunger: 10, energy: 10, happiness: 100 })
  })
})

import { groom } from '../src/dog/needs'
describe('groom', () => {
  it('hebt nur die Laune', () => {
    expect(groom({ hunger: 80, energy: 60, happiness: 50 })).toEqual({ hunger: 80, energy: 60, happiness: 62 })
    expect(groom({ hunger: 80, energy: 60, happiness: 98 }).happiness).toBe(100)
  })
})

describe('Training mit Timing', () => {
  it('gutes Timing gibt +1, schlechtes -1, immer 1 bis 3', () => {
    expect(trainGainWith(0.5, 0.5)).toBe(2)
    expect(trainGainWith(0.5, 0.9)).toBe(3)
    expect(trainGainWith(0.5, 0.1)).toBe(1)
    expect(trainGainWith(0.9, 1)).toBe(3)
    expect(trainGainWith(0.1, 0)).toBe(1)
  })
})
