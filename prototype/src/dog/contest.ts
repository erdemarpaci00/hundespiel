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

export function eligible(league: League, values: Record<StatKey, number>): boolean {
  return average(values) >= league.entry
}

export interface Round { stat: StatKey; dog: number; rival: number; won: boolean }
export interface Result { rounds: Round[]; won: boolean; prize: number }

// Vier Runden, eine pro Wert. Beide Seiten haben pro Runde Tagesform (0 bis 30), der Gegner ist
// pro Turnier um +-12 staerker oder schwaecher. Wer mehr Runden gewinnt, siegt; bei 2:2 zaehlt die Gesamtsumme.
// Simuliert: Gewinnchance steigt ueber etwa 30 Wertpunkte von 10 auf 90 Prozent.
export function runContest(league: League, values: Record<StatKey, number>, rng: () => number): Result {
  const form = (rng() - 0.5) * 24
  const rounds = STAT_KEYS.map((stat): Round => {
    const dog = values[stat] + rng() * 30
    const rival = league.rival + form + rng() * 30
    return { stat, dog, rival, won: dog > rival }
  })
  const wins = rounds.filter((r) => r.won).length
  const sum = rounds.reduce((s, r) => s + r.dog - r.rival, 0)
  const won = wins > 2 || (wins === 2 && sum > 0)
  return { rounds, won, prize: won ? league.win : league.consolation }
}
