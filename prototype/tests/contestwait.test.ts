import { describe, expect, it, test } from 'vitest'
import { contestWaitMinutes } from '../src/dog/contest'

const dog = (contestAt: string | null): { contestAt: string | null } => ({ contestAt })
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

test('trophyShelf listet Pokale je Liga', async () => {
  const { trophyShelf } = await import('../src/dog/contest')
  expect(trophyShelf({})).toBe('')
  expect(trophyShelf({ bronze: 2, gold: 1, silber: 0 })).toBe('Bronze 2 · Gold 1')
})
