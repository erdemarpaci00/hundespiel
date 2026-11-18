import { beforeEach, describe, expect, it } from 'vitest'
import { loadPoops, MAX_POOPS, savePoops, wantsPoop } from '../src/garden/poop'

const store = new Map<string, string>()
beforeEach(() => {
  store.clear()
  ;(globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  } as Storage
})

describe('poop', () => {
  it('speichert und laedt Haufen pro Haushalt', () => {
    savePoops('h1', [{ x: 10, y: 20 }])
    expect(loadPoops('h1')).toEqual([{ x: 10, y: 20 }])
    expect(loadPoops('h2')).toEqual([])
  })
  it('ignoriert kaputte Daten', () => {
    store.set('poop:h1', '{kaputt')
    expect(loadPoops('h1')).toEqual([])
    store.set('poop:h1', JSON.stringify([{ x: 1 }, { x: 2, y: 3 }]))
    expect(loadPoops('h1')).toEqual([{ x: 2, y: 3 }])
  })
  it('hoechstens sechs Haufen', () => {
    expect(wantsPoop(() => 0, true, MAX_POOPS)).toBe(false)
    expect(wantsPoop(() => 0, true, 0)).toBe(true)
    expect(wantsPoop(() => 0, false, 0)).toBe(false)
    expect(wantsPoop(() => 0.9, true, 0)).toBe(false)
  })
})
