export interface Poop { x: number; y: number }

export const MAX_POOPS = 6

const key = (householdId: string): string => `poop:${householdId}`

// Haufen bleiben ueber Szenenwechsel und Neuladen erhalten (pro Geraet; Browser-Speicher kann fehlen).
export function loadPoops(householdId: string): Poop[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key(householdId)) ?? '[]') as unknown
    if (!Array.isArray(raw)) return []
    return raw
      .filter((p): p is Poop => typeof p?.x === 'number' && typeof p?.y === 'number')
      .slice(0, MAX_POOPS)
  } catch {
    return []
  }
}

export function savePoops(householdId: string, poops: Poop[]): void {
  try {
    localStorage.setItem(key(householdId), JSON.stringify(poops.slice(0, MAX_POOPS)))
  } catch {
    /* ohne Speicher gehen sie beim Neuladen verloren */
  }
}

// Alle 20 Sekunden wuerfeln: ein wacher Hund macht im Schnitt etwa alle 10 Minuten einen Haufen.
export function wantsPoop(rng: () => number, awake: boolean, current: number): boolean {
  return awake && current < MAX_POOPS && rng() < 20 / 600
}
