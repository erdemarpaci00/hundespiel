import type { Rng } from '../util/rng'

export type EarType = 'floppy' | 'pointy' | 'round'
export type TailType = 'short' | 'long' | 'curly'
export type Pattern = 'plain' | 'spots' | 'patch'

export interface DogLook {
  size: number
  ear: EarType
  tail: TailType
  coat: number
  pattern: Pattern
  patternColor: number
}

const EARS: EarType[] = ['floppy', 'pointy', 'round']
const TAILS: TailType[] = ['short', 'long', 'curly']
const PATTERNS: Pattern[] = ['plain', 'spots', 'patch']
// Braun, Creme, Schwarz, Grau, Rotbraun
const PALETTE = [0x8b5a2b, 0xf0dfb8, 0x2b2b2b, 0x9a9a9a, 0xb5532a]

function pick<T>(list: T[], rng: Rng): T {
  return list[Math.floor(rng() * list.length)]
}

export function randomLook(rng: Rng): DogLook {
  const size = 0.7 + 0.6 * rng()
  const ear = pick(EARS, rng)
  const tail = pick(TAILS, rng)
  const coat = pick(PALETTE, rng)
  const pattern = pick(PATTERNS, rng)
  const patternColor = pick(PALETTE.filter((c) => c !== coat), rng)
  return { size, ear, tail, coat, pattern, patternColor }
}
