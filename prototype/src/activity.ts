import { parseTimestamp } from './time'
export type ActivityKind = 'adopt' | 'feed' | 'pet' | 'train' | 'play' | 'groom' | 'contest' | 'treat' | 'contest_win' | 'contest_lose'

export interface ActivityEntry {
  id: string
  kind: ActivityKind
  userName: string
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
