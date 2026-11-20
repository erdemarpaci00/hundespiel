import type { Emote } from './livingDog'
import type { Mood } from './needs'

// Welche Sprechblase ein Hund zeigt: Beduerfnisse gehen vor Wuenschen.
// Reihenfolge: hungrig, traurig, muede, dann ein Wunsch (Ball, Buerste, Streicheln), sonst nichts.
export function emoteFor(mood: Mood, wish: 'ball' | 'brush' | 'pet' | null): Emote | null {
  if (mood === 'hungry') return 'hungry'
  if (mood === 'sad') return 'sad'
  if (mood === 'tired') return 'tired'
  return wish ? (`wish-${wish}` as const) : null
}
