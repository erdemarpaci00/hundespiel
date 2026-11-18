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

// Vier Runden, eine pro Wert. Beide Seiten haben pro Runde Tagesform (0 bis 30), der Gegner ist
// pro Turnier um +-12 staerker oder schwaecher. Wer mehr Runden gewinnt, siegt; bei 2:2 zaehlt die Gesamtsumme.
// Simuliert: Gewinnchance steigt ueber etwa 30 Wertpunkte von 10 auf 90 Prozent.
export function runContest(league: League, values: Record<StatKey, number>, rng: () => number, happiness = 50): Result {
  const form = (rng() - 0.5) * 24
  const rounds = STAT_KEYS.map((stat): Round => {
    const dog = values[stat] + rng() * 30 + formBonus(happiness)
    const rival = league.rival + form + rng() * 30
    return { stat, dog, rival, won: dog > rival }
  })
  const wins = rounds.filter((r) => r.won).length
  const sum = rounds.reduce((s, r) => s + r.dog - r.rival, 0)
  const won = wins > 2 || (wins === 2 && sum > 0)
  return { rounds, won, prize: won ? league.win : league.consolation }
}
