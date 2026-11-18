// Wer lange weg war, wird vom Hund begruesst. Zeitpunkt des letzten Besuchs steht im Browser-Speicher.
export const WELCOME_AFTER_MS = 2 * 3600 * 1000

export function shouldWelcome(lastVisit: number | null, now: number): boolean {
  return lastVisit !== null && now - lastVisit >= WELCOME_AFTER_MS
}

const KEY = 'lastVisit'

export function readLastVisit(): number | null {
  try {
    const v = Number(localStorage.getItem(KEY))
    return Number.isFinite(v) && v > 0 ? v : null
  } catch {
    return null
  }
}

export function markVisit(now: number): void {
  try {
    localStorage.setItem(KEY, String(now))
  } catch {
    /* ohne Speicher keine Begruessung */
  }
}
