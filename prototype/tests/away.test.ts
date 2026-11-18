import { expect, test } from 'vitest'
import { awayMessage } from '../src/away'

test('awayMessage fasst Partner und Haeufchen zusammen', () => {
  expect(awayMessage(0, 0, 'Aylin')).toBeNull()
  expect(awayMessage(3, 0, 'Aylin')).toBe('Während du weg warst: Aylin hat sich 3-mal um die Hunde gekümmert')
  expect(awayMessage(0, 1, 'Aylin')).toBe('Während du weg warst: im Garten liegt ein Häufchen')
  expect(awayMessage(2, 4, 'Aylin')).toBe('Während du weg warst: Aylin hat sich 2-mal um die Hunde gekümmert, im Garten liegen 4 Häufchen')
})
