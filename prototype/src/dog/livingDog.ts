import Phaser from 'phaser'
import { clampDelta, type Rng } from '../util/rng'
import { behaviorDuration, pickBehavior, type Behavior, type Personality } from './behavior'
import { DogSprite, type Pose } from './dogSprite'
import type { DogLook } from './look'
import { nextTarget, stepToward, type Rect, type Vec } from './wander'

const POSE: Record<Behavior, Pose> = { wander: 'walk', sniff: 'sniff', sit: 'sit', sleep: 'sleep' }
const NAME: Record<Behavior, string> = { wander: 'läuft', sniff: 'schnüffelt', sit: 'sitzt', sleep: 'schläft' }
const TRAITS: [keyof Personality, string, string][] = [
  ['energy', 'aufgeweckt', 'träge'],
  ['courage', 'mutig', 'schüchtern'],
  ['affection', 'anhänglich', 'zurückhaltend'],
  ['learning', 'gelehrig', 'stur'],
  ['appetite', 'verfressen', 'wählerisch'],
]

export function standoutTrait(p: Personality): string {
  let best = TRAITS[0], bestDev = -1
  for (const t of TRAITS) {
    const dev = Math.abs(p[t[0]] - 0.5)
    if (dev > bestDev) { best = t; bestDev = dev }
  }
  return p[best[0]] >= 0.5 ? best[1] : best[2]
}

export class LivingDog {
  private readonly sprite: DogSprite
  private readonly label: Phaser.GameObjects.Text
  private pos: Vec
  private target: Vec
  private behavior: Behavior = 'sit'
  private remainingMs = 0
  private caption: string

  constructor(
    scene: Phaser.Scene,
    look: DogLook,
    private personality: Personality,
    private readonly bounds: Rect,
    start: Vec,
    private readonly rng: Rng,
  ) {
    this.caption = standoutTrait(personality)
    this.pos = { ...start }
    this.target = { ...start }
    this.sprite = new DogSprite(scene, look, start.x, start.y)
    this.label = scene.add
      .text(start.x, start.y, '', { fontSize: '11px', color: '#ffffff', stroke: '#2b2b2b', strokeThickness: 3, resolution: 3, fontFamily: 'Arial, Helvetica, sans-serif' })
      .setOrigin(0.5, 1)
    this.next()
  }

  private next(): void {
    this.behavior = pickBehavior(this.personality, this.rng)
    this.remainingMs = behaviorDuration(this.behavior, this.personality, this.rng)
    this.sprite.setPose(POSE[this.behavior])
    if (this.behavior === 'wander') this.target = nextTarget(this.bounds, this.pos, 140, this.rng)
  }

  update(dtMs: number): void {
    const dt = clampDelta(dtMs)
    this.remainingMs -= dt
    if (this.behavior === 'wander') {
      const speed = 0.03 + 0.04 * this.personality.energy
      const dx = this.target.x - this.pos.x
      if (Math.abs(dx) > 1) this.sprite.face(dx > 0 ? 1 : -1)
      this.pos = stepToward(this.pos, this.target, speed, dt)
      const arrived = this.pos.x === this.target.x && this.pos.y === this.target.y
      if (arrived && this.remainingMs > 0) this.target = nextTarget(this.bounds, this.pos, 140, this.rng)
    }
    if (this.remainingMs <= 0) this.next()
    this.sprite.container.setPosition(this.pos.x, this.pos.y).setDepth(this.pos.y)
    this.sprite.update(dt)
    this.label
      .setPosition(this.pos.x, this.pos.y - 92)
      .setDepth(1000)
      .setText(`${this.caption}\n${NAME[this.behavior]}`)
  }

  setPersonality(p: Personality): void {
    this.personality = p
  }

  setCaption(text: string): void {
    this.caption = text
  }

  destroy(): void {
    this.sprite.destroy()
    this.label.destroy()
  }
}
