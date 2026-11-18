import { describe, expect, it } from 'vitest'
import { MAX_POOPS, wantsPoop } from '../src/garden/poop'

describe('poop', () => {
  it('hoechstens sechs Haufen', () => {
    expect(wantsPoop(() => 0, true, MAX_POOPS)).toBe(false)
    expect(wantsPoop(() => 0, true, 0)).toBe(true)
    expect(wantsPoop(() => 0, false, 0)).toBe(false)
    expect(wantsPoop(() => 0.9, true, 0)).toBe(false)
  })
})
