import { describe, expect, it } from 'vitest'
import { weekSummary } from '../src/weekly'

const NOW = Date.parse('2026-11-19T12:00:00Z')
const at = (daysAgo: number): string => new Date(NOW - daysAgo * 86400000).toISOString()

describe('Wochenbilanz', () => {
  it('zaehlt nur die letzten sieben Tage', () => {
    const lines = weekSummary([{ kind: 'train', at: at(1) }, { kind: 'train', at: at(6.5) }, { kind: 'train', at: at(8) }], NOW)
    expect(lines.find((l) => l.label === 'Trainiert')?.count).toBe(2)
  })
  it('fasst Streicheln und Buersten zusammen, Siege zaehlen auch als Turnier', () => {
    const lines = weekSummary([{ kind: 'pet', at: at(0) }, { kind: 'groom', at: at(2) }, { kind: 'contest_win', at: at(1) }], NOW)
    expect(lines[0].count).toBe(2)
    expect(lines.find((l) => l.label === 'Turniere')?.count).toBe(1)
    expect(lines.find((l) => l.label === 'Turniersiege')?.count).toBe(1)
  })
  it('leer ergibt lauter Nullen', () => {
    expect(weekSummary([], NOW).every((l) => l.count === 0)).toBe(true)
  })
})
