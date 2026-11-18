import { expect, test } from 'vitest'
import { COLLARS, COLLAR_PRICE, collarColor } from '../src/dog/collar'

test('collarColor kennt alle Halsbaender und sonst null', () => {
  expect(collarColor('blau')).toBe(0x1976d2)
  expect(collarColor('unbekannt')).toBeNull()
  expect(collarColor(null)).toBeNull()
  expect(new Set(COLLARS.map((c) => c.id)).size).toBe(COLLARS.length)
  expect(COLLAR_PRICE).toBe(25)
})
