import { BREEDS } from './breeds'

export interface CollectionItem { id: string; name: string; owned: boolean }

// Welche Rassen hat der Haushalt aktuell bei sich? Mischlinge zaehlen nicht.
export function breedCollection(ownedBreeds: (string | undefined)[]): { items: CollectionItem[]; have: number } {
  const owned = new Set(ownedBreeds.filter((b): b is string => !!b))
  const items = BREEDS.map((b) => ({ id: b.id, name: b.name, owned: owned.has(b.id) }))
  return { items, have: items.filter((i) => i.owned).length }
}
