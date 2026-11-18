// Tagesbuch: gleiche Werte wie supabase/013-daily.sql (need) - der Server prueft und zahlt aus.
export const DAILY_TASKS = [
  { label: 'Hunde füttern oder mit Leckerli verwöhnen', need: 2 },
  { label: 'Spielen, streicheln, bürsten, Schatzsuche', need: 3 },
  { label: 'Trainieren oder zum Turnier gehen', need: 2 },
] as const

export interface DailyState {
  have: number[]
  claimed: number[]
  streak: number
}

export type TaskStatus = 'open' | 'ready' | 'done'

export function taskStatus(s: DailyState, i: number): TaskStatus {
  if (s.claimed.includes(i + 1)) return 'done'
  return (s.have[i] ?? 0) >= DAILY_TASKS[i].need ? 'ready' : 'open'
}

export const readyCount = (s: DailyState): number => DAILY_TASKS.filter((_, i) => taskStatus(s, i) === 'ready').length
