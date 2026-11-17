import { expect, test } from 'vitest'
import { puppySeedFor, rollPuppies } from '../src/puppies'

test('rollPuppies liefert genau 3 Welpen und ist mit gleichem Seed reproduzierbar', () => {
  const a = rollPuppies(42)
  expect(a).toHaveLength(3)
  expect(rollPuppies(42)).toEqual(a)
})

test('die drei Welpen unterscheiden sich im Look oder in der Persönlichkeit', () => {
  const [a, b, c] = rollPuppies(7)
  expect(a).not.toEqual(b)
  expect(b).not.toEqual(c)
  expect(a).not.toEqual(c)
})

test('puppySeedFor ist stabil pro Nutzer und liefert für zwei Nutzer-IDs verschiedene Welpen', () => {
  const u1 = '11111111-aaaa-4bbb-8ccc-000000000001'
  const u2 = '22222222-aaaa-4bbb-8ccc-000000000002'
  expect(puppySeedFor(u1)).toBe(puppySeedFor(u1))
  expect(puppySeedFor(u1)).not.toBe(puppySeedFor(u2))
  expect(rollPuppies(puppySeedFor(u1))).not.toEqual(rollPuppies(puppySeedFor(u2)))
})
