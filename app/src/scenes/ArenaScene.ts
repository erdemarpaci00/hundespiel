import Phaser from 'phaser'
import { fadeTo } from './transition'
import { DogSprite } from '../dog/dogSprite'
import { STAT_KEYS, STAT_LABEL, statValue, type StatKey } from '../dog/stats'
import { applyElapsed } from '../dog/needs'
import { catchChance, moodOf, refuseChance, playRound, rivalForm, summarize, type League, type Round } from '../dog/contest'
import { enterContest, type DogRecord } from '../dogRepo'
import { parseTimestamp } from '../time'
import { cue } from '../feedback'

interface ArenaData { record: DogRecord; league: League }

const RIVALS = ['Blitz', 'Fiona', 'Max']
const FONT = 'Arial, Helvetica, sans-serif'

// Turnier-Arena: eigene Buehne mit Anzeigetafel. Die Gegner-Punkte stehen vor jedem Wurf fest, man sieht, was zu toppen ist.
export class ArenaScene extends Phaser.Scene {
  private record!: DogRecord
  private league!: League
  private dog!: DogSprite
  private board!: Phaser.GameObjects.Text
  private banner!: Phaser.GameObjects.Text
  private rivalTotals = [0, 0, 0]
  private myTotal = 0
  private rows: string[][] = [[], [], []]
  private mine: string[] = []

  constructor() {
    super('arena')
  }

  init(data: ArenaData): void {
    this.record = data.record
    this.league = data.league
    this.rivalTotals = [0, 0, 0]
    this.myTotal = 0
    this.rows = [[], [], []]
    this.mine = []
  }

  create(): void {
    this.cameras.main.fadeIn(260, 0, 0, 0)
    this.cameras.main.setZoom(3).centerOn(320, 180)
    this.drawStage()
    this.dog = new DogSprite(this, this.record.look, 140, 285)
    this.dog.setPose('sit')
    this.dog.container.setDepth(285)
    this.board = this.add.text(112, 10, '', { fontSize: '9px', color: '#ffffff', backgroundColor: 'rgba(20,30,50,0.85)', padding: { x: 7, y: 5 }, lineSpacing: 3, resolution: 3, fontFamily: FONT }).setDepth(4000)
    this.banner = this.add.text(320, 140, '', { fontSize: '14px', color: '#ffffff', stroke: '#1d2b44', strokeThickness: 4, resolution: 3, fontFamily: FONT, align: 'center' }).setOrigin(0.5).setDepth(4000)
    this.refreshBoard()
    void this.run()
  }

  update(_t: number, dt: number): void {
    this.dog?.update(dt)
  }

  private wait(ms: number): Promise<void> {
    return new Promise((res) => this.time.delayedCall(ms, () => res()))
  }

  private drawStage(): void {
    const g = this.add.graphics()
    g.fillGradientStyle(0x4aa3df, 0x4aa3df, 0xbfe3f7, 0xbfe3f7, 1).fillRect(0, 0, 640, 150)
    g.fillStyle(0x3f8f3a, 1).fillRect(0, 150, 640, 210)
    for (let i = 0; i < 8; i++) g.fillStyle(i % 2 ? 0x469a40 : 0x3a8535, 1).fillRect(0, 150 + i * 26, 640, 26)
    // Tribuene mit Wimpeln statt Zuschauern
    g.fillStyle(0x5a6b7d, 1).fillRect(0, 110, 640, 40)
    g.fillStyle(0x7a8ca0, 1).fillRect(0, 110, 640, 6)
    const cols = [0xe0527a, 0xf0c040, 0x4caf50, 0x2b6cb0, 0xff9a4d]
    for (let i = 0; i < 32; i++) g.fillStyle(cols[i % 5], 1).fillTriangle(10 + i * 20, 118, 24 + i * 20, 118, 17 + i * 20, 134)
    g.lineStyle(2, 0xffffff, 0.7).strokeRect(24, 170, 592, 170)
    g.fillStyle(0xffd700, 1).fillCircle(580, 200, 3).fillStyle(0xc0c0c0, 1).fillCircle(594, 200, 3).fillStyle(0xcd7f32, 1).fillCircle(608, 200, 3)
    g.fillStyle(0xe8453c, 1).fillCircle(50, 320, 0)
  }

