import { describe, expect, it } from 'vitest'
import { ageDays, ageStage, ageLabel } from '../src/dog/age'

const DAY = 24 * 3600 * 1000
const born = Date.parse('2026-01-01T00:00:00Z')

describe('age', () => {
  it('zählt volle Tage seit der Geburt, nie negativ', () => {
    expect(ageDays(born, born + 2.5 * DAY)).toBe(2)
    expect(ageDays(born, born - DAY)).toBe(0)
  })
  it('kennt Welpe, Junghund, Erwachsen und Senior', () => {
    expect(ageStage(0).name).toBe('Welpe')
    expect(ageStage(2).name).toBe('Welpe')
    expect(ageStage(3).name).toBe('Junghund')
    expect(ageStage(10).name).toBe('Erwachsen')
    expect(ageStage(120).name).toBe('Senior')
  })
  it('Welpen sind kleiner als Erwachsene', () => {
    expect(ageStage(0).scale).toBeLessThan(ageStage(3).scale)
    expect(ageStage(3).scale).toBeLessThan(ageStage(10).scale)
  })
  it('beschriftet mit Stufe und Tagen', () => {
    expect(ageLabel(1)).toBe('Welpe, 1 Tag alt')
    expect(ageLabel(5)).toBe('Junghund, 5 Tage alt')
  })
})
