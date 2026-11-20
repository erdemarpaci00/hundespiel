export type Phase = 'night' | 'dawn' | 'day' | 'dusk'
export type Weather = 'sun' | 'cloud' | 'rain'
export type Season = 'winter' | 'spring' | 'summer' | 'autumn'

// Jahreszeit nach Kalendermonat (noerdliche Halbkugel): Dez-Feb Winter, Mar-Mai Fruehling, Jun-Aug Sommer, Sep-Nov Herbst.
export function seasonOf(d: Date): Season {
  const m = d.getMonth()
  if (m === 11 || m <= 1) return 'winter'
  if (m <= 4) return 'spring'
  if (m <= 7) return 'summer'
  return 'autumn'
}

// Ortszeit des Handys: 23-7 Nacht, 7-8 Morgen, 8-19 Tag, 19-23 Abend.
export function dayPhase(d: Date): Phase {
  const h = d.getHours()
  if (h >= 23 || h < 7) return 'night'
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
