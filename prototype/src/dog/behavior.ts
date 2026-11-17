import type { Rng } from '../util/rng'

export interface Personality {
  energy: number
  courage: number
  affection: number
  learning: number
  appetite: number
}

export type Behavior = 'wander' | 'sniff' | 'sit' | 'sleep'

const MIN_WEIGHT = 0.1

export function randomPersonality(rng: Rng): Personality {
  return { energy: rng(), courage: rng(), affection: rng(), learning: rng(), appetite: rng() }
}

function weights(p: Personality): Record<Behavior, number> {
  return {
    wander: MIN_WEIGHT + 3 * p.energy,
    sleep: MIN_WEIGHT + 3 * (1 - p.energy),
    sniff: MIN_WEIGHT + 1 + p.appetite,
    sit: MIN_WEIGHT + 1 + 2 * (1 - p.courage),
  }
}

export function pickBehavior(p: Personality, rng: Rng): Behavior {
  const w = weights(p)
  const order: Behavior[] = ['wander', 'sniff', 'sit', 'sleep']
  const total = order.reduce((s, b) => s + w[b], 0)
  let r = rng() * total
  for (const b of order) {
    r -= w[b]
    if (r < 0) return b
  }
  return 'sit'
}

const BASE_MS: Record<Behavior, number> = { wander: 4000, sniff: 2500, sit: 3500, sleep: 9000 }

export function behaviorDuration(b: Behavior, _p: Personality, rng: Rng): number {
  return BASE_MS[b] * (0.6 + 0.8 * rng())
}
