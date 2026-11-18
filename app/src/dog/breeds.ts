import type { Rng } from '../util/rng'
import type { Personality } from './behavior'
import type { DogLook, EarType, Pattern, TailType } from './look'

// Start-Begabungen 0..1, Grundlage fuer die Stats (Tempo, Ausdauer, Sprungkraft, Gehorsam) in Schritt 2.
export interface BreedStats {
  tempo: number
  ausdauer: number
  sprungkraft: number
  gehorsam: number
}

export interface Breed {
  id: string
  name: string
  sizeMin: number
  sizeMax: number
  ears: EarType[]
  tails: TailType[]
  coats: number[]
  pattern: Pattern
  patternColor: number
  // Mittelpunkt der Charakter-Tendenz, der einzelne Hund streut darum herum.
  personality: Personality
  stats: BreedStats
}

// Farben wie in look.ts: Braun, Creme, Schwarz, Grau, Rotbraun
const BROWN = 0x8b5a2b, CREAM = 0xf0dfb8, BLACK = 0x2b2b2b, GREY = 0x9a9a9a, RED = 0xb5532a
const p = (energy: number, courage: number, affection: number, learning: number, appetite: number): Personality =>
  ({ energy, courage, affection, learning, appetite })

export const BREEDS: Breed[] = [
  { id: 'husky', name: 'Husky', sizeMin: 1.1, sizeMax: 1.25, ears: ['pointy'], tails: ['curly'], coats: [GREY], pattern: 'patch', patternColor: CREAM, personality: p(0.85, 0.6, 0.45, 0.35, 0.35), stats: { tempo: 0.6, ausdauer: 0.95, sprungkraft: 0.6, gehorsam: 0.35 } },
  { id: 'labrador', name: 'Labrador', sizeMin: 1.1, sizeMax: 1.25, ears: ['floppy'], tails: ['long'], coats: [CREAM, BROWN, BLACK], pattern: 'plain', patternColor: CREAM, personality: p(0.7, 0.6, 0.85, 0.75, 0.95), stats: { tempo: 0.6, ausdauer: 0.7, sprungkraft: 0.6, gehorsam: 0.75 } },
  { id: 'dackel', name: 'Dackel', sizeMin: 0.7, sizeMax: 0.8, ears: ['floppy'], tails: ['long'], coats: [RED, BROWN], pattern: 'plain', patternColor: BROWN, personality: p(0.55, 0.85, 0.6, 0.4, 0.7), stats: { tempo: 0.45, ausdauer: 0.5, sprungkraft: 0.3, gehorsam: 0.4 } },
  { id: 'schaeferhund', name: 'Schäferhund', sizeMin: 1.2, sizeMax: 1.3, ears: ['pointy'], tails: ['long'], coats: [BROWN], pattern: 'patch', patternColor: BLACK, personality: p(0.7, 0.85, 0.65, 0.9, 0.5), stats: { tempo: 0.75, ausdauer: 0.8, sprungkraft: 0.7, gehorsam: 0.95 } },
  { id: 'corgi', name: 'Corgi', sizeMin: 0.75, sizeMax: 0.85, ears: ['pointy'], tails: ['short'], coats: [RED], pattern: 'patch', patternColor: CREAM, personality: p(0.7, 0.7, 0.7, 0.7, 0.85), stats: { tempo: 0.9, ausdauer: 0.55, sprungkraft: 0.85, gehorsam: 0.65 } },
  { id: 'pudel', name: 'Pudel', sizeMin: 0.85, sizeMax: 1.0, ears: ['round'], tails: ['curly'], coats: [CREAM, BLACK, GREY], pattern: 'plain', patternColor: CREAM, personality: p(0.75, 0.5, 0.8, 0.9, 0.4), stats: { tempo: 0.65, ausdauer: 0.6, sprungkraft: 0.75, gehorsam: 0.9 } },
  { id: 'dalmatiner', name: 'Dalmatiner', sizeMin: 1.1, sizeMax: 1.2, ears: ['floppy'], tails: ['long'], coats: [CREAM], pattern: 'spots', patternColor: BLACK, personality: p(0.9, 0.65, 0.6, 0.5, 0.6), stats: { tempo: 0.85, ausdauer: 0.9, sprungkraft: 0.7, gehorsam: 0.5 } },
  { id: 'mops', name: 'Mops', sizeMin: 0.7, sizeMax: 0.8, ears: ['round'], tails: ['curly'], coats: [CREAM, BROWN], pattern: 'plain', patternColor: BLACK, personality: p(0.3, 0.45, 0.9, 0.4, 0.95), stats: { tempo: 0.25, ausdauer: 0.25, sprungkraft: 0.25, gehorsam: 0.45 } },
]

export function breedById(id: string): Breed {
  const b = BREEDS.find((x) => x.id === id)
  if (!b) throw new Error(`Unbekannte Rasse: ${id}`)
  return b
}

const pick = <T>(list: T[], rng: Rng): T => list[Math.floor(rng() * list.length)]
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))
const spread = (center: number, rng: Rng): number => clamp01(center + (rng() - 0.5) * 0.5)

export function rollBreedPuppy(breed: Breed, rng: Rng): { look: DogLook; personality: Personality } {
  const look: DogLook = {
    breed: breed.id,
    size: breed.sizeMin + (breed.sizeMax - breed.sizeMin) * rng(),
    ear: pick(breed.ears, rng),
    tail: pick(breed.tails, rng),
    coat: pick(breed.coats, rng),
    pattern: breed.pattern,
    patternColor: breed.patternColor,
  }
  const c = breed.personality
  const personality: Personality = {
    energy: spread(c.energy, rng),
    courage: spread(c.courage, rng),
    affection: spread(c.affection, rng),
    learning: spread(c.learning, rng),
    appetite: spread(c.appetite, rng),
  }
  return { look, personality }
}

// n verschiedene Rassen, zufaellig gezogen (Fisher-Yates auf einer Kopie).
export function pickBreeds(n: number, rng: Rng): Breed[] {
  const pool = [...BREEDS]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, n)
}
