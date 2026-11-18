import { expect, test } from 'vitest'
import type { Personality } from '../src/dog/behavior'
import { wishBlock, wishFor, WISH_BLOCK_MS } from '../src/dog/wish'

const p = (energy: number, affection: number): Personality => ({ energy, courage: 0.5, affection, learning: 0.5, appetite: 0.5 })
const T = new Date(2026, 0, 10, 12, 0).getTime()

test('Wunsch bleibt innerhalb eines Blocks gleich und gehoert zu den verfuegbaren', () => {
  const a = wishFor('dog-1', p(0.5, 0.5), T)
  expect(wishFor('dog-1', p(0.5, 0.5), T + 60_000)).toBe(a)
  expect(wishFor('dog-1', p(0.5, 0.5), T, ['pet'])).toBe('pet')
  expect(wishFor('dog-1', p(0.5, 0.5), T, [])).toBe('pet')
})

test('Block wechselt alle 3 Stunden', () => {
  expect(wishBlock(T + WISH_BLOCK_MS) - wishBlock(T)).toBe(1)
})

test('Energiegeladene Hunde wuenschen sich oefter den Ball', () => {
  const count = (pers: Personality): number => {
    let n = 0
    for (let i = 0; i < 400; i++) if (wishFor(`d${i}`, pers, T) === 'ball') n++
    return n
  }
  expect(count(p(1, 0))).toBeGreaterThan(count(p(0, 1)))
})
