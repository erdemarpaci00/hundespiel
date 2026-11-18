import type { Rng } from './util/rng'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateInviteCode(rng: Rng): string {
  let code = ''
  for (let i = 0; i < 6; i++) code += ALPHABET[Math.floor(rng() * ALPHABET.length)]
  return code
}

export function normalizeInviteCode(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase()
}
