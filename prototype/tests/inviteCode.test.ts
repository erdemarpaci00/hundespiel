import { expect, test } from 'vitest'
import { generateInviteCode, normalizeInviteCode } from '../src/inviteCode'
import { mulberry32 } from '../src/util/rng'

test('Code hat 6 Zeichen aus dem erlaubten Alphabet, über 200 Seeds', () => {
  for (let s = 1; s <= 200; s++) {
    expect(generateInviteCode(mulberry32(s))).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/)
  }
})

test('normalizeInviteCode entfernt Leerzeichen und Bindestriche und macht groß', () => {
  expect(normalizeInviteCode(' ab-c d23 ')).toBe('ABCD23')
})
