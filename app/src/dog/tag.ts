import type { Rect, Vec } from './wander'

// Fluchtziel beim Fangspiel: auf der weiter entfernten Gartenseite, mindestens 120 Pixel vom Verfolger weg.
export function fleeSpot(bounds: Rect, from: Vec, rng: () => number): Vec {
  const left = from.x - bounds.x
  const right = bounds.x + bounds.w - from.x
  const dir = right >= left ? 1 : -1
  const room = Math.max(left, right)
  const dist = Math.min(room, 120 + rng() * Math.max(0, room - 120))
  return { x: from.x + dir * dist, y: bounds.y + rng() * bounds.h }
}

// Wahrscheinlichkeit fuer ein Fangspiel nach einer Begegnung: Freunde (viele Begegnungen) spielen oefter.
export function tagChance(meetings: number): number {
  if (meetings >= 10) return 0.8
  if (meetings >= 3) return 0.5
  return 0.3
}
