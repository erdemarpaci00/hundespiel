import { parseTimestamp } from '../time'
import Phaser from 'phaser'
import { describeActivity, relativeTime, type ActivityEntry } from '../activity'
import { DogSprite, type Pose } from '../dog/dogSprite'
import { ageDays, ageStage } from '../dog/age'
import { LivingDog } from '../dog/livingDog'
import { randomLook } from '../dog/look'
import { applyElapsed, PLAY_MIN_ENERGY, mood, moodPersonality, type Mood, type Needs } from '../dog/needs'
import { cleanPoop, dropPoop, loadPoopsFromDb, loadRelations, recordMeeting, type Relation, careForDog, groomDog, playWithDog, loadActivity, loadDogs, subscribeToHousehold, type DogRecord } from '../dogRepo'
import { GARDEN_BOUNDS } from '../garden'
import type { Session } from '../session'
import { markVisit, readLastVisit, shouldWelcome } from '../garden/welcome'
import { wantsPoop, type Poop } from '../garden/poop'
import { dialogJustClosed, openDogDetail } from '../ui/dogPanels'
import { loadEconomy } from '../economy'
import { createHud } from '../ui/hud'
import { mulberry32 } from '../util/rng'
import { isRestless, resistsWaking } from '../nightlife'
import { createAtmosphere, type Atmosphere } from './atmosphere'
import { drawScenery } from './scenery'

type Action = 'feed' | 'pet' | 'details' | 'wake' | 'walk' | 'ball' | 'brush'

// Ring aus runden Symbol-Knoepfen um den Hund, ohne Textkasten.
interface Bubble {
  box: Phaser.GameObjects.Container
  dogId: string
  timer: Phaser.Time.TimerEvent
  state: string
}

const ACTION_COLOR: Record<Action, number> = { feed: 0x2b6cb0, pet: 0xe0527a, details: 0x5a6b7d, wake: 0x8a5cc2, walk: 0xd9822b, ball: 0xc9a227, brush: 0x3a9ea5 }

const MOOD_PHRASE: Record<Mood, string> = { happy: 'glücklich', ok: 'zufrieden', hungry: 'hungrig', tired: 'müde', sad: 'traurig' }
const FONT = 'Arial, Helvetica, sans-serif'

interface Entry {
  record: DogRecord
  dog: LivingDog
}

export class GardenScene extends Phaser.Scene {
  private poseDogs: DogSprite[] = []
  private entries = new Map<string, Entry>()
  private session!: Session
  private hud!: ReturnType<typeof createHud>
  private selectedId: string | null = null
  private activity: ActivityEntry[] = []
  private seenActivity: Set<string> | null = null
  private bubble: Bubble | null = null
  private busy = false
  private throwMode = false
  private swipe = 0
  private modeHint: Phaser.GameObjects.Text | null = null
  private modeTimer: Phaser.Time.TimerEvent | null = null
  private tapDist = 0
  private lastPetSave = new Map<string, number>()
  private welcomed = false
  private heartAcc = 0
  private poops: { data: Poop; obj: Phaser.GameObjects.Container }[] = []
  private hand!: Phaser.GameObjects.Graphics
  private relations: Relation[] = []
  private ballFor: string | null = null
  private food: Phaser.GameObjects.Graphics | null = null
  private refusals = new Map<string, number>()
  private atmosphere!: Atmosphere
  private unsubscribe: (() => void) | null = null

  constructor() {
    super('garden')
  }

