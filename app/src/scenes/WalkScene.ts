import Phaser from 'phaser'
import { fadeTo } from './transition'
import { BREEDS, breedById, rollBreedPuppy } from '../dog/breeds'
import { ageDays, ageStage } from '../dog/age'
import { parseTimestamp } from '../time'
import { LivingDog } from '../dog/livingDog'
import { findTreasure, loadDogs, playWithDog, recordMeeting, type DogRecord } from '../dogRepo'
import type { Session } from '../session'
import { isRestless } from '../nightlife'
import { createAtmosphere, type Atmosphere } from './atmosphere'
import { cue } from '../feedback'
import { createHud } from '../ui/hud'
import { mulberry32 } from '../util/rng'
import { openChoice } from '../ui/dogPanels'

const W = 2600
const LEASH = 100
// Beim Spaziergang wirken die Hunde durch die Kamera naeher, daher etwas kleiner gezeichnet.
const WALK_SCALE = 0.7
const HAND_SPEED = 0.15
const FONT = 'Arial, Helvetica, sans-serif'

interface Stranger { dog: LivingDog; name: string; cooldownUntil: number; x: number }
interface Spark { g: Phaser.GameObjects.Graphics; x: number; y: number; alive: boolean }

// Spaziergang als Route: Die Hand fuehrt die Hunde an der Leine ueber einen langen Parkweg.
// Unterwegs warten fremde Hunde und Funkelstellen, die Hunde ziehen von sich aus dorthin.
export class WalkScene extends Phaser.Scene {
  private hud!: ReturnType<typeof createHud>
  private atmosphere!: Atmosphere
  private own: LivingDog[] = []
  private records: DogRecord[] = []
  private names = new Map<LivingDog, string>()
  private strangers: Stranger[] = []
  private sparks: Spark[] = []
  private nightOwls = new Set<LivingDog>()
  private hand = { x: 110, y: 275 }
  private grip!: Phaser.GameObjects.Graphics
  private leash!: Phaser.GameObjects.Graphics
  private lastPullToast = 0
  private lastRedirect = 0
  private pairUntil = 0
  private camX = 320
  private endShown = false
  private meters!: Phaser.GameObjects.Text
  private minimap!: Phaser.GameObjects.Graphics
  private aim!: Phaser.GameObjects.Graphics
  private touch: { x: number; y: number } | null = null
  private moved = false
  private foundCount = 0
  private sniffCount = 0

  constructor() {
    super('walk')
  }

