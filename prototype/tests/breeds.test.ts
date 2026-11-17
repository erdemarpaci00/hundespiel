import { expect, test } from 'vitest'
import { BREEDS, breedById, pickBreeds, rollBreedPuppy } from '../src/dog/breeds'
import { mulberry32 } from '../src/util/rng'
import { rollPuppies } from '../src/puppies'

const avg = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length

function sample(id: string, n = 200) {
  const breed = breedById(id)
  const rng = mulberry32(5)
  return Array.from({ length: n }, () => rollBreedPuppy(breed, rng))
}

test('es gibt 8 Rassen mit eindeutiger id', () => {
  expect(BREEDS).toHaveLength(8)
  expect(new Set(BREEDS.map((b) => b.id)).size).toBe(8)
})

test('Husky: Stehohren, Ringelschwanz, graues Fell, energiegeladen, stur', () => {
  const pups = sample('husky')
  for (const p of pups) {
    expect(p.look.breed).toBe('husky')
    expect(p.look.ear).toBe('pointy')
    expect(p.look.tail).toBe('curly')
  }
  expect(avg(pups.map((p) => p.personality.energy))).toBeGreaterThan(0.7)
  expect(avg(pups.map((p) => p.personality.learning))).toBeLessThan(0.5)
})

test('Dackel ist kleiner als Husky und Labrador verfressener als Husky', () => {
  const dachs = avg(sample('dackel').map((p) => p.look.size))
  const husky = avg(sample('husky').map((p) => p.look.size))
  expect(dachs).toBeLessThan(husky)
  const lab = avg(sample('labrador').map((p) => p.personality.appetite))
  const hus = avg(sample('husky').map((p) => p.personality.appetite))
  expect(lab).toBeGreaterThan(hus)
})

test('alle Werte bleiben in ihren Bereichen', () => {
  for (const b of BREEDS) {
    for (const p of sample(b.id, 100)) {
      expect(p.look.size).toBeGreaterThanOrEqual(b.sizeMin)
      expect(p.look.size).toBeLessThanOrEqual(b.sizeMax)
      for (const v of Object.values(p.personality)) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      }
    }
  }
})

test('pickBreeds liefert verschiedene Rassen', () => {
  for (let s = 1; s <= 50; s++) {
    const ids = pickBreeds(3, mulberry32(s)).map((b) => b.id)
    expect(new Set(ids).size).toBe(3)
  }
})

test('rollPuppies: drei verschiedene Rassen', () => {
  for (let s = 1; s <= 50; s++) {
    const breeds = rollPuppies(s).map((p) => p.look.breed)
    expect(new Set(breeds).size).toBe(3)
  }
})
