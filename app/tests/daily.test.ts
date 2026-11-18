import { describe, expect, it } from 'vitest'
import { DAILY_TASKS, readyCount, taskStatus } from '../src/daily'

describe('Tagesbuch', () => {
  const s = { have: [2, 1, 5], claimed: [3], streak: 2 }
  it('erkennt offen, bereit und abgeholt', () => {
    expect(taskStatus(s, 0)).toBe('ready')
    expect(taskStatus(s, 1)).toBe('open')
    expect(taskStatus(s, 2)).toBe('done')
  })
  it('zaehlt abholbare Aufgaben', () => {
    expect(readyCount(s)).toBe(1)
  })
  it('hat drei Aufgaben', () => {
    expect(DAILY_TASKS).toHaveLength(3)
  })
})