  private refreshBoard(): void {
    const line = (name: string, total: number, rounds: string[], me = false): string => `${me ? '> ' : '  '}${name.padEnd(10, ' ')} ${rounds.map((r) => r.padStart(4, ' ')).join('')}  = ${String(Math.round(total)).padStart(3, ' ')}`
    const lines = [`${this.league.name}  -  ${this.record.name}`, ...RIVALS.map((n, i) => line(n, this.rivalTotals[i], this.rows[i])), line(this.record.name.slice(0, 9), this.myTotal, this.mine, true)]
    this.board.setText(lines.join('\n'))
  }

  private say(text: string, color = '#ffffff'): void {
    this.banner.setText(text).setColor(color)
  }

  // Zeiger pendelt ueber den Balken, Tipp wirft. 1 = perfekt in der Mitte.
  private timing(): Promise<number> {
    return new Promise((resolve) => {
      const cx = 320, cy = 322, w = 200
      const bar = this.add.graphics().setDepth(4000)
      bar.fillStyle(0x000000, 0.6).fillRoundedRect(cx - w / 2 - 6, cy - 12, w + 12, 24, 6)
      bar.fillStyle(0xe05555, 1).fillRect(cx - w / 2, cy - 5, w, 10)
      bar.fillStyle(0xf0c040, 1).fillRect(cx - w * 0.3, cy - 5, w * 0.6, 10)
      bar.fillStyle(0x4caf50, 1).fillRect(cx - w * 0.1, cy - 5, w * 0.2, 10)
      const cursor = this.add.rectangle(cx, cy, 3, 18, 0xffffff).setDepth(4001)
      const t0 = this.time.now
      const speed = 3.2 + Math.random() * 1.4
      const pos = (): number => 0.5 + 0.5 * Math.sin(((this.time.now - t0) / 1000) * speed - Math.PI / 2)
      const tick = this.time.addEvent({ delay: 16, loop: true, callback: () => cursor.setX(cx - w / 2 + pos() * w) })
      let done = false
      const finish = (q: number): void => {
        if (done) return
        done = true
        tick.remove(false)
        bar.destroy(); cursor.destroy()
        resolve(q)
      }
      this.time.delayedCall(300, () => { if (!done) this.input.once('pointerdown', () => finish(1 - Math.abs(pos() - 0.5) * 2)) })
      this.time.delayedCall(8000, () => finish(0.2))
    })
  }

