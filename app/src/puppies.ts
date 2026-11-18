import type { Personality } from './dog/behavior'
import { pickBreeds, rollBreedPuppy } from './dog/breeds'
import type { DogLook } from './dog/look'
import { mulberry32 } from './util/rng'

export interface Puppy {
  look: DogLook
  personality: Personality
}

export function rollPuppies(seed: number): Puppy[] {
  const rng = mulberry32(seed)
  return pickBreeds(3, rng).map((breed) => rollBreedPuppy(breed, rng))
}

// Stabiler Seed aus der Nutzer-ID (FNV-1a), damit jeder seine eigene, gleichbleibende Auswahl sieht.
export function puppySeedFor(userId: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
