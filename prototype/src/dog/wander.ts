import type { Rng } from '../util/rng'

export interface Vec { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

export function nextTarget(bounds: Rect, current: Vec, maxStep: number, rng: Rng): Vec {
  const angle = rng() * Math.PI * 2
  const dist = rng() * maxStep
  const x = clamp(current.x + Math.cos(angle) * dist, bounds.x, bounds.x + bounds.w)
  const y = clamp(current.y + Math.sin(angle) * dist, bounds.y, bounds.y + bounds.h)
  return { x, y }
}

// speed in Pixel pro Millisekunde
export function stepToward(pos: Vec, target: Vec, speed: number, dtMs: number): Vec {
  const dx = target.x - pos.x
  const dy = target.y - pos.y
  const dist = Math.hypot(dx, dy)
  const move = speed * dtMs
  if (dist === 0 || move <= 0) return { x: pos.x, y: pos.y }
  if (move >= dist) return { x: target.x, y: target.y }
  return { x: pos.x + (dx / dist) * move, y: pos.y + (dy / dist) * move }
}
