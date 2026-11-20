import { parseTimestamp } from './time'
export type ActivityKind = 'adopt' | 'feed' | 'pet' | 'train' | 'play' | 'groom' | 'contest' | 'treat' | 'contest_win' | 'contest_lose'

export interface ActivityEntry {
  id: string
  kind: ActivityKind
  userName: string
  userId?: string
  dogName: string
  at: string
}

const VERB: Record<ActivityKind, string> = {
  feed: 'gefüttert',
  pet: 'gestreichelt',
  adopt: 'aufgenommen',
  train: 'trainiert',
  play: 'den Ball geworfen',
  groom: 'gebürstet',
  contest: 'zum Turnier gebracht',
  treat: 'ein Leckerli gegeben',
  contest_win: 'zum Turniersieg begleitet',
  contest_lose: 'beim Turnier angefeuert',
}

export function describeActivity(e: ActivityEntry): string {
  return `${e.userName} hat ${e.dogName} ${VERB[e.kind]}`
}

export function relativeTime(iso: string, nowMs: number): string {
  const diff = nowMs - parseTimestamp(iso)
  if (!Number.isFinite(diff) || diff < 60_000) return 'gerade eben'
  const min = Math.floor(diff / 60_000)
  if (min < 60) return `vor ${min} Min`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `vor ${hours} Std`
  const days = Math.floor(hours / 24)
  return `vor ${days} ${days === 1 ? 'Tag' : 'Tagen'}`
}

// Wem der Hund gerade mehr anhaengt: Zuwendungen der letzten 7 Tage je Person. Knapp (Differenz unter 2) = gleich.
export function favoriteOf(counts: Record<string, number>): string | null {
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
  if (sorted.length === 0 || sorted[0][1] === 0) return null
  if (sorted.length > 1 && sorted[0][1] - sorted[1][1] < 2) return 'beide'
  return sorted[0][0]
}

export function favoriteLine(dogName: string, fav: string | null): string | null {
  if (!fav) return null
  return fav === 'beide' ? `${dogName} mag euch beide gleich gern` : `${dogName} hängt gerade mehr an ${fav}`
}

// Lebenslauf eines Hundes aus den gezaehlten Momenten: nur was es gab, in fester Reihenfolge.
export function storyLines(c: Partial<Record<ActivityKind, number>>): string[] {
  const n = (...k: ActivityKind[]): number => k.reduce((sum, key) => sum + (c[key] ?? 0), 0)
  const out: string[] = []
  const add = (count: number, one: string, many: string): void => { if (count > 0) out.push(count === 1 ? `1 ${one}` : `${count} ${many}`) }
  add(n('feed', 'treat'), 'Mahlzeit bekommen', 'Mahlzeiten bekommen')
  add(n('pet', 'groom'), 'Mal verwöhnt', 'Mal verwöhnt')
  add(n('play'), 'Mal Ball gespielt', 'Mal Ball gespielt')
  add(n('train'), 'Trainingseinheit', 'Trainingseinheiten')
  add(n('contest_win'), 'Turniersieg', 'Turniersiege')
  add(n('contest', 'contest_win', 'contest_lose'), 'Turnier', 'Turniere')
  return out
}
