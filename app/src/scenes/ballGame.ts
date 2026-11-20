import Phaser from 'phaser'
import { cue } from '../feedback'
import { burst } from './fx'
import { GARDEN_BOUNDS } from '../garden'
import { PLAY_MIN_ENERGY } from '../dog/needs'
import { playWithDog, type DogRecord } from '../dogRepo'
import type { LivingDog } from '../dog/livingDog'
import { mouthOf } from './duelFx'

interface Entry { record: DogRecord; dog: LivingDog }
interface BallState { g: Phaser.GameObjects.Graphics; x: number; y: number; flying: boolean; carrier: Entry | null }

// Was der Ball vom Garten braucht: Hunde, Zustand und Rueckmeldungen.
export interface BallContext {
  scene: Phaser.Scene
  entries(): Entry[]
  busy(): boolean
  energy(e: Entry): number
  toast(text: string): void
  refresh(): void
  reload(): Promise<void>
  fulfill(dogId: string, kind: 'ball'): void
}

// Ball im Garten: werfen, holen, tragen, fallen lassen, und von allein spielen.
export class BallGame {
  ball: BallState | null = null
  constructor(private ctx: BallContext) {}

  // Wurf des Partners: nur zeigen, nicht nochmal als Spielen speichern.
  private remote = false
  onThrow: ((x: number, y: number) => void) | null = null

  reset(): void { this.ball = null }

  spawn(x: number, y: number): void {
    const g = this.ctx.scene.add.graphics()
    g.fillStyle(0xc9a227, 1).fillCircle(0, 0, 3.5).fillStyle(0xffffff, 1).fillRect(-3.5, -0.5, 7, 1)
    g.setPosition(x, y).setDepth(y)
    this.ball = { g, x, y, flying: false, carrier: null }
  }

  private randomSpot(): { x: number; y: number } {
    return { x: GARDEN_BOUNDS.x + 20 + Math.random() * (GARDEN_BOUNDS.w - 40), y: GARDEN_BOUNDS.y + 20 + Math.random() * (GARDEN_BOUNDS.h - 40) }
  }

  update(): void {
    const b = this.ball
    if (!b || !b.carrier) return
    if (b.carrier.dog.sleeping) { this.dropBall(b.carrier, false); return }
    const m = mouthOf(b.carrier)
    b.x = m.x
    b.y = m.y
    b.g.setPosition(m.x, m.y).setDepth(b.carrier.dog.y + 1)
  }

  // Ball werfen: alle wachen, nicht zu muede Hunde rennen los, der schnellste nimmt ihn ins Maul und bringt ihn zurueck.
  throwAt(wx: number, wy: number, remote = false): void {
    if (this.ctx.busy()) return
    if (this.ball?.flying) return
    this.remote = remote
    if (!this.ball) this.spawn(320, 292)
    const b = this.ball!
    if (b.flying) return
    if (!remote) this.onThrow?.(wx, wy)
    const t = { x: Math.min(GARDEN_BOUNDS.x + GARDEN_BOUNDS.w, Math.max(GARDEN_BOUNDS.x, wx)), y: Math.min(GARDEN_BOUNDS.y + GARDEN_BOUNDS.h, Math.max(GARDEN_BOUNDS.y, wy)) }
    b.carrier = null
    for (const e of this.ctx.entries()) e.dog.cancelChase()
    const runners = this.ctx.entries().filter((e) => !e.dog.sleeping && !e.dog.busyMeeting && this.ctx.energy(e) >= PLAY_MIN_ENERGY)
    const from = { x: 320, y: 292 }
    b.flying = true
    this.ctx.scene.tweens.addCounter({
      from: 0, to: 1, duration: 650,
      onUpdate: (tw) => {
        const v = tw.getValue() ?? 0
        b.x = from.x + (t.x - from.x) * v
        b.y = from.y + (t.y - from.y) * v
        b.g.setPosition(b.x, b.y - Math.sin(v * Math.PI) * 60).setDepth(3000)
      },
      onComplete: () => {
        b.g.setPosition(t.x, t.y).setDepth(t.y)
        burst(this.ctx.scene, t.x, t.y, 'dust', 5)
        cue('soft')
        // Zwei kleine Huepfer nach der Landung, dann liegt er still.
        this.ctx.scene.tweens.addCounter({ from: 0, to: 1, duration: 420, onUpdate: (tw) => {
          const v = tw.getValue() ?? 0
          b.g.setY(t.y - Math.abs(Math.sin(v * Math.PI * 2)) * 9 * (1 - v))
        }, onComplete: () => { b.flying = false; b.g.setPosition(t.x, t.y) } })
      },
    })
    if (runners.length === 0) { this.ctx.toast('Gerade hat niemand Lust auf den Ball'); return }
    for (const e of runners) e.dog.goTo(t, () => this.reachBall(e, runners))
  }

