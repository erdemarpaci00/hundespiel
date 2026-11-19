// Wertung der Trainingsspiele, jeweils 0 bis 1. Rein rechnerisch, damit sie testbar bleibt.

export const SPRINT_SECONDS = 5
export const SPRINT_TARGET_TAPS = 35

// Sprinten: moeglichst oft tippen.
export function sprintScore(taps: number): number {
  return Math.max(0, Math.min(1, taps / SPRINT_TARGET_TAPS))
}

// Ausdauerlauf: im Takt tippen. Abweichung zum naechsten Schlag in Millisekunden, null = Schlag verpasst.
export function rhythmScore(errorsMs: (number | null)[]): number {
  if (errorsMs.length === 0) return 0
  const pts: number[] = errorsMs.map((e) => (e === null ? 0 : e <= 120 ? 1 : e <= 250 ? 0.5 : 0))
  return pts.reduce((a, b) => a + b, 0) / pts.length
}

// Hindernis: Kraft beim Loslassen gegen die noetige Hoehe, im Abstand von 0.25 faellt es auf 0.
export function jumpScore(power: number, need: number): number {
  return Math.max(0, 1 - Math.abs(power - need) / 0.25)
}

// Sitz und Platz: Anteil der richtig wiederholten Kommandos an der richtigen Stelle.
export function commandScore(shown: string[], given: string[]): number {
  if (shown.length === 0) return 0
  let ok = 0
  for (let i = 0; i < shown.length; i++) if (given[i] === shown[i]) ok++
  return ok / shown.length
}
