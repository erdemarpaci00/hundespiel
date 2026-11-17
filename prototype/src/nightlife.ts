import type { Personality } from './dog/behavior'

// Die Nacht gehoert zum Abend davor: 3 Uhr morgens zaehlt noch zum Vortag.
export function nightKey(d: Date): string {
  const x = new Date(d)
  if (x.getHours() < 12) x.setDate(x.getDate() - 1)
  return `${x.getFullYear()}-${x.getMonth() + 1}-${x.getDate()}`
}

function hash01(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  h ^= h >>> 15
  h = Math.imul(h, 2246822519)
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296
}

// Energiegeladene Hunde sind nachts oefter unruhig und wollen raus. Pro Hund und Nacht fest, damit es nicht flackert.
export function isRestless(dogId: string, p: Personality, d: Date): boolean {
  return hash01(`${dogId}|${nightKey(d)}`) < 0.1 + 0.4 * p.energy
}

// Beim Wecken wehrt sich ein weniger anhaengliches Tier. Nach zwei Versuchen gibt es nach.
export function resistsWaking(p: Personality, previousRefusals: number, roll: number): boolean {
  if (previousRefusals >= 2) return false
  return roll < 0.6 * (1 - p.affection)
}
