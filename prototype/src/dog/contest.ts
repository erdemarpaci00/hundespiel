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
  { id: 'bronze', name: 'Bronze-Liga', rival: 30, win: 20, consolation: 4, entry: 0 },
  { id: 'silber', name: 'Silber-Liga', rival: 48, win: 45, consolation: 8, entry: 35 },
  { id: 'gold', name: 'Gold-Liga', rival: 66, win: 90, consolation: 14, entry: 50 },
  { id: 'olympia', name: 'Olympia', rival: 84, win: 220, consolation: 30, entry: 68 },
]

export const CONTEST_MIN_ENERGY = 40

export function average(values: Record<StatKey, number>): number {
  return STAT_KEYS.reduce((sum, k) => sum + values[k], 0) / STAT_KEYS.length
}

export function eligible(league: League, values: Record<StatKey, number>): boolean {
  return average(values) >= league.entry
}

export interface Round { stat: StatKey; dog: number; rival: number; won: boolean }
export interface Result { rounds: Round[]; won: boolean; prize: number }

// Vier Runden, eine pro Wert. Tagesform (rng) kommt zu jedem Wert dazu (0 bis 20),
// wer mehr Runden gewinnt, siegt; bei Gleichstand entscheidet die Gesamtsumme.
export function runContest(league: League, values: Record<StatKey, number>, rng: () => number): Result {
  const rounds = STAT_KEYS.map((stat): Round => {
    const dog = values[stat] + rng() * 20
    const rival = league.rival + (rng() - 0.5) * 20
    return { stat, dog, rival, won: dog > rival }
  })
  const wins = rounds.filter((r) => r.won).length
  const sum = rounds.reduce((s, r) => s + r.dog - r.rival, 0)
  const won = wins > 2 || (wins === 2 && sum > 0)
  return { rounds, won, prize: won ? league.win : league.consolation }
}
