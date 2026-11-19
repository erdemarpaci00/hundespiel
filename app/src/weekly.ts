import { parseTimestamp } from './time'
import type { ActivityKind } from './activity'

export interface WeekLine { label: string; count: number }

const WEEK_MS = 7 * 24 * 3600 * 1000

// Zaehlt die Aktivitaeten der letzten sieben Tage zu einer kleinen Wochenbilanz.
export function weekSummary(rows: { kind: ActivityKind; at: string }[], nowMs: number): WeekLine[] {
  const recent = rows.filter((r) => nowMs - parseTimestamp(r.at) <= WEEK_MS)
  const n = (...kinds: ActivityKind[]): number => recent.filter((r) => kinds.includes(r.kind)).length
  return [
    { label: 'Gestreichelt und gebürstet', count: n('pet', 'groom') },
    { label: 'Gespielt und Ball geworfen', count: n('play') },
    { label: 'Trainiert', count: n('train') },
    { label: 'Turniere', count: n('contest', 'contest_win', 'contest_lose') },
    { label: 'Turniersiege', count: n('contest_win') },
  ]
}
