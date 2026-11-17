export type Phase = 'night' | 'dawn' | 'day' | 'dusk'
export type Weather = 'sun' | 'cloud' | 'rain'

// Ortszeit des Handys: 22-6 Nacht, 6-8 Morgen, 8-19 Tag, 19-22 Abend.
export function dayPhase(d: Date): Phase {
  const h = d.getHours()
  if (h >= 22 || h < 6) return 'night'
  if (h < 8) return 'dawn'
  if (h < 19) return 'day'
  return 'dusk'
}

// Das Wetter haengt nur von der Weltzeit ab (3-Stunden-Bloecke), darum sehen beide Handys dasselbe.
export function weatherAt(d: Date): Weather {
  const block = Math.floor(d.getTime() / (3 * 3600 * 1000))
  let x = (block * 2654435761) >>> 0
  x = ((x ^ (x >>> 15)) * 2246822519) >>> 0
  const r = (x >>> 8) % 100
  if (r < 55) return 'sun'
  if (r < 80) return 'cloud'
  return 'rain'
}
