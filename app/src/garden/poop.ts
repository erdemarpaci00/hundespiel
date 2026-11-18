export interface Poop { id: string; x: number; y: number }

export const MAX_POOPS = 6

const key = (householdId: string): string => `poop:${householdId}`

// Alle 20 Sekunden wuerfeln: ein wacher Hund macht im Schnitt etwa alle 10 Minuten einen Haufen.
export function wantsPoop(rng: () => number, awake: boolean, current: number): boolean {
  return awake && current < MAX_POOPS && rng() < 20 / 600
}
