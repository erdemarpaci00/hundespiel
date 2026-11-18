import { describe, expect, it } from 'vitest'
import { BREEDS } from '../src/dog/breeds'
import { breedCollection } from '../src/dog/breedCollection'

describe('Rassen-Sammlung', () => {
  it('listet alle Rassen und markiert die vorhandenen', () => {
    const c = breedCollection(['husky', 'husky', 'mops'])
    expect(c.items).toHaveLength(BREEDS.length)
    expect(c.have).toBe(2)
    expect(c.items.find((i) => i.id === 'husky')?.owned).toBe(true)
    expect(c.items.find((i) => i.id === 'corgi')?.owned).toBe(false)
  })
  it('ignoriert Mischlinge und unbekannte Rassen', () => {
    expect(breedCollection([undefined, 'quatsch']).have).toBe(0)
  })
})
