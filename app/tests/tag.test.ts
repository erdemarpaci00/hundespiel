import { describe, expect, it } from 'vitest'
import { fleeSpot } from '../src/dog/tag'

const bounds = { x: 20, y: 200, w: 600, h: 140 }

describe('fleeSpot', () => {
  it('liegt im Garten und mindestens 120 Pixel vom Verfolger weg', () => {
    for (let i = 0; i < 50; i++) {
      const from = { x: 20 + Math.random() * 600, y: 200 + Math.random() * 140 }
      const p = fleeSpot(bounds, from, Math.random)
      expect(p.x).toBeGreaterThanOrEqual(bounds.x)
      expect(p.x).toBeLessThanOrEqual(bounds.x + bounds.w)
      expect(p.y).toBeGreaterThanOrEqual(bounds.y)
      expect(p.y).toBeLessThanOrEqual(bounds.y + bounds.h)
      expect(Math.abs(p.x - from.x)).toBeGreaterThanOrEqual(120)
    }
  })
  it('flieht zur weiter entfernten Seite', () => {
    expect(fleeSpot(bounds, { x: 50, y: 250 }, () => 0.5).x).toBeGreaterThan(50)
    expect(fleeSpot(bounds, { x: 590, y: 250 }, () => 0.5).x).toBeLessThan(590)
  })
})
