import Phaser from 'phaser'
import { clampDelta, type Rng } from '../util/rng'
import { behaviorDuration, pickBehavior, type Behavior, type Personality } from './behavior'
import { DogSprite, type Feeling, type Pose } from './dogSprite'
import type { DogLook } from './look'
import { nextTarget, stepToward, type Rect, type Vec } from './wander'

export type Emote = 'hungry' | 'sad' | 'wish-ball' | 'wish-brush' | 'wish-pet'

const POSE: Record<Behavior, Pose> = { wander: 'walk', sniff: 'sniff', sit: 'sit', sleep: 'sleep' }
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
  // Geweckte Hunde bleiben bis zu diesem Zeitpunkt wach, auch ueber Szenenwechsel hinweg.
  static awakeUntil = new Map<string, number>()

  private readonly sprite: DogSprite
  private readonly label: Phaser.GameObjects.Text
  private readonly emoteGfx: Phaser.GameObjects.Graphics
  private emote: Emote | null = null
  private shown: Emote | 'love' | null = null
  private loveUntil = 0
  private pulse = 0
  private pos: Vec
  private target: Vec
  private behavior: Behavior = 'sit'
  private remainingMs = 0
  private caption: string
  private resting = false
  private nightWanted = false
  private key: string | null = null
  private chase: (() => void) | null = null
  private size = 1

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
    this.emoteGfx = scene.add.graphics().setVisible(false)
    this.next()
  }

  private air = 0

  // Im Wettkampf oder Spiel wuerfelt der Hund kein Einschlafen aus.
  focused = false

  private next(): void {
    let b = this.resting ? 'sleep' : pickBehavior(this.personality, this.rng)
    for (let i = 0; i < 8 && this.focused && !this.resting && b === 'sleep'; i++) b = pickBehavior(this.personality, this.rng)
    this.behavior = b
    this.remainingMs = behaviorDuration(this.behavior, this.personality, this.rng)
    this.sprite.setPose(POSE[this.behavior])
    if (this.behavior === 'wander') this.target = nextTarget(this.bounds, this.pos, 140, this.rng)
  }

  update(dtMs: number): void {
    this.applyRest()
    const dt = clampDelta(dtMs)
    this.remainingMs -= dt
    if (this.behavior === 'wander') {
      const speed = (0.03 + 0.04 * this.personality.energy) * (this.chase ? 2.2 : 1)
      const dx = this.target.x - this.pos.x
      if (Math.abs(dx) > 1) this.sprite.face(dx > 0 ? 1 : -1)
      this.pos = stepToward(this.pos, this.target, speed, dt)
      const arrived = this.pos.x === this.target.x && this.pos.y === this.target.y
      if (arrived && this.chase) {
        const cb = this.chase
        this.chase = null
        this.next()
        cb()
      } else if (arrived && this.remainingMs > 0) this.target = nextTarget(this.bounds, this.pos, 140, this.rng)
    }
    if (this.remainingMs <= 0) this.next()
    this.sprite.container.setPosition(this.pos.x, this.pos.y - this.air).setDepth(this.pos.y)
    this.sprite.update(dt)
    this.tickBliss(dt)
    this.pulse += dt
    const want = this.loveUntil > Date.now() ? 'love' : this.emote
    if (want !== this.shown) this.drawEmote(want)
    this.emoteGfx.setPosition(this.pos.x, this.pos.y - 42 - 92 * this.size + Math.sin(this.pulse / 300) * 2).setDepth(1001).setVisible(want !== null && !this.resting)
    this.label
      .setPosition(this.pos.x, this.pos.y - 92 * this.size)
      .setDepth(1000)
      .setText(this.caption)
  }

  // Denkblase ueber dem Kopf: Knochen bei Hunger, Traene bei Traurigkeit, Herz bei Begegnung.
  setEmote(kind: Emote | null): void {
    this.emote = kind
  }

  private drawEmote(kind: Emote | 'love' | null): void {
    this.shown = kind
    const g = this.emoteGfx.clear()
    if (!kind) return
    g.fillStyle(0xffffff, 0.95).fillRoundedRect(-13, -11, 26, 22, 8).fillCircle(-4, 17, 3).fillCircle(-8, 23, 2)
    if (kind === 'hungry') {
      g.fillStyle(0xb98a5a).fillRect(-7, -2, 14, 4).fillCircle(-8, -2, 3).fillCircle(-8, 2, 3).fillCircle(8, -2, 3).fillCircle(8, 2, 3)
    } else if (kind === 'wish-ball') {
      g.fillStyle(0xc9a227).fillCircle(0, -1, 6).fillStyle(0xffffff).fillRect(-6, -1.5, 12, 1.5)
    } else if (kind === 'wish-brush') {
      g.fillStyle(0x8a5a2b).fillRoundedRect(-7, -4, 14, 5, 2).fillStyle(0xe8c07a).fillRect(-6, 1, 2, 4).fillRect(-2, 1, 2, 4).fillRect(2, 1, 2, 4).fillRect(5, 1, 2, 4)
    } else if (kind === 'wish-pet') {
      g.lineStyle(2, 0xe0527a).strokeCircle(-3.5, -2, 4).strokeCircle(3.5, -2, 4).fillStyle(0xffd0dc).fillCircle(-3.5, -2, 3).fillCircle(3.5, -2, 3).fillTriangle(-7, 0, 7, 0, 0, 7)
    } else if (kind === 'love') {
      g.fillStyle(0xe0527a).fillCircle(-3.5, -2, 4.5).fillCircle(3.5, -2, 4.5).fillTriangle(-8, 0, 8, 0, 0, 8)
    } else {
      g.fillStyle(0x4a90d9).fillTriangle(0, -7, -4, 1, 4, 1).fillCircle(0, 2, 4)
    }
  }

  // Zwei Hunde sind sich begegnet: kurz stehen bleiben, zueinander schauen, Herz zeigen.
  meet(otherX: number, ms: number): void {
    if (this.resting || this.chase) return
    this.loveUntil = Date.now() + ms
    this.behavior = 'sit'
    this.remainingMs = ms
    this.sprite.setPose('sit')
    this.sprite.face(otherX >= this.pos.x ? 1 : -1)
  }

  // Der Hund dreht den Kopf zum Finger, wenn er nicht gerade laeuft oder schlaeft.
  lookAt(x: number): void {
    if (this.resting || this.chase || this.behavior === 'wander' || this.behavior === 'sleep') return
    this.sprite.face(x >= this.pos.x ? 1 : -1)
  }

  // Bleibt beim Streicheln kurz sitzen, statt weiterzulaufen.
  hold(ms: number): void {
    if (this.resting || this.chase || this.behavior === 'sit') { if (this.behavior === 'sit') this.remainingMs = Math.max(this.remainingMs, ms); return }
    this.behavior = 'sit'
    this.remainingMs = ms
    this.sprite.setPose('sit')
  }

  // Freude zeigen (Herz ueber dem Kopf), z.B. bei der Begruessung nach langer Abwesenheit.
  cheer(ms: number): void {
    if (this.resting) return
    this.loveUntil = Date.now() + ms
    this.behavior = 'sit'
    this.remainingMs = ms
    this.sprite.setPose('sit')
  }

  get busyMeeting(): boolean {
    return this.loveUntil > Date.now()
  }

  // Welpen sind kleiner, Name und Denkblase sitzen entsprechend tiefer.
  setSize(scale: number): void {
    this.size = scale
    this.sprite.setAge(scale)
  }

  // Zielstrebig zu einem Punkt laufen (z.B. zum geworfenen Futter), am Ziel wird onArrive gerufen.
  goTo(target: Vec, onArrive: () => void): void {
    if (this.resting) return
    this.chase = onArrive
    this.behavior = 'wander'
    this.target = { ...target }
    this.remainingMs = 30000
    this.sprite.setPose('walk')
  }

  cancelChase(): void {
    if (!this.chase) return
    this.chase = null
    this.next()
  }

  // Hoehe ueber dem Boden in Welt-Einheiten (Sprung), nur die Zeichnung hebt ab.
  setAir(h: number): void { this.air = h }
  get airNow(): number { return this.air }

  get scale(): number { return this.size }
  get facing(): -1 | 1 { return this.sprite.getDir() }
  get x(): number { return this.pos.x }
  get y(): number { return this.pos.y }

  onTap(cb: () => void): void {
    this.sprite.container.setInteractive(new Phaser.Geom.Rectangle(-55, -80, 110, 100), Phaser.Geom.Rectangle.Contains)
    this.sprite.container.on('pointerdown', cb)
  }

  // Nachts schlaeft der Hund und bleibt liegen, ausser er wurde geweckt.
  setResting(on: boolean): void {
    this.nightWanted = on
    this.applyRest()
  }

  get dogKey(): string | null {
    return this.key
  }

  setKey(key: string): void {
    this.key = key
  }

  get sleeping(): boolean {
    return this.resting
  }

  wake(ms: number): void {
    if (this.key) LivingDog.awakeUntil.set(this.key, Date.now() + ms)
    this.nightWanted = false
    this.applyRest()
  }

  private applyRest(): void {
    const awake = this.key !== null && (LivingDog.awakeUntil.get(this.key) ?? 0) > Date.now()
    const want = this.nightWanted && !awake
    if (want === this.resting) return
    this.resting = want
    if (want) this.chase = null
    this.next()
  }

  // Stimmung am Koerper; beim Streicheln kurz genussvoll (Augen zu, wilder Schwanz).
  private baseFeeling: Feeling = 'ok'
  private blissMs = 0

  setFeeling(f: Feeling): void {
    this.baseFeeling = f
    if (this.blissMs <= 0) this.sprite.setFeeling(f)
  }

  setCollar(color: number | null): void {
    this.sprite.setCollar(color)
  }

  setMedal(color: number | null): void {
    this.sprite.setMedal(color)
  }

  bliss(ms: number): void {
    this.blissMs = ms
    this.sprite.setFeeling('blissful')
  }

  private tickBliss(dt: number): void {
    if (this.blissMs <= 0) return
    this.blissMs -= dt
    if (this.blissMs <= 0) this.sprite.setFeeling(this.baseFeeling)
  }

  setPersonality(p: Personality): void {
    this.personality = p
  }

  setCaption(text: string): void {
    this.caption = text
  }

  destroy(): void {
    this.emoteGfx.destroy()
    this.sprite.destroy()
    this.label.destroy()
  }
}
