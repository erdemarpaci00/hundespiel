import { STAT_KEYS, type StatKey } from './stats'

export interface League {
  id: 'bronze' | 'silber' | 'gold' | 'olympia'
  name: string
  // Staerke der Gegner (0 bis 100) und Preisgeld fuer den Sieg bzw. den Trostpreis.
  rival: number
  win: number
  consolation: number
  // Mindestdurchschnitt der vier Werte fuer die Zulassung.
  entry: number
}

export const LEAGUES: League[] = [
  { id: 'bronze', name: 'Bronze-Liga', rival: 28, win: 15, consolation: 5, entry: 0 },
  { id: 'silber', name: 'Silber-Liga', rival: 50, win: 40, consolation: 10, entry: 35 },
  { id: 'gold', name: 'Gold-Liga', rival: 66, win: 100, consolation: 20, entry: 50 },
  { id: 'olympia', name: 'Olympia', rival: 80, win: 260, consolation: 40, entry: 68 },
]

export const CONTEST_MIN_ENERGY = 40

export function average(values: Record<StatKey, number>): number {
  return STAT_KEYS.reduce((sum, k) => sum + values[k], 0) / STAT_KEYS.length
}

// Zulassung: Schnittwert reicht, und fuer jede hoehere Liga braucht es 3 Pokale der Liga davor.
export const CUPS_TO_ADVANCE = 3

export function eligible(league: League, values: Record<StatKey, number>, trophies: Partial<Record<string, number>> = {}): boolean {
  return average(values) >= league.entry && cupsMissing(league, trophies) === 0
}

export function cupsMissing(league: League, trophies: Partial<Record<string, number>>): number {
  const i = LEAGUES.findIndex((l) => l.id === league.id)
  if (i <= 0) return 0
  return Math.max(0, CUPS_TO_ADVANCE - (trophies[LEAGUES[i - 1].id] ?? 0))
}

// Wer gut gelaunt antritt, hat Rueckenwind; ein trauriger Hund laeuft schlechter.
export function formBonus(happiness: number): number {
  return happiness >= 70 ? 5 : happiness < 30 ? -5 : 0
}

export interface Round { stat: StatKey; dog: number; rival: number; won: boolean }
export interface Result { rounds: Round[]; won: boolean; prize: number }

// Wurfqualitaet q (0 bis 1, 1 = perfekter Wurf) verschiebt die Leistung um -15 bis +15.
export function throwBonus(q: number): number {
  return (Math.min(1, Math.max(0, q)) - 0.5) * 30
}

// Wie gut Hund und Mensch zusammenpassen: anhaengliche Hunde laufen fuer ihre Leute besser (0 bis 6).
export function fitBonus(affection: number): number {
  return Math.round(Math.min(1, Math.max(0, affection)) * 6)
}

// Tagesform des Gegners fuer das ganze Turnier (-12 bis +12).
export function rivalForm(rng: () => number): number {
  return (rng() - 0.5) * 24
}

export interface RoundInput {
  stat: StatKey
  value: number
  league: League
  form: number
  happiness: number
  affection: number
  // Wurfqualitaet dieser Runde, 0.5 = durchschnittlich (ohne Spielerwurf).
  throwQuality: number
  // Der Werfer ist der Lieblingsmensch des Hundes.
  favorite?: boolean
}

export const FAVORITE_BONUS = 4

// Eine Runde: Wert + Tagesglueck (0 bis 30) + Laune + Passung + Wurf gegen Gegner mit Form.
export function playRound(i: RoundInput, rng: () => number): Round {
  const dog = i.value + rng() * 30 + formBonus(i.happiness) + fitBonus(i.affection) + throwBonus(i.throwQuality) + (i.favorite ? FAVORITE_BONUS : 0)
  const rival = i.league.rival + i.form + rng() * 30
  return { stat: i.stat, dog, rival, won: dog > rival }
}

// Wer mehr Runden gewinnt, siegt; bei 2:2 zaehlt die Gesamtsumme.
export function summarize(league: League, rounds: Round[]): Result {
  const wins = rounds.filter((r) => r.won).length
  const sum = rounds.reduce((s, r) => s + r.dog - r.rival, 0)
  const won = wins > 2 || (wins === 2 && sum > 0)
  return { rounds, won, prize: won ? league.win : league.consolation }
}

// Ohne Spielerwurf (Tests, Schnelllauf): durchschnittliche Wuerfe.
export function runContest(league: League, values: Record<StatKey, number>, rng: () => number, happiness = 50, affection = 0.5): Result {
  const form = rivalForm(rng)
  return summarize(league, STAT_KEYS.map((stat) => playRound({ stat, value: values[stat], league, form, happiness, affection, throwQuality: 0.5 }, rng)))
}

// Hoechste Liga mit mindestens einem Pokal (Index in LEAGUES), -1 ohne Pokal. Bestimmt die Medaille am Halsband.
export function topLeague(trophies: Partial<Record<string, number>>): number {
  let top = -1
  LEAGUES.forEach((l, i) => { if ((trophies[l.id] ?? 0) > 0) top = i })
  return top
}

export const MEDAL_COLORS = [0xcd7f32, 0xc0c0c0, 0xffd700, 0x66e0ff]

export interface DuelSide {
  value: number
  happiness: number
  affection: number
  throwQuality: number
  favorite?: boolean
}

// Duell zweier eigener Hunde: gleiche Zutaten wie im Turnier, aber gegeneinander.
export function duelScore(s: DuelSide, rng: () => number): number {
  return s.value + rng() * 30 + formBonus(s.happiness) + fitBonus(s.affection) + throwBonus(s.throwQuality) + (s.favorite ? FAVORITE_BONUS : 0)
}

// Server sperrt ein Turnier 10 Minuten nach dem letzten: vorher pruefen statt nach vier Runden abzulehnen.
export function contestWaitMinutes(d: { contestAt: string | null }, now = Date.now()): number {
  if (!d.contestAt) return 0
  const left = 10 * 60 * 1000 - (now - new Date(d.contestAt).getTime())
  return left > 0 ? Math.ceil(left / 60000) : 0
}
