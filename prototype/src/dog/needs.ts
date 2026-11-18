import type { Personality } from './behavior'

export interface Needs {
  hunger: number
  energy: number
  happiness: number
}

export type Mood = 'happy' | 'ok' | 'hungry' | 'tired' | 'sad'

export const MIN_NEED = 10
export const MAX_NEED = 100
export const MAX_ELAPSED_MS = 7 * 24 * 3600 * 1000

const HOUR_MS = 3600 * 1000
const clamp = (v: number): number => Math.min(MAX_NEED, Math.max(MIN_NEED, v))

// Verfall pro Stunde. Hunger haengt vom Appetit ab, die anderen sind fest.
// Nachts (22 bis 6 Uhr Ortszeit) schlaeft der Hund und erholt sich: Energie steigt, tagsueber sinkt sie.
const isSleepHour = (ms: number): boolean => { const h = new Date(ms).getHours(); return h >= 22 || h < 6 }

function energyOver(start: number, elapsedMs: number, endMs: number): number {
  let e = start
  const step = 15 * 60 * 1000
  for (let t = endMs - elapsedMs; t < endMs; t += step) {
    const len = Math.min(step, endMs - t) / HOUR_MS
    e = Math.min(MAX_NEED, Math.max(MIN_NEED, e + (isSleepHour(t + step / 2) ? 10 : -6) * len))
  }
  return e
}

export function applyElapsed(n: Needs, elapsedMs: number, p: Personality, endMs: number = Date.now()): Needs {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return { ...n }
  const capped = Math.min(elapsedMs, MAX_ELAPSED_MS)
  const hours = capped / HOUR_MS
  return {
    hunger: clamp(n.hunger - hours * 12.5 * (0.7 + 0.6 * p.appetite)),
    energy: energyOver(n.energy, capped, endMs),
    happiness: clamp(n.happiness - hours * 2),
  }
}

export function feed(n: Needs): Needs {
  return { ...n, hunger: clamp(n.hunger + 40), happiness: clamp(n.happiness + 5) }
}

export function pet(n: Needs, p: Personality): Needs {
  return { ...n, happiness: clamp(n.happiness + 5 + 10 * p.affection) }
}

export function mood(n: Needs): Mood {
  if (n.happiness < 30) return 'sad'
  if (n.hunger < 30) return 'hungry'
  if (n.energy < 30) return 'tired'
  if (n.hunger >= 70 && n.energy >= 70 && n.happiness >= 70) return 'happy'
  return 'ok'
}

// Die Stimmung verschiebt nur die Energie, die Persoenlichkeit selbst bleibt.
export function moodPersonality(p: Personality, m: Mood): Personality {
  switch (m) {
    case 'tired': return { ...p, energy: p.energy * 0.3 }
    case 'sad': return { ...p, energy: p.energy * 0.6 }
    case 'hungry': return { ...p, energy: p.energy * 0.7 }
    case 'happy': return { ...p, energy: Math.min(1, p.energy + 0.2) }
    default: return p
  }
}

export const TRAIN_MIN_ENERGY = 35

// Training kostet Kraft und macht hungrig, aber zufrieden.
export function train(n: Needs): Needs {
  return { hunger: clamp(n.hunger - 8), energy: clamp(n.energy - 20), happiness: clamp(n.happiness + 4) }
}

export const PLAY_MIN_ENERGY = 25

// Ballspiel macht froh, kostet Kraft und etwas Sattheit.
export function play(n: Needs): Needs {
  return { hunger: clamp(n.hunger - 4), energy: clamp(n.energy - 12), happiness: clamp(n.happiness + 15) }
}

// Buersten entspannt: Laune steigt, sonst bleibt alles gleich.
export function groom(n: Needs): Needs {
  return { ...n, happiness: clamp(n.happiness + 12) }
}