  private reachBall(e: Entry, runners: Entry[]): void {
    const b = this.ball
    if (!b || b.carrier) return
    if (b.flying) { e.dog.hold(300); this.ctx.scene.time.delayedCall(150, () => this.reachBall(e, runners)); return }
    b.carrier = e
    // Die anderen jagen dem Ballträger hinterher.
    const chase = this.ctx.scene.time.addEvent({ delay: 900, loop: true, callback: () => {
      if (this.ball?.carrier !== e) { chase.remove(false); return }
      for (const o of runners) if (o !== e && !o.dog.sleeping) o.dog.goTo({ x: e.dog.x - e.dog.facing * 28 + (Math.random() - 0.5) * 20, y: e.dog.y + (Math.random() - 0.5) * 14 }, () => undefined)
    } })
    for (const o of runners) if (o !== e) o.dog.cancelChase()
    const back = { x: 320 + (Math.random() - 0.5) * 90, y: GARDEN_BOUNDS.y + GARDEN_BOUNDS.h - 6 - Math.random() * 14 }
    e.dog.goTo(back, () => this.dropBall(e, true))
    this.ctx.scene.time.delayedCall(20000, () => { if (this.ball?.carrier === e) this.dropBall(e, false) })
  }

  // Ball fallen lassen mit kleinem Hopser; beim Zurueckbringen zaehlt es als Spielen.
  private dropBall(e: Entry, fetched: boolean): void {
    const b = this.ball
    if (!b || b.carrier !== e) return
    b.carrier = null
    const x0 = b.x
    const y0 = b.y
    const x1 = Math.min(GARDEN_BOUNDS.x + GARDEN_BOUNDS.w, Math.max(GARDEN_BOUNDS.x, x0 + e.dog.facing * (8 + Math.random() * 18)))
    const y1 = Math.min(GARDEN_BOUNDS.y + GARDEN_BOUNDS.h, Math.max(GARDEN_BOUNDS.y, e.dog.y + (Math.random() - 0.5) * 8))
    b.flying = true
    this.ctx.scene.tweens.addCounter({
      from: 0, to: 1, duration: 380,
      onUpdate: (tw) => {
        const v = tw.getValue() ?? 0
        b.x = x0 + (x1 - x0) * v
        b.y = y0 + (y1 - y0) * v
        b.g.setPosition(b.x, b.y - Math.sin(v * Math.PI) * 14).setDepth(3000)
      },
      onComplete: () => { b.flying = false; b.g.setPosition(x1, y1).setDepth(y1) },
    })
    if (!fetched) return
    e.dog.cheer(1500)
    cue('good')
    if (this.remote) { this.remote = false; return }
    this.ctx.toast(`${e.record.name} bringt den Ball zurück`)
    this.ctx.fulfill(e.record.id, 'ball')
    void playWithDog(e.record).then(() => { this.ctx.refresh(); return this.ctx.reload() }).catch((err) => this.ctx.toast(err instanceof Error ? err.message : 'Etwas ist schiefgelaufen, bitte nochmal versuchen'))
  }

  // Von allein: ein Hund holt den Ball, traegt ihn herum, laesst ihn fallen, der naechste schnappt ihn sich.
  ambient(): void {
    const b = this.ball
    if (!b || b.flying || b.carrier || this.ctx.busy() || Math.random() > 0.6) return
    const pool = this.ctx.entries().filter((e) => !e.dog.sleeping && !e.dog.busyMeeting)
    if (pool.length === 0) return
    this.ambientFetch(pool[Math.floor(Math.random() * pool.length)], 0.6)
  }

  private ambientFetch(e: Entry, chain: number): void {
    const b = this.ball
    if (!b || b.carrier || b.flying || e.dog.sleeping) return
    e.dog.goTo({ x: b.x, y: b.y }, () => {
      const bb = this.ball
      if (!bb || bb.carrier || bb.flying) return
      bb.carrier = e
      e.dog.goTo(this.randomSpot(), () => {
        this.dropBall(e, false)
        const others = this.ctx.entries().filter((o) => o !== e && !o.dog.sleeping && !o.dog.busyMeeting)
        if (others.length > 0 && Math.random() < chain) this.ctx.scene.time.delayedCall(700, () => this.ambientFetch(others[Math.floor(Math.random() * others.length)], chain * 0.6))
      })
      this.ctx.scene.time.delayedCall(15000, () => { if (this.ball?.carrier === e) this.dropBall(e, false) })
    })
  }
}
