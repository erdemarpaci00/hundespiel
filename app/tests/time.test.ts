import { expect, test } from 'vitest'
import { parseTimestamp } from '../src/time'

test('Postgres-Zeitstempel mit sechs Nachkommastellen werden millisekundengenau gelesen', () => {
  expect(parseTimestamp('2026-11-17T19:46:59.869764+00:00')).toBe(Date.UTC(2026, 10, 17, 19, 46, 59, 869))
})

test('Zeitstempel ohne Nachkommastellen, mit Leerzeichen statt T und mit +00 werden gelesen', () => {
  expect(parseTimestamp('2026-11-17T19:46:59+00:00')).toBe(Date.UTC(2026, 10, 17, 19, 46, 59))
  expect(parseTimestamp('2026-11-17 19:46:59.5+00')).toBe(Date.UTC(2026, 10, 17, 19, 46, 59, 500))
})

test('Unlesbares ergibt NaN', () => {
  expect(parseTimestamp('kaputt')).toBeNaN()
})
