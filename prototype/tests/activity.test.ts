import { expect, test } from 'vitest'
import { describeActivity, favoriteOf, favoriteLine, relativeTime, type ActivityEntry } from '../src/activity'

const entry = (kind: ActivityEntry['kind']): ActivityEntry => ({ id: '1', kind, userName: 'Anna', dogName: 'Bello', at: '2026-11-17T10:00:00Z' })

test('describeActivity: feed, pet, adopt', () => {
  expect(describeActivity(entry('feed'))).toBe('Anna hat Bello gefüttert')
  expect(describeActivity(entry('pet'))).toBe('Anna hat Bello gestreichelt')
  expect(describeActivity(entry('adopt'))).toBe('Anna hat Bello aufgenommen')
})

const NOW = Date.parse('2026-11-17T12:00:00Z')
const ago = (ms: number): string => new Date(NOW - ms).toISOString()

test('relativeTime: Grenzen', () => {
  expect(relativeTime(ago(30_000), NOW)).toBe('gerade eben')
  expect(relativeTime(ago(5 * 60_000), NOW)).toBe('vor 5 Min')
  expect(relativeTime(ago(3 * 3600_000), NOW)).toBe('vor 3 Std')
  expect(relativeTime(ago(2 * 24 * 3600_000), NOW)).toBe('vor 2 Tagen')
})

test('relativeTime: Zukunft und ungültige Eingabe ergeben gerade eben', () => {
  expect(relativeTime(ago(-60_000), NOW)).toBe('gerade eben')
  expect(relativeTime('kaputt', NOW)).toBe('gerade eben')
})

test('describeActivity: neue Aktionen lesen sich als Satz', () => {
  expect(describeActivity(entry('train'))).toBe('Anna hat Bello trainiert')
  expect(describeActivity(entry('play'))).toBe('Anna hat Bello den Ball geworfen')
  expect(describeActivity(entry('contest'))).toBe('Anna hat Bello zum Turnier gebracht')
})

test('Lieblingsmensch: klar, knapp und leer', () => {
  expect(favoriteOf({})).toBeNull()
  expect(favoriteOf({ Erdem: 6, Frau: 2 })).toBe('Erdem')
  expect(favoriteOf({ Erdem: 4, Frau: 3 })).toBe('beide')
  expect(favoriteLine('Bello', 'Erdem')).toBe('Bello hängt gerade mehr an Erdem')
  expect(favoriteLine('Bello', 'beide')).toContain('beide')
  expect(favoriteLine('Bello', null)).toBeNull()
})