  create(): void {
    // Die Szene wird beim Zurueckkehren wiederverwendet: alter Stand verweist auf zerstoerte Objekte.
    this.entries = new Map()
    this.poseDogs = []
    this.bubble = null
    this.selectedId = null
    this.busy = false
    this.throwMode = false
    this.ballFor = null
    this.food = null
    this.seenActivity = null
    this.swipe = 0
    this.modeHint = null
    this.modeTimer = null
    this.tapDist = 0
    this.lastPetSave = new Map()
    this.welcomed = false
    this.poops = []
    // Welt ist 640x360, gerendert wird 3-fach scharf auf 1920x1080
    this.cameras.main.setZoom(3).centerOn(320, 180)
    const backdrop = drawScenery(this)
    this.atmosphere = createAtmosphere(this, true, backdrop)

    if (new URLSearchParams(location.search).get('demo') === 'poses') {
      const poses: Pose[] = ['walk', 'sit', 'sleep', 'sniff']
      poses.forEach((pose, i) => {
        const d = new DogSprite(this, randomLook(mulberry32(i + 1)), 95 + i * 150, 270)
        d.setPose(pose)
        this.poseDogs.push(d)
      })
      return
    }

    this.session = this.registry.get('session') as Session
    this.hud = createHud({ householdId: this.session.householdId, getActivity: () => this.activityLines(), travel: (k) => this.scene.start(k), current: 'garden' })
    this.hand = this.makeHand()
    const welcome = shouldWelcome(readLastVisit(), Date.now())
    markVisit(Date.now())
    if (welcome) this.events.once('welcome', () => { let i = 0; for (const e of this.entries.values()) this.time.delayedCall(300 * i++, () => e.dog.cheer(4000)); this.hud.toast('Deine Hunde freuen sich, dass du wieder da bist') })
    if (location.search.includes('debug')) (window as unknown as { __dropPoop: typeof dropPoop }).__dropPoop = dropPoop
    this.time.addEvent({
      delay: 20000,
      loop: true,
      callback: () => {
        for (const e of this.entries.values()) {
          if (!e.dog.sleeping && wantsPoop(Math.random, true, this.poops.length)) { void dropPoop(e.dog.x - 14, e.dog.y + 2).catch(() => undefined); break }
        }
      },
    })
    this.input.on('pointerup', () => this.hand.setVisible(false))
    // Wischen ueber einen Hund streichelt ihn (ca. 120 Pixel Weg ueber dem Hund, einmal pro Wisch).
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      for (const e of this.entries.values()) if (Math.hypot(p.worldX - e.dog.x, p.worldY - e.dog.y) < 110) e.dog.lookAt(p.worldX)
      this.hand.setVisible(false)
      if (p.isDown) this.tapDist += Math.hypot(p.x - p.prevPosition.x, p.y - p.prevPosition.y) / this.cameras.main.zoom
      if (!p.isDown || this.throwMode || this.ballFor || this.busy) { this.swipe = 0; return }
      const hit = [...this.entries.values()].find((e) => Math.abs(p.worldX - e.dog.x) < 40 * e.dog.scale + 10 && Math.abs(p.worldY - (e.dog.y - 25 * e.dog.scale)) < 35)
      if (!hit) { this.swipe = 0; return }
      // Die Hand folgt dem Finger, solange er ueber dem Hund wischt.
      this.hand.setPosition(p.worldX, p.worldY).setAngle(Math.sin(this.time.now / 90) * 14).setVisible(true)
      const step = Math.hypot(p.x - p.prevPosition.x, p.y - p.prevPosition.y) / this.cameras.main.zoom
      this.swipe += step
      hit.dog.hold(900)
      this.heartAcc += step
      if (this.heartAcc > 30) { this.heartAcc = 0; this.heartsAt(hit.dog.x + (Math.random() - 0.5) * 24, hit.dog.y - 55 * hit.dog.scale) }
      if (this.swipe > 120) {
        this.swipe = 0
        this.closeBubble()
        // Herzen sofort, gespeichert wird hoechstens alle 5 Minuten pro Hund (sonst Verlaufsspam und Dauerladen).
        const last = this.lastPetSave.get(hit.record.id) ?? 0
        if (Date.now() - last > 5 * 60 * 1000) { this.lastPetSave.set(hit.record.id, Date.now()); void this.care('pet', hit.record.id) }
      }
    })
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: unknown[]) => {
      if (over.length > 0) return
      if (this.throwMode) { this.throwFood(p.worldX, p.worldY); return }
      if (this.ballFor) { this.throwBall(p.worldX, p.worldY); return }
      this.closeBubble()
    })
    void this.reload()
    this.unsubscribe = subscribeToHousehold(this.session, () => void this.reload())
    this.time.addEvent({ delay: 5000, loop: true, callback: () => this.refreshNeeds() })
    // Zurueck aus dem Hintergrund oder Netz wieder da: Stand neu holen.
    const resync = (): void => { if (document.visibilityState === 'visible') void this.reload() }
    document.addEventListener('visibilitychange', resync)
    window.addEventListener('online', resync)
    this.events.once('shutdown', () => {
      this.unsubscribe?.()
      document.removeEventListener('visibilitychange', resync)
      window.removeEventListener('online', resync)
    })
  }

  private activityLines(): string[] {
    const now = Date.now()
    return this.activity.map((a) => `${describeActivity(a)}, ${relativeTime(a.at, now)}`)
  }

  private async reload(): Promise<void> {
    try {
      const [records, activity, relations, poops] = await Promise.all([loadDogs(this.session), loadActivity(this.session, 8), loadRelations().catch(() => this.relations), loadPoopsFromDb().catch(() => null)])
      this.relations = relations
      if (poops) this.syncPoops(poops)
      if (!this.welcomed) { this.welcomed = true; this.events.emit('welcome') }
      this.announceNew(activity)
      this.activity = activity
      this.syncDogs(records)
    } catch (e) {
      this.hud.toast(e instanceof Error ? e.message : 'Keine Verbindung, bitte Netz prüfen')
    }
    this.refreshNeeds()
  }

  // Was der andere tut, erscheint kurz als Meldung, nicht als Dauerliste.
  private announceNew(activity: ActivityEntry[]): void {
    if (this.seenActivity) {
      for (const a of activity) {
        if (!this.seenActivity.has(a.id) && a.userName !== this.session.displayName) this.hud.toast(describeActivity(a))
      }
    }
    this.seenActivity = new Set(activity.map((a) => a.id))
  }

  private syncDogs(records: DogRecord[]): void {
    const ids = new Set(records.map((r) => r.id))
    for (const [id, e] of this.entries) {
      if (!ids.has(id)) {
        e.dog.destroy()
        this.entries.delete(id)
        if (this.bubble?.dogId === id) this.closeBubble()
      }
    }
    records.forEach((record, i) => {
      const existing = this.entries.get(record.id)
      if (existing) {
        existing.record = record
        return
      }
      const start = { x: 160 + (i % 4) * 110, y: 250 + (i % 2) * 50 }
      const dog = new LivingDog(this, record.look, record.personality, GARDEN_BOUNDS, start, Math.random)
      dog.setCaption(record.name)
      dog.setSize(ageStage(ageDays(parseTimestamp(record.createdAt), Date.now())).scale)
      dog.setKey(record.id)
      dog.onTap(() => {
        if (dialogJustClosed()) return
        if (this.throwMode || this.ballFor) { this.cancelModes(true); return }
        // Ring erst oeffnen, wenn der Finger nicht zum Wischen ansetzt (sonst flackert er bei jedem Streicheln).
        this.tapDist = 0
        this.time.delayedCall(180, () => { if (this.tapDist < 6) this.openBubble(record.id) })
      })
      this.entries.set(record.id, { record, dog })
    })
  }

  // Weisser Handschuh als Streichel-Symbol: Handflaeche plus vier Finger und Daumen.
  private makeHand(): Phaser.GameObjects.Graphics {
    const g = this.add.graphics().setDepth(3000).setVisible(false)
    g.fillStyle(0xffffff, 0.95).lineStyle(1, 0x2b2b2b, 0.8)
    g.fillRoundedRect(-7, -4, 14, 12, 4).strokeRoundedRect(-7, -4, 14, 12, 4)
    for (let i = 0; i < 4; i++) g.fillRoundedRect(-7 + i * 3.6, -13, 3.2, 11, 1.5).strokeRoundedRect(-7 + i * 3.6, -13, 3.2, 11, 1.5)
    g.fillRoundedRect(-11, -2, 5, 8, 2.5).strokeRoundedRect(-11, -2, 5, 8, 2.5)
    return g
  }

  private heartsAt(x: number, y: number): void {
    for (let i = 0; i < 3; i++) {
      const h = this.add.text(x + (i - 1) * 9, y, '♥', { fontSize: '12px', color: '#e0527a', resolution: 3 }).setOrigin(0.5).setDepth(3001)
      this.tweens.add({ targets: h, y: y - 24 - i * 5, alpha: 0, duration: 900, delay: i * 120, onComplete: () => h.destroy() })
    }
  }

  // Haeufchen: braune Wirbel, antippen raeumt auf (fuer alle im Haushalt).
  private addPoop(data: Poop): void {
    const c = this.add.container(data.x, data.y).setDepth(data.y).setSize(22, 22)
    const g = this.add.graphics()
    g.fillStyle(0x6b4423).fillEllipse(0, 3, 14, 6).fillEllipse(0, -1, 10, 5).fillEllipse(0, -5, 6, 4)
    g.fillStyle(0xffffff, 0.35).fillEllipse(-2, -6, 2, 1)
    c.add(g)
    c.setInteractive(new Phaser.Geom.Circle(11, 11, 14), Phaser.Geom.Circle.Contains)
    const entry = { data, obj: c }
    c.on('pointerdown', () => {
      this.removePoopObject(entry)
      void cleanPoop(data.id)
        .then((coins) => { this.hud.toast(coins > 0 ? 'Aufgeräumt, +1 Münze' : 'Aufgeräumt'); if (coins > 0) this.hud.refresh() })
        .catch(() => this.hud.toast('Aufräumen hat nicht geklappt'))
    })
    this.poops.push(entry)
  }

  private removePoopObject(entry: { data: Poop; obj: Phaser.GameObjects.Container }): void {
    this.poops = this.poops.filter((p) => p !== entry)
    this.tweens.add({ targets: entry.obj, scale: 0, alpha: 0, duration: 200, onComplete: () => entry.obj.destroy() })
  }

  // Abgleich mit dem gemeinsamen Stand aus der Datenbank.
  private syncPoops(list: Poop[]): void {
    const ids = new Set(list.map((p) => p.id))
    for (const entry of [...this.poops]) if (!ids.has(entry.data.id)) this.removePoopObject(entry)
    const have = new Set(this.poops.map((p) => p.data.id))
    for (const p of list) if (!have.has(p.id)) this.addPoop(p)
  }

  private bondsOf(id: string): { name: string; meetings: number }[] {
    const out: { name: string; meetings: number }[] = []
    for (const r of this.relations) {
      const other = r.a === id ? r.b : r.b === id ? r.a : null
      const e = other ? this.entries.get(other) : undefined
      if (e) out.push({ name: e.record.name, meetings: r.meetings })
    }
    return out
  }

  private currentNeeds(e: Entry): Needs {
    return applyElapsed(e.record.needs, Date.now() - parseTimestamp(e.record.needsUpdatedAt), e.record.personality)
  }

  private refreshNeeds(): void {
    for (const e of this.entries.values()) {
      const m = mood(this.currentNeeds(e))
      e.dog.setPersonality(moodPersonality(e.record.personality, m))
      e.dog.setEmote(m === 'hungry' ? 'hungry' : m === 'sad' ? 'sad' : null)
      e.dog.setResting(this.atmosphere.isNight() && !isRestless(e.record.id, e.record.personality, new Date()))
    }
    this.updateBubbleText()
  }

  // Rundes Symbol (Napf, Herz, Info, Zzz, Pfote) als Knopf.
  private iconButton(kind: Action, onTap: () => void): Phaser.GameObjects.Container {
    const g = this.add.graphics()
    g.fillStyle(0x000000, 0.25).fillCircle(0, 1.5, 15)
    g.fillStyle(0xffffff, 1).fillCircle(0, 0, 15)
    g.fillStyle(ACTION_COLOR[kind], 1).fillCircle(0, 0, 12.5)
    g.fillStyle(0xffffff, 1)
    const parts: Phaser.GameObjects.GameObject[] = [g]
    if (kind === 'feed') {
      g.fillEllipse(0, 2, 15, 7).fillStyle(ACTION_COLOR.feed, 1).fillEllipse(0, 0, 11, 4).fillStyle(0xffffff, 1).fillCircle(-3, -4, 1.6).fillCircle(0, -5, 1.6).fillCircle(3, -4, 1.6)
    } else if (kind === 'pet') {
      g.fillCircle(-3.2, -2, 4).fillCircle(3.2, -2, 4).fillTriangle(-7, 0, 7, 0, 0, 8)
    } else if (kind === 'brush') {
      g.fillRoundedRect(-8, -3, 16, 7, 2).fillStyle(ACTION_COLOR.brush, 1).fillRect(-5, -1, 1.5, 3).fillRect(-1, -1, 1.5, 3).fillRect(3, -1, 1.5, 3).fillStyle(0xffffff, 1).fillRect(-3, -8, 6, 4)
    } else if (kind === 'ball') {
      g.fillCircle(0, 0, 7).fillStyle(ACTION_COLOR.ball, 1).fillRect(-7, -1, 14, 2).fillStyle(0xffffff, 1)
    } else if (kind === 'walk') {
      g.fillEllipse(0, 3, 9, 7).fillCircle(-5, -2, 2.3).fillCircle(-1.8, -5, 2.3).fillCircle(1.8, -5, 2.3).fillCircle(5, -2, 2.3)
    } else {
      const t = this.add.text(0, 0, kind === 'details' ? 'i' : 'Zzz', { fontSize: kind === 'details' ? '17px' : '11px', color: '#ffffff', fontStyle: 'bold', resolution: 3, fontFamily: FONT }).setOrigin(0.5)
      parts.push(t)
    }
    const c = this.add.container(0, 0, parts)
    // Bei Containern liegt der Ursprung der Klickflaeche in der Ecke der Groesse, daher Mitte (15, 15).
    c.setSize(30, 30).setInteractive(new Phaser.Geom.Circle(15, 15, 19), Phaser.Geom.Circle.Contains)
    c.on('pointerdown', onTap)
    return c
  }

  // Welche Knoepfe der Hund gerade anbietet, je nach Zustand.
  private bubbleState(e: Entry): string {
    if (e.dog.sleeping) return 'asleep'
    if (this.atmosphere.isNight() && isRestless(e.record.id, e.record.personality, new Date())) return 'restless'
    return 'normal'
  }

  // Antippen zeigt Symbole rund um den Hund. Die Stimmung steht kurz im Namen.
  private openBubble(dogId: string): void {
    if (this.bubble?.dogId === dogId) { this.closeBubble(); return }
    this.closeBubble()
    const e = this.entries.get(dogId)
    if (!e) return
    this.selectedId = dogId
    const box = this.add.container(0, 0).setDepth(2000)
    const timer = this.time.delayedCall(8000, () => this.closeBubble())
    this.bubble = { box, dogId, timer, state: '' }
    this.updateBubbleText()
    this.placeBubble()
  }

  private buildRing(e: Entry, state: string): void {
    if (!this.bubble) return
    const box = this.bubble.box
    box.removeAll(true)
    const actions: [Action, () => void][] =
      state === 'asleep' ? [['wake', () => this.tryWake(e.record.id)], ['details', () => openDogDetail(e.record, this.currentNeeds(e), this.bondsOf(e.record.id), () => { this.hud.refresh(); void this.reload() })]]
      : state === 'restless' ? [['walk', () => this.scene.start('walk')], ['details', () => openDogDetail(e.record, this.currentNeeds(e), this.bondsOf(e.record.id), () => { this.hud.refresh(); void this.reload() })]]
      : [['feed', () => this.startThrow()], ['pet', () => void this.care('pet')], ['ball', () => void this.startBall(e.record.id)], ['brush', () => void this.brush(e.record.id)], ['details', () => openDogDetail(e.record, this.currentNeeds(e), this.bondsOf(e.record.id), () => { this.hud.refresh(); void this.reload() })]]
    const n = actions.length
    actions.forEach(([kind, fn], i) => {
      const u = n === 1 ? 0 : (i / (n - 1)) * 2 - 1
      const b = this.iconButton(kind, fn)
      const tx = u * (n - 1) * 19
      const ty = -(1 - u * u) * 14
      b.setPosition(0, 0).setScale(0.3).setAlpha(0)
      this.tweens.add({ targets: b, x: tx, y: ty, scale: 1, alpha: 1, duration: 160, ease: 'Back.easeOut', delay: i * 30 })
      box.add(b)
    })
  }

  // Ein Hund, der aus dem Schlaf geholt wird, wehrt sich manchmal.
  private tryWake(dogId: string): void {
    const e = this.entries.get(dogId)
    if (!e) return
    const n = this.refusals.get(dogId) ?? 0
    if (resistsWaking(e.record.personality, n, Math.random())) {
      this.refusals.set(dogId, n + 1)
      this.hud.toast(`${e.record.name} knurrt und dreht sich um`)
      return
    }
    this.refusals.delete(dogId)
    e.dog.wake(15 * 60 * 1000)
    this.hud.toast(`${e.record.name} ist wach, aber noch müde`)
    this.updateBubbleText()
  }

  private closeBubble(): void {
    if (!this.bubble) return
    this.bubble.timer.remove(false)
    const e = this.entries.get(this.bubble.dogId)
    if (e) e.dog.setCaption(e.record.name)
    this.bubble.box.destroy()
    this.bubble = null
  }

  private updateBubbleText(): void {
    if (!this.bubble) return
    const e = this.entries.get(this.bubble.dogId)
    if (!e) return
    const state = this.bubbleState(e)
    const phrase = state === 'asleep' ? 'schläft' : state === 'restless' ? 'unruhig' : MOOD_PHRASE[mood(this.currentNeeds(e))]
    e.dog.setCaption(`${e.record.name} · ${phrase}`)
    if (this.bubble.state !== state) {
      this.bubble.state = state
      this.buildRing(e, state)
    }
    this.bubble.box.setAlpha(this.busy ? 0.5 : 1)
  }

  private placeBubble(): void {
    if (!this.bubble) return
    const e = this.entries.get(this.bubble.dogId)
    if (!e) return
    const x = Math.min(580, Math.max(60, e.dog.x))
    const y = Math.min(300, Math.max(70, e.dog.y - 26 - 92 * e.dog.scale))
    this.bubble.box.setPosition(x, y)
  }

  // Futter in den Garten werfen: der erste Hund, der ankommt, frisst.
  // Dauerhinweis im Wurf-Modus: bleibt stehen, bis geworfen oder abgebrochen wird (Tipp auf einen Hund oder nach 15 Sekunden).
  private showModeHint(text: string): void {
    this.hideModeHint()
    const t = this.add.text(320, 52, `${text}
(Zum Abbrechen einen Hund antippen)`, { fontSize: '9px', color: '#ffffff', backgroundColor: 'rgba(0,0,0,0.6)', padding: { x: 6, y: 3 }, align: 'center', resolution: 3, fontFamily: 'Arial, Helvetica, sans-serif' }).setOrigin(0.5, 0).setDepth(3002)
    this.modeHint = t
    this.modeTimer = this.time.delayedCall(15000, () => this.cancelModes(true))
  }

  private hideModeHint(): void {
    this.modeHint?.destroy()
    this.modeHint = null
    this.modeTimer?.remove(false)
    this.modeTimer = null
  }

  private cancelModes(announce: boolean): void {
    const was = this.throwMode || this.ballFor !== null
    this.throwMode = false
    this.ballFor = null
    this.hideModeHint()
    if (was && announce) this.hud.toast('Abgebrochen')
  }

  private async startThrow(): Promise<void> {
    this.closeBubble()
    try {
      const eco = await loadEconomy()
      if ((eco.items.futter ?? 0) < 1) { this.hud.toast('Kein Futter mehr, kauft neues im Laden'); return }
    } catch (e) {
      this.hud.toast(e instanceof Error ? e.message : 'Keine Verbindung, bitte Netz prüfen')
      return
    }
    this.throwMode = true
    this.showModeHint('Tippe in den Garten, um das Futter zu werfen')
  }

  private throwFood(wx: number, wy: number): void {
    this.throwMode = false
    this.hideModeHint()
    this.food?.destroy()
    const x = Math.min(GARDEN_BOUNDS.x + GARDEN_BOUNDS.w, Math.max(GARDEN_BOUNDS.x, wx))
    const y = Math.min(GARDEN_BOUNDS.y + GARDEN_BOUNDS.h, Math.max(GARDEN_BOUNDS.y, wy))
    const eager = [...this.entries.values()].filter((e) => !e.dog.sleeping && this.currentNeeds(e).hunger < 95)
    if (eager.length === 0) { this.hud.toast('Gerade hat niemand Hunger'); return }
    const g = this.add.graphics().setDepth(y - 1)
    g.fillStyle(0x7a4a21, 1).fillCircle(x - 4, y, 2.5).fillCircle(x + 3, y - 1, 2.5).fillCircle(x, y + 3, 2.5).fillCircle(x + 6, y + 3, 2)
    this.food = g
    let taken = false
    for (const e of eager) {
      e.dog.goTo({ x, y }, () => {
        if (taken || this.food !== g) return
        taken = true
        g.destroy()
        this.food = null
        for (const o of eager) if (o !== e) o.dog.cancelChase()
        const feedWhenFree = (n: number): void => { if (this.busy && n < 12) this.time.delayedCall(500, () => feedWhenFree(n + 1)); else void this.care('feed', e.record.id) }
        feedWhenFree(0)
      })
    }
    this.time.delayedCall(25000, () => {
      if (this.food !== g) return
      g.destroy()
      this.food = null
      for (const o of eager) o.dog.cancelChase()
    })
  }

  // Ball werfen: der gewaehlte Hund holt ihn, das macht froh und müde.
  private async brush(dogId: string): Promise<void> {
    const e = this.entries.get(dogId)
    if (!e || this.busy) return
    try {
      const eco = await loadEconomy()
      if ((eco.items.buerste ?? 0) < 1) { this.hud.toast('Ihr habt noch keine Bürste, im Laden gibt es eine'); return }
      this.busy = true
      await groomDog(e.record)
      this.hud.toast(`${e.record.name} hat jetzt ein glänzendes Fell`)
      await this.reload()
    } catch (err) {
      this.hud.toast(err instanceof Error ? err.message : 'Etwas ist schiefgelaufen, bitte nochmal versuchen')
    } finally {
      this.busy = false
      this.updateBubbleText()
    }
  }

  private async startBall(dogId: string): Promise<void> {
    const e = this.entries.get(dogId)
    if (!e) return
    this.closeBubble()
    try {
      const eco = await loadEconomy()
      if ((eco.items.ball ?? 0) < 1) { this.hud.toast('Ihr habt noch keinen Ball, im Laden gibt es einen'); return }
    } catch (err) {
      this.hud.toast(err instanceof Error ? err.message : 'Keine Verbindung, bitte Netz prüfen')
      return
    }
    if (this.currentNeeds(e).energy < PLAY_MIN_ENERGY) { this.hud.toast(`${e.record.name} ist zu müde zum Spielen`); return }
    this.throwMode = false
    this.ballFor = dogId
    this.showModeHint('Tippe in den Garten, um den Ball zu werfen')
  }

  private throwBall(wx: number, wy: number): void {
    const e = this.ballFor ? this.entries.get(this.ballFor) : undefined
    this.ballFor = null
    this.hideModeHint()
    if (!e || e.dog.sleeping) return
    const x = Math.min(GARDEN_BOUNDS.x + GARDEN_BOUNDS.w, Math.max(GARDEN_BOUNDS.x, wx))
    const y = Math.min(GARDEN_BOUNDS.y + GARDEN_BOUNDS.h, Math.max(GARDEN_BOUNDS.y, wy))
    const ball = this.add.graphics().setDepth(y - 1)
    ball.fillStyle(0xc9a227, 1).fillCircle(x, y, 3.5).fillStyle(0xffffff, 1).fillRect(x - 3.5, y - 0.5, 7, 1)
    e.dog.goTo({ x, y }, () => {
      ball.destroy()
      this.hud.toast(`${e.record.name} bringt den Ball zurück`)
      void playWithDog(e.record).then(() => { this.hud.refresh(); return this.reload() }).catch((err) => this.hud.toast(err instanceof Error ? err.message : 'Etwas ist schiefgelaufen, bitte nochmal versuchen'))
    })
    this.time.delayedCall(20000, () => { if (ball.active) { ball.destroy(); e.dog.cancelChase() } })
  }

  private async care(action: 'feed' | 'pet', dogId: string | null = this.selectedId): Promise<void> {
    const sel = dogId ? this.entries.get(dogId) : undefined
    if (!sel || this.busy) return
    const before = this.currentNeeds(sel)
    if (action === 'feed' && before.hunger >= 95) {
      this.hud.toast(`${sel.record.name} ist satt`)
      return
    }
    this.busy = true
    this.updateBubbleText()
    try {
      await careForDog(this.session, sel.record, action)
      const dogE = this.entries.get(sel.record.id)
      if (action === 'pet' && dogE) this.heartsAt(dogE.dog.x, dogE.dog.y - 60 * dogE.dog.scale)
      this.hud.toast(action === 'feed' ? `${sel.record.name} frisst und ist satt` : `${sel.record.name} genießt das Streicheln`)
      await this.reload()
      this.hud.refresh()
      this.bubble?.timer.reset({ delay: 8000, callback: () => this.closeBubble() })
    } catch (e) {
      this.hud.toast(e instanceof Error ? e.message : 'Etwas ist schiefgelaufen, bitte nochmal versuchen')
    } finally {
      this.busy = false
      this.updateBubbleText()
    }
  }

  private meetCooldown = new Map<string, number>()

  // Begegnen sich zwei wache Hunde, bleiben sie kurz stehen (Freundschaft waechst spaeter daraus).
  private checkMeetings(): void {
    const now = Date.now()
    const list = [...this.entries.values()].filter((e) => !e.dog.sleeping && !e.dog.busyMeeting)
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j]
        if (Math.hypot(a.dog.x - b.dog.x, (a.dog.y - b.dog.y) * 1.6) > 48) continue
        const key = [a.record.id, b.record.id].sort().join('|')
        if ((this.meetCooldown.get(key) ?? 0) > now) continue
        this.meetCooldown.set(key, now + 60000)
        void recordMeeting(a.record.id, b.record.id).catch(() => { /* Freundschaft zaehlt spaeter */ })
        a.dog.meet(b.dog.x, 3500)
        b.dog.meet(a.dog.x, 3500)
      }
    }
  }

  update(_time: number, delta: number): void {
    if (this.entries.size > 1) this.checkMeetings()
    for (const d of this.poseDogs) d.update(delta)
    for (const e of this.entries.values()) e.dog.update(delta)
    this.atmosphere.update(delta)
    this.placeBubble()
  }
}
