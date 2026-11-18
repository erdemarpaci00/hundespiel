import { breedById } from './breeds'

export type StatKey = 'tempo' | 'ausdauer' | 'sprungkraft' | 'gehorsam'
export type Training = Record<StatKey, number>

export const STAT_KEYS: StatKey[] = ['tempo', 'ausdauer', 'sprungkraft', 'gehorsam']
export const STAT_LABEL: Record<StatKey, string> = { tempo: 'Tempo', ausdauer: 'Ausdauer', sprungkraft: 'Sprungkraft', gehorsam: 'Gehorsam' }
export const EXERCISE: Record<StatKey, string> = { tempo: 'Sprinten', ausdauer: 'Ausdauerlauf', sprungkraft: 'Hürdenspringen', gehorsam: 'Sitz und Platz' }

export const NO_TRAINING: Training = { tempo: 0, ausdauer: 0, sprungkraft: 0, gehorsam: 0 }

// Startwert aus der Rasse (bis 60) plus Training, hoechstens 100.
export function statValue(breedId: string | undefined, training: Training, key: StatKey): number {
  const base = breedId ? breedById(breedId).stats[key] : 0.3
  return Math.min(100, Math.round(base * 60 + (training[key] ?? 0)))
}

// Lernfreudige Hunde gewinnen mehr pro Durchgang.
// Mit Timing-Spiel: guter Tipp +1, schlechter -1, immer zwischen 1 und 3 (Grenze auch im Server).
export function trainGainWith(learning: number, quality: number): 1 | 2 | 3 {
  const g = trainGain(learning) + (quality > 0.8 ? 1 : quality < 0.3 ? -1 : 0)
  return Math.max(1, Math.min(3, g)) as 1 | 2 | 3
}

export function trainGain(learning: number): 1 | 2 | 3 {
  return learning > 0.66 ? 3 : learning > 0.33 ? 2 : 1
}