  // Frisbee fliegt im Bogen, der Hund rennt unter die Flugbahn und faengt (oder springt daneben).
  private async flight(land: { x: number; y: number }, caught: boolean): Promise<void> {
    const from = { x: 40, y: 320 }
    const disc = this.add.graphics().setDepth(4000)
    disc.fillStyle(0xe8453c, 1).fillEllipse(0, 0, 14, 5.5).fillStyle(0xffffff, 1).fillEllipse(0, -0.8, 8, 2.4)
    const shadow = this.add.ellipse(from.x, from.y, 12, 4, 0x000000, 0.25).setDepth(1)
    const dur = 1500
    const place = (v: number): void => {
      const x = from.x + (land.x - from.x) * v
      const y = from.y + (land.y - from.y) * v
      disc.setPosition(x, y - Math.sin(v * Math.PI) * 110).setAngle(v * 1080)
      shadow.setPosition(x, y)
    }
    place(0)
    const dist = Math.hypot(land.x - this.dog.container.x, land.y - this.dog.container.y)
    this.dog.setPose('walk')
    this.dog.face(land.x > this.dog.container.x ? 1 : -1)
    const run = new Promise<void>((res) => this.tweens.add({ targets: this.dog.container, x: land.x, y: land.y, duration: Math.min(1800, 500 + dist * 4), ease: 'Sine.easeOut', onUpdate: () => this.dog.container.setDepth(this.dog.container.y), onComplete: () => res() }))
    const fly = new Promise<void>((res) => this.tweens.addCounter({ from: 0, to: 1, duration: dur, onUpdate: (tw) => place(tw.getValue() ?? 0), onComplete: () => res() }))
    await Promise.all([run, fly])
    shadow.destroy()
    if (caught) {
      this.tweens.add({ targets: disc, x: this.dog.container.x, y: this.dog.container.y - 20, duration: 160 })
      this.tweens.add({ targets: this.dog.container, y: land.y - 14, duration: 140, yoyo: true, ease: 'Quad.easeOut' })
      this.tweens.add({ targets: this.dog.container, scaleY: this.dog.container.scaleY * 1.12, duration: 120, yoyo: true })
      await this.wait(500)
      disc.destroy()
    } else {
      this.tweens.add({ targets: disc, x: land.x + 30, y: land.y + 8, alpha: 0.4, duration: 400 })
      await this.wait(700)
      disc.destroy()
    }
    this.dog.setPose('sit')
  }

  // Konfettiregen bei einem Sieg: bunte Plaettchen fallen mit leichtem Taumeln von oben.
  private confetti(): void {
    const cols = [0xff5d8f, 0xffd23f, 0x4caf50, 0x4aa3df, 0xb084f0, 0xff9a4d]
    for (let i = 0; i < 70; i++) {
      const r = this.add.rectangle(60 + Math.random() * 520, -10 - Math.random() * 60, 4 + Math.random() * 3, 2.5, cols[i % cols.length]).setDepth(4500).setAngle(Math.random() * 360)
      this.tweens.add({ targets: r, y: 330 + Math.random() * 20, x: r.x + (Math.random() - 0.5) * 90, angle: r.angle + 360 * (Math.random() > 0.5 ? 1 : -1), alpha: 0.2, duration: 1800 + Math.random() * 1600, delay: Math.random() * 700, ease: 'Sine.easeIn', onComplete: () => r.destroy() })
    }
    this.cameras.main.shake(180, 0.002)
  }

  // Der Hund bleibt sitzen, schaut dem Frisbee nach und waehlt lieber ein Nickerchen.
  private async refuse(land: { x: number; y: number }): Promise<void> {
    const disc = this.add.graphics().setDepth(4000)
    disc.fillStyle(0xe8453c, 1).fillEllipse(0, 0, 14, 5.5).fillStyle(0xffffff, 1).fillEllipse(0, -0.8, 8, 2.4)
    this.dog.face(land.x > this.dog.container.x ? 1 : -1)
    await new Promise<void>((res) => this.tweens.addCounter({ from: 0, to: 1, duration: 1500, onUpdate: (tw) => {
      const v = tw.getValue() ?? 0
      disc.setPosition(40 + (land.x - 40) * v, 320 + (land.y - 320) * v - Math.sin(v * Math.PI) * 110).setAngle(v * 1080)
    }, onComplete: () => res() }))
    this.dog.setPose('sleep')
    await this.wait(900)
    disc.destroy()
    this.dog.setPose('sit')
  }

