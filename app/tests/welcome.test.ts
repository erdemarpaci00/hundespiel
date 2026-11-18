import { describe, expect, it } from 'vitest'
import { shouldWelcome, WELCOME_AFTER_MS } from '../src/garden/welcome'

describe('welcome', () => {
  it('kein Gruss beim ersten Besuch oder kurz danach', () => {
    expect(shouldWelcome(null, 1_000_000)).toBe(false)
    expect(shouldWelcome(1_000_000, 1_000_000 + WELCOME_AFTER_MS - 1)).toBe(false)
  })
  it('Gruss nach mindestens zwei Stunden', () => {
    expect(shouldWelcome(1_000_000, 1_000_000 + WELCOME_AFTER_MS)).toBe(true)
  })
})
