import { hash01 } from '../nightlife'
import type { Personality } from './behavior'

export type Wish = 'ball' | 'brush' | 'pet'

export const WISH_BLOCK_MS = 3 * 3600 * 1000

// Ein Zeitblock von 3 Stunden (Ortszeit), damit beide Handys denselben Wunsch sehen, ohne Datenbank.
export function wishBlock(ms: number): number {
  const off = new Date(ms).getTimezoneOffset() * 60000
  return Math.floor((ms - off) / WISH_BLOCK_MS)
}

// Energiegeladene wollen den Ball, anhaengliche Streicheln, alle ab und zu die Buerste.
// `available` blendet Dinge aus, die der Haushalt nicht besitzt.
export function wishFor(dogId: string, p: Personality, ms: number, available: Wish[] = ['ball', 'brush', 'pet']): Wish {
  const weights: Record<Wish, number> = { ball: 0.3 + p.energy, brush: 0.4, pet: 0.3 + p.affection }
  const pool = available.length ? available : (['pet'] as Wish[])
  const total = pool.reduce((s, w) => s + weights[w], 0)
  let r = hash01(`${dogId}|wish|${wishBlock(ms)}`) * total
  for (const w of pool) {
    r -= weights[w]
    if (r <= 0) return w
  }
  return pool[pool.length - 1]
}