  private async run(): Promise<void> {
    const rec = this.record
    const needs = applyElapsed(rec.needs, Date.now() - parseTimestamp(rec.needsUpdatedAt), rec.personality)
    const form = rivalForm(Math.random)
    const rounds: Round[] = []
    try {
      this.say(`${this.league.name}!\nIhr tretet gegen drei Hunde an`)
      await this.wait(1800)
      for (let i = 0; i < STAT_KEYS.length; i++) {
        const stat: StatKey = STAT_KEYS[i]
        const value = statValue(rec.look.breed, rec.training, stat)
        // Gegner werfen zuerst: ihre Punkte stehen an der Tafel, bevor man selbst dran ist.
        const base = playRound({ stat, value, league: this.league, form, happiness: needs.happiness, affection: rec.personality.affection, throwQuality: 0.5 }, Math.random)
        const top = base.rival
        const scores = [top, top - (3 + Math.random() * 14), top - Math.random() * 26].map((s) => Math.max(0, s))
        scores.forEach((s, k) => { this.rows[k].push(String(Math.round(s))); this.rivalTotals[k] += s })
        this.refreshBoard()
        this.say(`Runde ${i + 1} von ${STAT_KEYS.length}: ${STAT_LABEL[stat]}\nZu toppen: ${Math.round(top)} Punkte`)
        const q = await this.timing()
        const miss = (1 - q) * 70
        const ang = Math.random() * Math.PI * 2
        const land = {
          x: Math.min(590, Math.max(150, 380 + Math.cos(ang) * miss + (Math.random() - 0.5) * 120)),
          y: Math.min(330, Math.max(200, 265 + Math.sin(ang) * miss * 0.5)),
        }
        const round = playRound({ stat, value, league: this.league, form, happiness: needs.happiness, affection: rec.personality.affection, throwQuality: q }, Math.random)
        round.rival = top
        // Ungeuebte oder lustlose Hunde fangen nicht jeden Wurf; manchmal rennen sie gar nicht erst los.
        const gehorsam = statValue(rec.look.breed, rec.training, 'gehorsam')
        const mood = moodOf({ gehorsam, happiness: needs.happiness })
        const refuses = Math.random() < refuseChance(mood)
        const caught = !refuses && Math.random() < catchChance({ value, gehorsam, happiness: needs.happiness, q })
        if (!caught) round.dog = Math.max(0, round.dog - (refuses ? 30 : 18))
        round.won = round.dog > round.rival
        rounds.push(round)
        if (refuses) await this.refuse(land)
        else await this.flight(land, caught)
        this.mine.push(String(Math.round(round.dog)))
        this.myTotal += round.dog
        this.refreshBoard()
        cue(round.won ? 'good' : 'bad')
        if (caught) this.cameras.main.shake(110, 0.003); else this.cameras.main.shake(200, 0.005)
        this.say(refuses ? `${this.record.name} hat keine Lust` : caught ? (q > 0.8 ? 'Perfekter Wurf!' : 'Gefangen!') : 'Daneben, nicht gefangen', caught ? '#8dff8d' : '#ffb3b3')
        await this.wait(1500)
      }
      const result = summarize(this.league, rounds)
      const r = await enterContest(rec, this.league, result)
      cue(result.won ? 'win' : 'soft')
      this.say(result.won ? `Sieg in der ${this.league.name}!\n+${r.result.prize} Münzen` : `Nicht gewonnen\nTrostpreis +${r.result.prize} Münzen`, result.won ? '#ffe36b' : '#ffffff')
      if (result.won) this.confetti()
    } catch (err) {
      this.say(err instanceof Error ? err.message : 'Etwas ist schiefgelaufen, bitte nochmal versuchen', '#ffb3b3')
    }
    // Hund zur Seite, damit der Zurueck-Knopf frei bleibt
    this.dog.setPose('walk')
    this.dog.face(-1)
    await new Promise<void>((res) => this.tweens.add({ targets: this.dog.container, x: 130, y: 300, duration: 900, onUpdate: () => this.dog.container.setDepth(this.dog.container.y), onComplete: () => res() }))
    this.dog.setPose('sit')
    await this.wait(1600)
    const back = this.add.text(320, 250, 'Zurück in den Garten', { fontSize: '14px', color: '#ffffff', backgroundColor: '#2b6cb0', padding: { x: 12, y: 8 }, resolution: 3, fontFamily: FONT }).setOrigin(0.5).setDepth(4000).setInteractive({ useHandCursor: true })
    back.once('pointerdown', () => fadeTo(this, 'garden'))
  }
}