  create(): void {
    this.cameras.main.fadeIn(260, 0, 0, 0)
    const session = this.registry.get('session') as Session
    this.cameras.main.setZoom(3).centerOn(320, 180)
    this.own = []
    this.records = []
    this.names = new Map()
    this.strangers = []
    this.sparks = []
    this.nightOwls = new Set()
    this.hand = { x: 110, y: 275 }
    this.camX = 320
    this.endShown = false
    this.lastPullToast = 0
    this.touch = null
    this.moved = false
    this.foundCount = 0
    this.sniffCount = 0
    const backdrop = this.drawRoute()
    this.atmosphere = createAtmosphere(this, true, backdrop, () => new Date(), true)
    this.leash = this.add.graphics().setDepth(2999)
    this.grip = this.add.graphics().setDepth(3000)
    this.aim = this.add.graphics().setDepth(2998)
    this.minimap = this.add.graphics().setDepth(3500)
    // Zeiger direkt verfolgen: funktioniert mit Maus und Finger gleich (auch mit mehreren Beruehrungen)
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { this.touch = { x: p.worldX, y: p.worldY } })
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => { if (p.isDown) this.touch = { x: p.worldX, y: p.worldY } })
    this.input.on('pointerup', () => { this.touch = null })
    this.input.on('pointerupoutside', () => { this.touch = null })
    this.input.on('gameout', () => { this.touch = null })
    this.meters = this.add.text(0, 0, '', { fontSize: '11px', color: '#ffffff', stroke: '#2b2b2b', strokeThickness: 4, resolution: 3, fontFamily: FONT, fontStyle: 'bold' }).setOrigin(0.5, 0).setDepth(3501)
    this.hud = createHud({ householdId: session.householdId, getActivity: () => [], travel: (k) => fadeTo(this, k), current: 'walk' })
    document.getElementById('hud')?.classList.add('walk')
    this.events.once('shutdown', () => document.getElementById('hud')?.classList.remove('walk'))
    void this.populate(session)
  }

  private async populate(session: Session): Promise<void> {
    const rng = mulberry32(Date.now() & 0xffff)
    let own: Awaited<ReturnType<typeof loadDogs>> = []
    try { own = await loadDogs(session) } catch { this.hud.toast('Keine Verbindung, bitte Netz prüfen') }
    if (!this.scene.isActive('walk')) return
    own.forEach((r, i) => {
      const d = new LivingDog(this, r.look, r.personality, this.leashRect(), { x: this.hand.x - 20 - i * 30, y: 280 + (i % 2) * 20 }, Math.random)
      d.setCaption(r.name)
      d.setSize(ageStage(ageDays(parseTimestamp(r.createdAt), Date.now())).scale * WALK_SCALE)
      d.setKey(r.id)
      if (isRestless(r.id, r.personality, new Date())) d.wake(30 * 60 * 1000)
      d.onTap(() => this.hud.toast(`${r.name} (${r.look.breed ? breedById(r.look.breed).name : 'Mischling'})`))
      this.names.set(d, r.name)
      this.own.push(d)
      this.records.push(r)
    })
    // Fremde Hunde stehen verteilt an der Route
    for (let i = 0; i < 6; i++) {
      const breed = BREEDS[Math.floor(rng() * BREEDS.length)]
      const pup = rollBreedPuppy(breed, rng)
      const x = 520 + i * 380 + rng() * 120
      const y = 225 + rng() * 100
      const d = new LivingDog(this, pup.look, pup.personality, { x: x - 40, y: 215, w: 80, h: 125 }, { x, y }, Math.random)
      d.setCaption(breed.name)
      d.setSize([0.62, 0.82, 1, 1][Math.floor(rng() * 4)] * WALK_SCALE)
      d.onTap(() => this.hud.toast(`Ein fremder ${breed.name}`))
      this.nightOwls.add(d)
      this.strangers.push({ dog: d, name: breed.name, cooldownUntil: 0, x })
    }
    // Funkelstellen mit Schatz
    for (let i = 0; i < 5; i++) {
      const x = 380 + i * 460 + rng() * 140
      const y = 235 + rng() * 90
      const g = this.add.graphics().setPosition(x, y).setDepth(y)
      g.fillStyle(0xfff3a0, 1).fillTriangle(0, -7, 2.2, 0, -2.2, 0).fillTriangle(0, 7, 2.2, 0, -2.2, 0).fillTriangle(-7, 0, 0, 2.2, 0, -2.2).fillTriangle(7, 0, 0, 2.2, 0, -2.2)
      this.tweens.add({ targets: g, alpha: 0.35, scale: 0.8, duration: 700, yoyo: true, repeat: -1 })
      this.sparks.push({ g, x, y, alive: true })
    }
    if (this.own.length === 0) return
    if (this.atmosphere.isNight()) this.hud.toast('Es ist spät, die Hunde sind müde. Nur wer unbedingt raus wollte, läuft mit.')
    else this.hud.toast('Lege den Finger auf den Weg: Der Spaziergänger läuft dorthin, die Hunde folgen an der Leine')
  }

  // Bewegungsraum der Hunde: um die Hand herum, so weit die Leine reicht.
  private leashRect(): { x: number; y: number; w: number; h: number } {
    return { x: this.hand.x - LEASH * 0.8, y: 215, w: LEASH * 1.6, h: 125 }
  }

  // Punkt innerhalb der Leinenlaenge um die Hand
  private clampToLeash(x: number, y: number): { x: number; y: number; taut: boolean } {
    const dx = x - this.hand.x, dy = y - this.hand.y
    const d = Math.hypot(dx, dy)
    if (d <= LEASH) return { x, y, taut: false }
    return { x: this.hand.x + (dx / d) * LEASH, y: this.hand.y + (dy / d) * LEASH, taut: true }
  }

  update(_t: number, delta: number): void {
    this.atmosphere.update(delta)
    const now = this.time.now
    if (this.touch && this.own.length > 0) {
      const tx = Phaser.Math.Clamp(this.touch.x, 60, W - 60)
      const ty = Phaser.Math.Clamp(this.touch.y, 225, 335)
      const dx = tx - this.hand.x, dy = ty - this.hand.y
      const d = Math.hypot(dx, dy)
      const step = Math.min(d, HAND_SPEED * delta)
      if (d > 1) { this.hand.x += (dx / d) * step; this.hand.y += (dy / d) * step; if (Math.abs(this.hand.x - 110) > 30) this.moved = true }
    }
    const night = this.atmosphere.isNight()
    const rect = this.leashRect()
    let taut = false
    for (const d of this.own) {
      d.setResting(night && !this.nightOwls.has(d))
      d.setBounds(rect)
      d.update(delta)
      if (d.sleeping) continue
      // Hund zu weit weg: trottet an die Leine heran
      const dist = Math.hypot(d.x - this.hand.x, d.y - this.hand.y)
      if (dist > LEASH && now - this.lastRedirect > 250 && !d.busyMeeting) {
        const p = this.clampToLeash(this.hand.x, this.hand.y)
        d.goTo({ x: p.x - 10, y: p.y + 10 }, () => undefined)
        this.lastRedirect = now
      }
      if (dist > LEASH * 0.92) taut = true
      this.checkSparks(d)
      this.checkStrangers(d, now)
    }
    for (const s of this.strangers) {
      s.dog.setResting(night && !this.nightOwls.has(s.dog))
      s.dog.update(delta)
    }
    this.checkPair(now)
    this.drawLeash(taut)
    // Kamera gleitet der Hand hinterher statt starr zu kleben
    const want = Phaser.Math.Clamp(this.hand.x, 320, W - 320)
    this.camX += (want - this.camX) * Math.min(1, delta * 0.006)
    this.cameras.main.centerOn(this.camX, 180)
    this.meters.setText(`Ziel in ${Math.max(0, Math.round((W - 100 - this.hand.x) / 10))} m`)
    this.drawAim(now)
    this.drawMinimap()
    if (!this.endShown && this.hand.x > W - 140) {
      this.endShown = true
      this.touch = null
      void this.rewardWalk()
      cue('win')
      openChoice('Ziel erreicht!', [
        `${this.foundCount} Funkelstelle${this.foundCount === 1 ? '' : 'n'} gefunden, ${this.sniffCount} fremde Hund${this.sniffCount === 1 ? '' : 'e'} beschnuppert.`,
        this.records.length > 0 ? 'Die lange Runde hat Spaß gemacht: Die Laune der Hunde steigt.' : 'Die Runde war schön.',
      ], [
        { label: 'Nach Hause', onClick: () => fadeTo(this, 'garden') },
        { label: 'Noch ein bisschen bleiben', onClick: () => undefined },
      ])
    }
  }

  // Das Ziel zaehlt wie eine Runde Spielen: Laune hoch, Energie runter. Zu muede Hunde gehen leer aus.
  private async rewardWalk(): Promise<void> {
    for (const r of this.records) { try { await playWithDog(r) } catch { /* zu muede oder Verbindung weg: keine Belohnung */ } }
  }

  // Zeigt, wohin der Finger den Spaziergaenger schickt, und am Anfang einen Pfeil nach rechts.
  private drawAim(now: number): void {
    this.aim.clear()
    if (this.touch) {
      const x = Phaser.Math.Clamp(this.touch.x, 60, W - 60), y = Phaser.Math.Clamp(this.touch.y, 225, 335)
      this.aim.lineStyle(1.5, 0xffffff, 0.9).strokeCircle(x, y, 7 + Math.sin(now / 120) * 1.5)
      this.aim.fillStyle(0xffffff, 0.35).fillCircle(x, y, 4)
      return
    }
    if (this.moved || this.own.length === 0) return
    const bob = Math.sin(now / 250) * 5
    const x = this.hand.x + 55 + bob, y = this.hand.y - 8
    this.aim.fillStyle(0xffffff, 0.95).fillTriangle(x + 14, y, x, y - 9, x, y + 9).fillRect(x - 16, y - 3, 17, 6)
  }

  // Route oben: Weg, Position des Spaziergaengers, Funkelstellen, Fremde und das Ziel.
  private drawMinimap(): void {
    const g = this.minimap
    g.clear()
    // Leiste klebt oben an der Kamera (feste Bildschirmposition ohne Scrollfaktor, da der Zoom sie sonst verschiebt)
    const v = this.cameras.main.worldView
    const x0 = v.x + 100, x1 = v.x + 540, y = v.y + 14
    this.meters.setPosition(v.x + 320, v.y + 22)
    const at = (wx: number): number => x0 + (Phaser.Math.Clamp(wx, 0, W) / W) * (x1 - x0)
    g.fillStyle(0x000000, 0.3).fillRoundedRect(x0 - 14, y - 11, x1 - x0 + 40, 22, 8)
    g.lineStyle(3, 0xe9d7a4, 1).beginPath().moveTo(x0, y).lineTo(x1, y).strokePath()
    g.lineStyle(3, 0xffd84a, 1).beginPath().moveTo(x0, y).lineTo(at(this.hand.x), y).strokePath()
    for (const sp of this.sparks) if (sp.alive) g.fillStyle(0xfff3a0, 1).fillCircle(at(sp.x), y - 5, 1.8)
    for (const s of this.strangers) g.fillStyle(0xb9b9b9, 1).fillCircle(at(s.x), y + 5, 1.8)
    // Ziel: kleine Fahne
    g.fillStyle(0x7a4e2a, 1).fillRect(x1 + 3, y - 9, 1.5, 16).fillStyle(0xe5484d, 1).fillTriangle(x1 + 4.5, y - 9, x1 + 12, y - 6, x1 + 4.5, y - 3)
    g.fillStyle(0xffffff, 1).fillCircle(at(this.hand.x), y, 4.2).fillStyle(0xd9534f, 1).fillCircle(at(this.hand.x), y, 2.6)
  }

  // Zwei eigene Hunde an der Leine begegnen sich: zaehlt fuer ihre Freundschaft (wie im Garten, 60 s Pause).
  private checkPair(now: number): void {
    if (now < this.pairUntil) return
    for (let i = 0; i < this.own.length; i++) {
      for (let j = i + 1; j < this.own.length; j++) {
        const a = this.own[i], b = this.own[j]
        if (a.sleeping || b.sleeping || !a.dogKey || !b.dogKey || Math.hypot(a.x - b.x, a.y - b.y) > 48) continue
        this.pairUntil = now + 60000
        a.meet(b.x, 3000)
        b.meet(a.x, 3000)
        cue('soft')
        this.hud.toast(`${this.names.get(a)} und ${this.names.get(b)} begrüßen sich`)
        void recordMeeting(a.dogKey, b.dogKey).catch(() => undefined)
        return
      }
    }
  }

  private checkSparks(d: LivingDog): void {
    for (const sp of this.sparks) {
      if (!sp.alive || Math.hypot(d.x - sp.x, d.y - sp.y) > 26) continue
      sp.alive = false
      this.foundCount++
      sp.g.destroy()
      d.cheer(1500)
      const id = d.dogKey
      void (id ? findTreasure(id) : Promise.resolve(null)).then((f) => {
        if (!f) { this.hud.toast('Hier war nichts. Vielleicht später nochmal'); return }
        cue('coin')
        this.hud.toast(`${this.names.get(d) ?? 'Dein Hund'} hat etwas ausgegraben: ${f.what}, +${f.coins} Münzen`)
        this.hud.refresh()
      }).catch(() => undefined)
    }
  }

  private checkStrangers(d: LivingDog, now: number): void {
    for (const s of this.strangers) {
      if (s.cooldownUntil > now) continue
      const dist = Math.hypot(d.x - s.dog.x, d.y - s.dog.y)
      if (dist < 44) {
        s.cooldownUntil = now + 60000
        this.sniffCount++
        d.cancelChase()
        d.meet(s.dog.x, 3500)
        s.dog.meet(d.x, 3500)
        cue('munch')
        this.hud.toast(`${this.names.get(d) ?? 'Dein Hund'} schnuppert an einem fremden ${s.name}`)
        return
      }
      // Neugierig: zieht zum Fremden, so weit die Leine reicht
      if (dist < 190 && !d.busyMeeting && now - this.lastRedirect > 600) {
        const p = this.clampToLeash(s.dog.x - 28 * Math.sign(s.dog.x - d.x), s.dog.y)
        d.goTo({ x: p.x, y: p.y }, () => undefined)
        this.lastRedirect = now
        if (p.taut && now - this.lastPullToast > 9000) {
          this.lastPullToast = now
          this.hud.toast(`${this.names.get(d) ?? 'Dein Hund'} zieht an der Leine, geh mit hin`)
        }
        return
      }
    }
  }

  private drawLeash(taut: boolean): void {
    this.leash.clear()
    this.grip.clear()
    if (this.own.length === 0) return
    const col = taut ? 0xd9534f : 0x7a4e2a
    this.leash.lineStyle(taut ? 1.6 : 1.2, col, 1)
    for (const d of this.own) {
      if (d.sleeping) continue
      const hx = this.hand.x, hy = this.hand.y - 18
      const dx = d.x, dy = d.y - 26 * d.scale
      const slack = taut ? 0 : 8
      this.leash.beginPath().moveTo(hx, hy).lineTo((hx + dx) / 2, (hy + dy) / 2 + slack).lineTo(dx, dy).strokePath()
    }
    // Die Hand haelt die Leine: Griff mit Schlaufe
    this.grip.fillStyle(0x000000, 0.2).fillEllipse(this.hand.x, this.hand.y + 2, 14, 5)
    this.grip.fillStyle(0xf2c29b, 1).fillCircle(this.hand.x, this.hand.y - 18, 5).fillStyle(0xe3ad84, 1).fillRect(this.hand.x - 1.5, this.hand.y - 14, 3, 14)
    this.grip.lineStyle(1.2, 0x7a4e2a, 1).strokeCircle(this.hand.x + 4, this.hand.y - 18, 3)
  }

  private drawRoute(): { sun: Phaser.GameObjects.Graphics; clouds: Phaser.GameObjects.Graphics } {
    const sun = this.add.graphics().setDepth(0.05).setScrollFactor(0)
    const clouds = this.add.graphics().setScrollFactor(0)
    const g = this.add.graphics().setDepth(0)
    const rng = mulberry32(23)
    g.fillGradientStyle(0x6ec6ff, 0x6ec6ff, 0xcdeeff, 0xcdeeff, 1).fillRect(0, 0, W, 150)
    sun.fillStyle(0xfff3a0, 0.35).fillCircle(250, 40, 28).fillStyle(0xffd84a, 1).fillCircle(250, 40, 18)
    for (let tx = 40; tx < W; tx += 110 + Math.floor(rng() * 90)) {
      const h = 40 + rng() * 25
      g.fillStyle(0x7a4e2a).fillRect(tx - 5, 150 - h, 10, h)
      g.fillStyle(rng() > 0.5 ? 0x3f9b4a : 0x4aa856).fillCircle(tx, 150 - h - 10, 26).fillCircle(tx - 16, 150 - h + 6, 17).fillCircle(tx + 16, 150 - h + 6, 17)
    }
    g.fillStyle(0x6fc45a).fillRect(0, 140, W, 220)
    g.fillStyle(0xe9d7a4).fillRect(0, 232, W, 112)
    g.fillStyle(0xd9c58e, 1)
    for (let x = 0; x < W; x += 60) g.fillRect(x, 236 + ((x / 60) % 3) * 36, 30, 3)
    // Wegweiser alle 50 m und Baenke
    for (let m = 400; m < W; m += 400) {
      g.fillStyle(0xa8793f).fillRect(m, 200, 4, 34).fillStyle(0xc89a5a).fillRect(m - 16, 198, 38, 12)
      g.fillStyle(0x7a4e2a, 1).fillRect(m + 40, 222, 30, 4).fillRect(m + 42, 226, 3, 8).fillRect(m + 65, 226, 3, 8)
    }
    for (let i = 0; i < 260; i++) {
      const x = rng() * W, y = 160 + rng() * 195
      g.fillStyle(0x4c9b3a).fillTriangle(x - 4, y, x - 1, y - 9, x + 1, y)
    }
    for (let i = 0; i < 90; i++) {
      const x = rng() * W, y = 170 + rng() * 60
      g.fillStyle([0xff6b8a, 0xffd23f, 0xb084f0][i % 3], 1).fillCircle(x, y, 2.4)
    }
    // Ziel: Torbogen am Ende
    g.fillStyle(0xa8793f).fillRect(W - 90, 176, 8, 70).fillRect(W - 40, 176, 8, 70).fillRect(W - 94, 170, 60, 10)
    return { sun, clouds }
  }
}
