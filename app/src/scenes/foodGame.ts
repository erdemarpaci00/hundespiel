import Phaser from 'phaser'
import { cue } from '../feedback'
import { GARDEN_BOUNDS } from '../garden'
import type { DogRecord } from '../dogRepo'
import type { LivingDog } from '../dog/livingDog'

interface Entry { record: DogRecord; dog: LivingDog }
interface Bucket { x: number; y: number; left: number; gfx: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text }

export const BUCKET_FULL = 100

// Was der Futtereimer vom Garten braucht: Hunde, Hunger und Rueckmeldungen.
export interface FoodContext {
  scene: Phaser.Scene
  entries(): Entry[]
  hunger(e: Entry): number
  careBusy(): boolean
  feed(dogId: string): Promise<void>
  toast(text: string): void
}

// Futtereimer im Garten: hinstellen, die hungrigen Hunde kommen und fressen in Happen.
export class FoodGame {
  food: Bucket | null = null

  constructor(private ctx: FoodContext) {}

  reset(): void { this.food = null }

  // Futtereimer: 100 % Inhalt, jeder Hund frisst in kleinen Happen, bis er satt ist. Grosse Esser nehmen mehr, der Pegel sinkt stetig.
  private draw(b: Bucket): void {
    const { x, y, left, gfx } = b
    gfx.clear()
    gfx.fillStyle(0x000000, 0.2).fillEllipse(x, y + 1, 36, 9)
    const H = 24, TOP = 15, BOT = 11
    const frac = Math.max(0, left) / BUCKET_FULL
    if (frac > 0) {
      const h = H * frac
      const wTop = BOT + (TOP - BOT) * (h / H)
      gfx.fillStyle(0x8a5a2b, 1).fillTriangle(x - BOT, y, x + BOT, y, x + wTop, y - h).fillTriangle(x - BOT, y, x + wTop, y - h, x - wTop, y - h)
      gfx.fillStyle(0xb07a3f, 1)
      for (let i = 0; i < 7; i++) gfx.fillCircle(x - wTop + 3 + ((i * 7) % Math.max(4, wTop * 2 - 6)), y - h + 1.5 + (i % 2), 1.6)
    }
    gfx.fillStyle(0xa9b4c2, 0.55).fillTriangle(x - BOT, y, x + BOT, y, x + TOP, y - H).fillTriangle(x - BOT, y, x + TOP, y - H, x - TOP, y - H)
    gfx.lineStyle(1.4, 0x56677a, 1).lineBetween(x - TOP, y - H, x - BOT, y).lineBetween(x - BOT, y, x + BOT, y).lineBetween(x + BOT, y, x + TOP, y - H)
    gfx.fillStyle(0x56677a, 1).fillRect(x - TOP - 1, y - H - 1.5, TOP * 2 + 2, 2.5)
    b.label.setText(`${Math.round(frac * 100)}%`).setPosition(x, y - H - 4)
  }

  throwAt(wx: number, wy: number): void {
    if (this.food) { this.food.gfx.destroy(); this.food.label.destroy(); this.food = null }
    const x = Math.min(GARDEN_BOUNDS.x + GARDEN_BOUNDS.w, Math.max(GARDEN_BOUNDS.x, wx))
    const y = Math.min(GARDEN_BOUNDS.y + GARDEN_BOUNDS.h, Math.max(GARDEN_BOUNDS.y, wy))
    const eager = this.ctx.entries().filter((e) => !e.dog.sleeping && this.ctx.hunger(e) < 95)
    if (eager.length === 0) { this.ctx.toast('Gerade hat niemand Hunger'); return }
    const gfx = this.ctx.scene.add.graphics().setDepth(y + 12)
    const label = this.ctx.scene.add.text(x, y - 28, '', { fontSize: '10px', color: '#ffffff', stroke: '#2b2b2b', strokeThickness: 3, resolution: 3, fontFamily: 'Arial, Helvetica, sans-serif' }).setOrigin(0.5, 1).setDepth(5000)
    const bucket = { x, y, left: BUCKET_FULL, gfx, label }
    this.food = bucket
    this.draw(bucket)
    const gone = (): void => { gfx.destroy(); label.destroy(); if (this.food === bucket) this.food = null }
    eager.forEach((e, i) => {
      const appetite = Math.min(1, Math.max(0, e.record.personality.appetite))
      const want = 14 + appetite * 36
      const bite = 2.5 + appetite * 3
      const gap = 620 - appetite * 260
      let ate = 0
      const finish = (): void => {
        e.dog.cancelChase()
        if (ate >= want * 0.5) {
          const feedWhenFree = (n: number): void => { if (this.ctx.careBusy() && n < 12) this.ctx.scene.time.delayedCall(500, () => feedWhenFree(n + 1)); else void this.ctx.feed(e.record.id) }
          feedWhenFree(0)
        } else this.ctx.toast(`${e.record.name} hat kaum etwas bekommen, der Eimer war schon leer`)
      }
      const chew = (): void => {
        if (this.food !== bucket || bucket.left <= 0 || ate >= want) { finish(); return }
        const take = Math.min(bucket.left, bite)
        bucket.left -= take
        ate += take
        this.draw(bucket)
        cue('munch')
        e.dog.eat(gap + 200)
        if (bucket.left <= 0) {
          this.ctx.scene.time.delayedCall(900, gone)
          this.ctx.toast('Der Eimer ist leer, stell einen neuen hin, wenn noch jemand Hunger hat')
        }
        this.ctx.scene.time.delayedCall(gap, chew)
      }
      e.dog.goTo({ x: x + (i - (eager.length - 1) / 2) * 18, y: y + 8 }, () => {
        if (this.food !== bucket || bucket.left <= 0 || this.ctx.hunger(e) >= 95) return
        e.dog.lookAt(x)
        chew()
      })
    })
    this.ctx.scene.time.delayedCall(90000, () => { if (this.food === bucket) { gone(); for (const o of eager) o.dog.cancelChase() } })
  }
}
