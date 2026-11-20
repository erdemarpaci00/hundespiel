import { describe, expect, it } from 'vitest'
import { emoteFor } from '../src/dog/emoteChoice'

describe('emoteFor', () => {
  it('Hunger, Traurigkeit und Muedigkeit gehen vor jedem Wunsch', () => {
    expect(emoteFor('hungry', 'ball')).toBe('hungry')
    expect(emoteFor('sad', 'pet')).toBe('sad')
    expect(emoteFor('tired', 'brush')).toBe('tired')
  })
  it('zeigt den Wunsch, wenn es dem Hund sonst gut geht', () => {
    expect(emoteFor('ok', 'ball')).toBe('wish-ball')
    expect(emoteFor('happy', 'brush')).toBe('wish-brush')
    expect(emoteFor('ok', 'pet')).toBe('wish-pet')
  })
  it('zeigt nichts ohne Beduerfnis und ohne Wunsch', () => {
    expect(emoteFor('happy', null)).toBeNull()
  })
})
