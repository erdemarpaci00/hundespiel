import { describe, expect, it } from 'vitest'
import { contestWaitMinutes, type DogRecord } from '../src/dogRepo'

const dog = (contestAt: string | null): DogRecord => ({ contestAt } as DogRecord)
const now = Date.parse('2026-11-18T12:00:00Z')

describe('Turnier-Sperre', () => {
  it('ohne bisheriges Turnier keine Wartezeit', () => {
    expect(contestWaitMinutes(dog(null), now)).toBe(0)
  })
  it('zeigt die verbleibenden Minuten aufgerundet', () => {
    expect(contestWaitMinutes(dog('2026-11-18T11:55:30Z'), now)).toBe(6)
  })
  it('nach 10 Minuten wieder frei', () => {
    expect(contestWaitMinutes(dog('2026-11-18T11:50:00Z'), now)).toBe(0)
  })
})
