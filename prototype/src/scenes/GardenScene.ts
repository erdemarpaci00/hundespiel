import { cue } from '../feedback'
import { parseTimestamp } from '../time'
import Phaser from 'phaser'
import { describeActivity, favoriteOf, relativeTime, type ActivityEntry } from '../activity'
import { DogSprite, type Pose } from '../dog/dogSprite'
import { ageDays, ageStage } from '../dog/age'
import { LivingDog } from '../dog/livingDog'
import { randomLook } from '../dog/look'
import { applyElapsed, PLAY_MIN_ENERGY, mood, moodPersonality, type Mood, type Needs } from '../dog/needs'
import { enterContest, cleanPoop, dropPoop, findTreasure, loadPoopsFromDb, loadRelations, recordMeeting, type Relation, careForDog, groomDog, treatDog, playWithDog, loadActivity, loadAffection, loadDogs, subscribeToHousehold, type DogRecord } from '../dogRepo'
import { GARDEN_BOUNDS } from '../garden'
import type { Session } from '../session'
import { markVisit, readLastVisit, shouldWelcome } from '../garden/welcome'
import { duelScore, MEDAL_COLORS, topLeague, CONTEST_MIN_ENERGY, playRound, rivalForm, summarize, type League, type Round } from '../dog/contest'
import { STAT_KEYS, STAT_LABEL, statValue } from '../dog/stats'
import { wishBlock, wishFor, type Wish } from '../dog/wish'
import { wantsPoop, type Poop } from '../garden/poop'
import { dialogJustClosed, openDogDetail, pickDog } from '../ui/dogPanels'
import { loadEconomy } from '../economy'
import { createHud, type Tool } from '../ui/hud'
import { mulberry32 } from '../util/rng'
import { isRestless, resistsWaking } from '../nightlife'
import { createAtmosphere, type Atmosphere } from './atmosphere'
import { drawScenery } from './scenery'

interface BallState { g: Phaser.GameObjects.Graphics; x: number; y: number; flying: boolean; carrier: Entry | null }

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
  private affection: Record<string, Record<string, number>> = {}
  private seenActivity: Set<string> | null = null
  private bubble: Bubble | null = null
  private busy = false
  private tool: Tool = 'hand'
  private inv: Record<string, number> = {}
  private ball: BallState | null = null
  private swipe = 0
  private contestBusy = false
  private owned: Wish[] = ['pet']
  private wishDone = new Set<string>()
  private homeLevel = -1
  private homeGfx: Phaser.GameObjects.Graphics | null = null
  private tapDist = 0
  private lastPetSave = new Map<string, number>()
  private welcomed = false
  private heartAcc = 0
  private poops: { data: Poop; obj: Phaser.GameObjects.Container }[] = []
  private hand!: Phaser.GameObjects.Graphics
  private relations: Relation[] = []
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
    this.tool = 'hand'
    this.inv = {}
    this.ball = null
    this.food = null
    this.seenActivity = null
    this.swipe = 0
    this.tapDist = 0
    this.lastPetSave = new Map()
    this.welcomed = false
    this.poops = []
    // Welt ist 640x360, gerendert wird 3-fach scharf auf 1920x1080
    this.cameras.main.setZoom(3).centerOn(320, 180)
    const backdrop = drawScenery(this)
    this.atmosphere = createAtmosphere(this, true, backdrop)
    this.homeLevel = -1
    this.homeGfx = null
    this.owned = ['pet']
    this.wishDone = new Set()
    this.contestBusy = false
    const syncHome = (): void => { void loadEconomy().then((e) => { this.owned = ['pet', ...((e.items.ball ?? 0) > 0 ? ['ball' as const] : []), ...((e.items.buerste ?? 0) > 0 ? ['brush' as const] : [])]; this.drawHome(e.home ?? 0); this.refreshNeeds() }).catch(() => undefined) }
    syncHome()
    this.time.addEvent({ delay: 20000, loop: true, callback: syncHome })

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
    this.hud = createHud({ householdId: this.session.householdId, getActivity: () => this.activityLines(), travel: (k) => this.scene.start(k), current: 'garden', onEconomy: (items) => this.onEconomy(items), onTool: (t) => this.pick(t) })
    this.hand = this.makeHand()
    this.time.addEvent({ delay: 7000, loop: true, callback: () => this.ambientBall() })
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
    // Zufallsereignis: ein wacher Hund geht buddeln und findet manchmal etwas.
    const dig = (dogId?: string): void => {
      const pool = [...this.entries.values()].filter((e) => !e.dog.sleeping && !e.dog.busyMeeting && (!dogId || e.record.id === dogId))
      if (pool.length === 0 || this.playing) return
      const e = pool[Math.floor(Math.random() * pool.length)]
      const x = GARDEN_BOUNDS.x + 20 + Math.random() * (GARDEN_BOUNDS.w - 40)
      const y = GARDEN_BOUNDS.y + 20 + Math.random() * (GARDEN_BOUNDS.h - 40)
      e.dog.goTo({ x, y }, () => {
        e.dog.cheer(1800)
        void findTreasure(e.record.id).then((f) => {
          if (!f) return
          cue('coin')
          this.heartsAt(e.dog.x, e.dog.y - 20 * e.dog.scale)
          this.hud.toast(`${e.record.name} hat ${f.what} ausgebuddelt: +${f.coins} Münzen`)
          this.hud.refresh()
        }).catch(() => undefined)
      })
    }
    if (location.search.includes('debug')) (window as unknown as { __dig: typeof dig }).__dig = dig
    // Ausbauten werden genutzt: auf der Decke ausruhen, im Teich planschen, am Beet schnuppern.
    const useHome = (): void => {
      const spots: { x: number; y: number; hold: number; cheer: number }[] = []
      if (this.homeLevel >= 1) spots.push({ x: 432, y: 264, hold: 9000, cheer: 0 })
      if (this.homeLevel >= 2) spots.push({ x: 75, y: 190, hold: 3500, cheer: 0 })
      if (this.homeLevel >= 3) spots.push({ x: 540, y: 285, hold: 0, cheer: 2500 })
      const pool = [...this.entries.values()].filter((e) => !e.dog.sleeping && !e.dog.busyMeeting)
      if (spots.length === 0 || pool.length === 0 || this.playing) return
      const e = pool[Math.floor(Math.random() * pool.length)]
      const sp = spots[Math.floor(Math.random() * spots.length)]
      e.dog.goTo({ x: sp.x, y: sp.y }, () => { if (sp.hold) e.dog.hold(sp.hold); if (sp.cheer) { e.dog.cheer(sp.cheer); this.heartsAt(e.dog.x, e.dog.y - 20 * e.dog.scale) } })
    }
    if (location.search.includes('debug')) (window as unknown as { __useHome: typeof useHome }).__useHome = useHome
    this.time.addEvent({ delay: 25000, loop: true, callback: () => { if (Math.random() < 0.4) useHome() } })
    this.time.addEvent({ delay: 60000, loop: true, callback: () => { if (Math.random() < 0.3) dig() } })
    this.input.on('pointerup', () => this.hand.setVisible(false))
    // Wischen ueber einen Hund streichelt ihn (ca. 120 Pixel Weg ueber dem Hund, einmal pro Wisch).
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      for (const e of this.entries.values()) if (Math.hypot(p.worldX - e.dog.x, p.worldY - e.dog.y) < 110) e.dog.lookAt(p.worldX)
      this.hand.setVisible(false)
      if (p.isDown) this.tapDist += Math.hypot(p.x - p.prevPosition.x, p.y - p.prevPosition.y) / this.cameras.main.zoom
      if (!p.isDown || this.tool !== 'hand' || this.busy || this.contestBusy) { this.swipe = 0; return }
      const hit = [...this.entries.values()].find((e) => Math.abs(p.worldX - e.dog.x) < 40 * e.dog.scale + 10 && Math.abs(p.worldY - (e.dog.y - 25 * e.dog.scale)) < 35)
      if (!hit) { this.swipe = 0; return }
      // Die Hand folgt dem Finger, solange er ueber dem Hund wischt.
      this.hand.setPosition(p.worldX, p.worldY).setAngle(Math.sin(this.time.now / 90) * 14).setVisible(true)
      const step = Math.hypot(p.x - p.prevPosition.x, p.y - p.prevPosition.y) / this.cameras.main.zoom
      this.swipe += step
      hit.dog.hold(900)
      hit.dog.bliss(1500)
      this.heartAcc += step
      if (this.heartAcc > 30) { this.heartAcc = 0; this.heartsAt(hit.dog.x + (Math.random() - 0.5) * 24, hit.dog.y - 55 * hit.dog.scale) }
      if (this.swipe > 120) {
        this.swipe = 0
        cue('soft')
        this.closeBubble()
        // Herzen sofort, gespeichert wird hoechstens alle 5 Minuten pro Hund (sonst Verlaufsspam und Dauerladen).
        const last = this.lastPetSave.get(hit.record.id) ?? 0
        if (Date.now() - last > 5 * 60 * 1000) { this.lastPetSave.set(hit.record.id, Date.now()); void this.care('pet', hit.record.id) } else this.fulfill(hit.record.id, 'pet')
      }
    })
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: unknown[]) => {
      if (over.length > 0) return
      if (this.contestBusy) return
      if (this.tool === 'futter') { this.throwFood(p.worldX, p.worldY); return }
      if (this.tool === 'ball') { this.throwBallAt(p.worldX, p.worldY); return }
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
      this.affection = await loadAffection(this.session).catch(() => this.affection)
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
        existing.dog.setSize(ageStage(ageDays(parseTimestamp(record.createdAt), Date.now())).scale)
        return
      }
      const start = { x: 160 + (i % 4) * 110, y: 250 + (i % 2) * 50 }
      const dog = new LivingDog(this, record.look, record.personality, GARDEN_BOUNDS, start, Math.random)
      dog.setCaption(record.name)
      dog.setSize(ageStage(ageDays(parseTimestamp(record.createdAt), Date.now())).scale)
      dog.setKey(record.id)
      dog.onTap(() => {
        if (dialogJustClosed() || this.contestBusy) return
        if (this.tool !== 'hand') { this.useToolOnDog(record.id); return }
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

  // Aktueller Wunsch des Hundes, solange er noch nicht erfuellt ist.
  private currentWish(e: { record: DogRecord; dog: LivingDog }): Wish | null {
    if (e.dog.sleeping) return null
    const now = Date.now()
    if (this.wishDone.has(`${e.record.id}|${wishBlock(now)}`)) return null
    return wishFor(e.record.id, e.record.personality, now, this.owned)
  }

  // Passt die Handlung zum Wunsch, freut sich der Hund besonders.
  private fulfill(dogId: string, kind: Wish): void {
    const e = this.entries.get(dogId)
    if (!e || this.currentWish(e) !== kind) return
    this.wishDone.add(`${dogId}|${wishBlock(Date.now())}`)
    this.heartsAt(e.dog.x - 8, e.dog.y - 70 * e.dog.scale)
    this.heartsAt(e.dog.x + 8, e.dog.y - 60 * e.dog.scale)
    e.dog.cheer(2500)
    this.hud.toast(`Genau das wollte ${e.record.name}!`)
    this.refreshNeeds()
  }

  private refreshNeeds(): void {
    for (const e of this.entries.values()) {
      const m = mood(this.currentNeeds(e))
      e.dog.setPersonality(moodPersonality(e.record.personality, m))
      const top = topLeague(e.record.trophies)
      e.dog.setMedal(top >= 0 ? MEDAL_COLORS[top] : null)
      e.dog.setFeeling(m === 'happy' || (m === 'ok' && favoriteOf(this.affection[e.record.id] ?? {}) === this.session.displayName) ? 'happy' : m === 'sad' || m === 'hungry' ? 'sad' : 'ok')
      const w = this.currentWish(e)
      e.dog.setEmote(m === 'hungry' ? 'hungry' : m === 'sad' ? 'sad' : w ? (`wish-${w}` as const) : null)
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
      state === 'asleep' ? [['wake', () => this.tryWake(e.record.id)], ['details', () => openDogDetail(e.record, this.currentNeeds(e), this.bondsOf(e.record.id), () => { this.hud.refresh(); void this.reload() }, (d, l) => void this.playFrisbee(d, l), favoriteOf(this.affection[e.record.id] ?? {}), this.entries.size > 1 ? (d) => this.chooseDuel(d) : undefined)]]
      : state === 'restless' ? [['walk', () => this.scene.start('walk')], ['details', () => openDogDetail(e.record, this.currentNeeds(e), this.bondsOf(e.record.id), () => { this.hud.refresh(); void this.reload() }, (d, l) => void this.playFrisbee(d, l), favoriteOf(this.affection[e.record.id] ?? {}), this.entries.size > 1 ? (d) => this.chooseDuel(d) : undefined)]]
      : [['feed', () => void this.care('feed', e.record.id)], ['pet', () => void this.care('pet')], ['ball', () => this.pick('ball')], ['brush', () => void this.brush(e.record.id)], ['details', () => openDogDetail(e.record, this.currentNeeds(e), this.bondsOf(e.record.id), () => { this.hud.refresh(); void this.reload() }, (d, l) => void this.playFrisbee(d, l), favoriteOf(this.affection[e.record.id] ?? {}), this.entries.size > 1 ? (d) => this.chooseDuel(d) : undefined)]]
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

  // Ausbau des Gartens: Decke, Blumenbeet, Teich. Zeichnet nur neu, wenn sich die Stufe aendert.
  private drawHome(level: number): void {
    if (level === this.homeLevel) return
    this.homeLevel = level
    this.homeGfx?.destroy()
    const g = this.add.graphics().setDepth(1)
    this.homeGfx = g
    if (level >= 1) g.fillStyle(0xd9534f, 1).fillRoundedRect(410, 236, 44, 26, 4).fillStyle(0xf0ad4e, 1).fillRect(414, 240, 36, 3).fillRect(414, 255, 36, 3)
    if (level >= 2) {
      g.fillStyle(0x6b4423, 1).fillRoundedRect(40, 160, 70, 18, 4)
      const cols = [0xff6b8a, 0xffd23f, 0xb084f0, 0xff9a4d]
      for (let i = 0; i < 7; i++) g.fillStyle(cols[i % 4], 1).fillCircle(48 + i * 9.5, 166 + (i % 2) * 5, 3.2)
    }
    if (level >= 3) g.fillStyle(0x8c7a5a, 1).fillEllipse(540, 300, 92, 46).fillStyle(0x4aa3df, 1).fillEllipse(540, 300, 82, 38).fillStyle(0xffffff, 0.35).fillEllipse(530, 295, 26, 8)
  }

  // Ein Zeiger pendelt ueber einen Balken, ein Tipp wirft. Mitte (gruen) = perfekter Wurf. Liefert 0 bis 1.
  private timingThrow(title: string): Promise<number> {
    return new Promise((resolve) => {
      const cx = 320, cy = 322, w = 190
      const bar = this.add.graphics().setDepth(3000)
      bar.fillStyle(0x000000, 0.55).fillRoundedRect(cx - w / 2 - 6, cy - 12, w + 12, 24, 6)
      bar.fillStyle(0xe05555, 1).fillRect(cx - w / 2, cy - 5, w, 10)
      bar.fillStyle(0xf0c040, 1).fillRect(cx - w * 0.3, cy - 5, w * 0.6, 10)
      bar.fillStyle(0x4caf50, 1).fillRect(cx - w * 0.1, cy - 5, w * 0.2, 10)
      const label = this.add.text(cx, cy - 20, title, { fontSize: '10px', color: '#ffffff', backgroundColor: 'rgba(0,0,0,0.6)', padding: { x: 6, y: 3 }, resolution: 3, fontFamily: 'Arial, Helvetica, sans-serif' }).setOrigin(0.5, 1).setDepth(3002)
      const cursor = this.add.rectangle(cx, cy, 3, 18, 0xffffff).setDepth(3001)
      const t0 = this.time.now
      const pos = (): number => 0.5 + 0.5 * Math.sin(((this.time.now - t0) / 1000) * 3.2 - Math.PI / 2)
      const tick = this.time.addEvent({ delay: 16, loop: true, callback: () => cursor.setX(cx - w / 2 + pos() * w) })
      let done = false
      const finish = (q: number): void => {
        if (done) return
        done = true
        tick.remove(false)
        bar.destroy(); label.destroy(); cursor.destroy()
        resolve(q)
      }
      this.time.delayedCall(300, () => {
        if (done) return
        this.input.once('pointerdown', () => finish(1 - Math.abs(pos() - 0.5) * 2))
      })
      this.time.delayedCall(8000, () => finish(0.2))
    })
  }

  // Frisbee fliegt im Bogen vom Spieler (unten Mitte) zum Landepunkt.
  private flyFrisbee(to: { x: number; y: number }): Promise<Phaser.GameObjects.Graphics> {
    const from = { x: 320, y: 292 }
    const g = this.add.graphics().setDepth(2999)
    g.fillStyle(0xe8453c, 1).fillEllipse(0, 0, 9, 3.5).fillStyle(0xffffff, 1).fillEllipse(0, -0.5, 5, 1.6)
    g.setPosition(from.x, from.y)
    return new Promise((resolve) => {
      this.tweens.addCounter({
        from: 0, to: 1, duration: 700,
        onUpdate: (tw) => {
          const v = tw.getValue() ?? 0
          g.setPosition(from.x + (to.x - from.x) * v, from.y + (to.y - from.y) * v - Math.sin(v * Math.PI) * 70).setAngle(v * 720)
        },
        onComplete: () => { g.setPosition(to.x, to.y).setAngle(0).setDepth(to.y - 1); resolve(g) },
      })
    })
  }

  private dogRunsTo(e: { dog: LivingDog }, to: { x: number; y: number }): Promise<void> {
    return new Promise((resolve) => {
      let done = false
      const end = (): void => { if (!done) { done = true; resolve() } }
      e.dog.goTo(to, end)
      this.time.delayedCall(7000, () => { e.dog.cancelChase(); end() })
    })
  }

  private floatText(x: number, y: number, text: string, color: string): void {
    const t = this.add.text(x, y, text, { fontSize: '12px', color, stroke: '#000000', strokeThickness: 3, resolution: 3, fontFamily: 'Arial, Helvetica, sans-serif' }).setOrigin(0.5).setDepth(3003)
    this.tweens.add({ targets: t, y: y - 26, alpha: 0, duration: 1100, onComplete: () => t.destroy() })
  }

  // Sichtbares Frisbee-Turnier: vier Wuerfe mit Timing, der Hund rennt und faengt (oder nicht).
  // Ausgang: Wert + Tagesglueck + Laune + Passung (Anhaenglichkeit) + Wurfqualitaet gegen die Liga.
  private async playFrisbee(record: DogRecord, league: League): Promise<void> {
    const e = this.entries.get(record.id)
    if (!e || this.contestBusy) return
    if (e.dog.sleeping) { this.hud.toast(`${record.name} schläft gerade`); return }
    const needs = this.currentNeeds(e)
    if (needs.energy < CONTEST_MIN_ENERGY) { this.hud.toast(`${record.name} ist zu müde für ein Turnier`); return }
    this.contestBusy = true
    this.closeBubble()
    this.cancelModes(false)
    this.hud.showHotbar(false)
    const form = rivalForm(Math.random)
    const rounds: Round[] = []
    try {
      for (let i = 0; i < STAT_KEYS.length; i++) {
        const stat = STAT_KEYS[i]
        const q = await this.timingThrow(`${league.name}, Runde ${i + 1} von ${STAT_KEYS.length}: ${STAT_LABEL[stat]} - tippe in der Mitte!`)
        const tx = GARDEN_BOUNDS.x + 40 + Math.random() * (GARDEN_BOUNDS.w - 80)
        const ty = GARDEN_BOUNDS.y + 30 + Math.random() * (GARDEN_BOUNDS.h - 60)
        const miss = (1 - q) * 70
        const ang = Math.random() * Math.PI * 2
        const land = {
          x: Math.min(GARDEN_BOUNDS.x + GARDEN_BOUNDS.w, Math.max(GARDEN_BOUNDS.x, tx + Math.cos(ang) * miss)),
          y: Math.min(GARDEN_BOUNDS.y + GARDEN_BOUNDS.h, Math.max(GARDEN_BOUNDS.y, ty + Math.sin(ang) * miss * 0.5)),
        }
        const disc = await this.flyFrisbee(land)
        await this.dogRunsTo(e, land)
        const round = playRound({ stat, value: statValue(record.look.breed, record.training, stat), league, form, happiness: needs.happiness, affection: record.personality.affection, throwQuality: q, favorite: favoriteOf(this.affection[record.id] ?? {}) === this.session.displayName }, Math.random)
        rounds.push(round)
        disc.destroy()
        cue(round.won ? 'good' : 'bad')
        if (round.won) { e.dog.cheer(1400); this.heartsAt(e.dog.x, e.dog.y - 60 * e.dog.scale); this.floatText(e.dog.x, e.dog.y - 70 * e.dog.scale, q > 0.8 ? 'Perfekt gefangen!' : 'Gefangen!', '#8dff8d') }
        else this.floatText(e.dog.x, e.dog.y - 70 * e.dog.scale, q < 0.4 ? 'Zu weit geworfen' : 'Daneben', '#ffb3b3')
        await new Promise((r) => this.time.delayedCall(1100, () => r(null)))
      }
      const result = summarize(league, rounds)
      const r = await enterContest(record, league, result)
      cue(result.won ? 'win' : 'soft')
      this.hud.toast(result.won ? `Sieg in der ${league.name}! +${r.result.prize} Münzen` : `Nicht gewonnen, Trostpreis +${r.result.prize} Münzen`)
      if (result.won) { e.dog.cheer(3000); this.heartsAt(e.dog.x - 10, e.dog.y - 70 * e.dog.scale); this.heartsAt(e.dog.x + 10, e.dog.y - 60 * e.dog.scale) }
      this.hud.refresh()
      await this.reload()
    } catch (err) {
      this.hud.toast(err instanceof Error ? err.message : 'Etwas ist schiefgelaufen, bitte nochmal versuchen')
    } finally {
      this.contestBusy = false
      this.hud.showHotbar(true)
    }
  }

  // Duell: du wirfst abwechselnd fuer beide Hunde, wer vier Runden besser faengt, gewinnt. Nur zum Spass, ohne Preis.
  private chooseDuel(first: DogRecord): void {
    const others = [...this.entries.values()].filter((e) => e.record.id !== first.id)
    if (others.length === 1) void this.playDuel(first, others[0].record.id)
    else pickDog(`Wer tritt gegen ${first.name} an?`, others.map((e) => ({ id: e.record.id, name: e.record.name })), (id) => void this.playDuel(first, id))
  }

  private async playDuel(first: DogRecord, opponentId: string): Promise<void> {
    const a = this.entries.get(first.id)
    const b = this.entries.get(opponentId)
    if (!a || !b || this.contestBusy) return
    if (a.dog.sleeping || b.dog.sleeping) { this.hud.toast('Einer der beiden schläft gerade'); return }
    this.contestBusy = true
    this.closeBubble()
    this.cancelModes(false)
    this.hud.showHotbar(false)
    let winsA = 0, winsB = 0
    try {
      for (let i = 0; i < STAT_KEYS.length; i++) {
        const stat = STAT_KEYS[i]
        const scores: number[] = []
        for (const e of [a, b]) {
          const q = await this.timingThrow(`Duell, Runde ${i + 1} von ${STAT_KEYS.length}: ${STAT_LABEL[stat]} - Wurf für ${e.record.name}`)
          const tx = GARDEN_BOUNDS.x + 40 + Math.random() * (GARDEN_BOUNDS.w - 80)
          const ty = GARDEN_BOUNDS.y + 30 + Math.random() * (GARDEN_BOUNDS.h - 60)
          const miss = (1 - q) * 70
          const ang = Math.random() * Math.PI * 2
          const land = {
            x: Math.min(GARDEN_BOUNDS.x + GARDEN_BOUNDS.w, Math.max(GARDEN_BOUNDS.x, tx + Math.cos(ang) * miss)),
            y: Math.min(GARDEN_BOUNDS.y + GARDEN_BOUNDS.h, Math.max(GARDEN_BOUNDS.y, ty + Math.sin(ang) * miss * 0.5)),
          }
          const disc = await this.flyFrisbee(land)
          await this.dogRunsTo(e, land)
          disc.destroy()
          const sc = duelScore({ value: statValue(e.record.look.breed, e.record.training, stat), happiness: this.currentNeeds(e).happiness, affection: e.record.personality.affection, throwQuality: q, favorite: favoriteOf(this.affection[e.record.id] ?? {}) === this.session.displayName }, Math.random)
          scores.push(sc)
          cue(q < 0.4 ? 'bad' : 'good')
          this.floatText(e.dog.x, e.dog.y - 70 * e.dog.scale, q > 0.8 ? 'Perfekt!' : q < 0.4 ? 'Daneben' : 'Gefangen', q < 0.4 ? '#ffb3b3' : '#8dff8d')
          await new Promise((r) => this.time.delayedCall(700, () => r(null)))
        }
        const win: Entry = scores[0] >= scores[1] ? a : b
        if (win === a) winsA++; else winsB++
        win.dog.cheer(1200)
        this.heartsAt(win.dog.x, win.dog.y - 60 * win.dog.scale)
        this.floatText(win.dog.x, win.dog.y - 85 * win.dog.scale, `${win.record.name} gewinnt die Runde`, '#ffffff')
        await new Promise((r) => this.time.delayedCall(1000, () => r(null)))
      }
      const champ = winsA === winsB ? null : winsA > winsB ? a : b
      this.hud.toast(champ ? `${champ.record.name} gewinnt das Duell ${Math.max(winsA, winsB)}:${Math.min(winsA, winsB)}` : `Unentschieden ${winsA}:${winsB}`)
      if (champ) { champ.dog.cheer(3000); cue('win') }
    } catch (err) {
      this.hud.toast(err instanceof Error ? err.message : 'Etwas ist schiefgelaufen')
    } finally {
      this.contestBusy = false
      this.hud.showHotbar(true)
    }
  }

  // Werkzeug aus der Leiste unten waehlen (Hand = Streicheln und Menue).
  private pick(t: Tool): void {
    const need: Record<Tool, string> = { hand: '', futter: 'Futter', leckerli: 'Leckerli', ball: 'Ball', buerste: 'Bürste' }
    if (t !== 'hand' && (this.inv[t] ?? 0) < 1) {
      this.hud.toast(t === 'futter' || t === 'leckerli' ? `Kein ${need[t]} mehr, im Laden gibt es neues` : `Ihr habt noch keine${t === 'ball' ? 'n' : ''} ${need[t]}, im Laden gibt es ${t === 'ball' ? 'einen' : 'eine'}`)
      return
    }
    this.tool = this.tool === t && t !== 'hand' ? 'hand' : t
    this.hud.setTool(this.tool)
    this.closeBubble()
    const hint: Partial<Record<Tool, string>> = { futter: 'Tippe einen Hund zum Füttern oder in den Garten zum Werfen', leckerli: 'Tippe einen Hund, um ein Leckerli zu geben', ball: 'Tippe in den Garten, um den Ball zu werfen', buerste: 'Tippe einen Hund zum Bürsten' }
    if (this.tool !== 'hand') this.hud.toast(hint[this.tool] ?? '')
  }

  private cancelModes(_announce: boolean): void {
    this.tool = 'hand'
    this.hud.setTool('hand')
  }

  private get playing(): boolean {
    return this.tool === 'ball' || this.tool === 'futter'
  }

  private onEconomy(items: Record<string, number>): void {
    this.inv = items
    if (this.tool !== 'hand' && (items[this.tool] ?? 0) < 1) this.cancelModes(false)
    if ((items.ball ?? 0) > 0 && !this.ball) this.spawnBall(200 + Math.random() * 240, GARDEN_BOUNDS.y + 30 + Math.random() * (GARDEN_BOUNDS.h - 60))
  }

  private useToolOnDog(id: string): void {
    const e = this.entries.get(id)
    if (!e) return
    if (this.tool === 'futter') void this.care('feed', id)
    else if (this.tool === 'leckerli') void this.giveTreat(id)
    else if (this.tool === 'buerste') void this.brush(id)
    else if (this.tool === 'ball') this.throwBallAt(e.dog.x, e.dog.y)
  }

  private async giveTreat(id: string): Promise<void> {
    const e = this.entries.get(id)
    if (!e || this.busy) return
    this.busy = true
    try {
      await treatDog(e.record)
      this.heartsAt(e.dog.x, e.dog.y - 60 * e.dog.scale)
      e.dog.cheer(1200)
      cue('soft')
      this.hud.toast(`${e.record.name} freut sich über das Leckerli`)
      await this.reload()
      this.hud.refresh()
    } catch (err) {
      this.hud.toast(err instanceof Error ? err.message : 'Etwas ist schiefgelaufen, bitte nochmal versuchen')
    } finally {
      this.busy = false
    }
  }

  private throwFood(wx: number, wy: number): void {
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

  // Buersten: braucht eine Buerste im Vorrat und macht ein glaenzendes Fell.
  private async brush(dogId: string): Promise<void> {
    const e = this.entries.get(dogId)
    if (!e || this.busy) return
    try {
      const eco = await loadEconomy()
      if ((eco.items.buerste ?? 0) < 1) { this.hud.toast('Ihr habt noch keine Bürste, im Laden gibt es eine'); return }
      this.busy = true
      await groomDog(e.record)
      this.hud.refresh()
      this.hud.toast(`${e.record.name} hat jetzt ein glänzendes Fell`)
      this.fulfill(e.record.id, 'brush')
      await this.reload()
    } catch (err) {
      this.hud.toast(err instanceof Error ? err.message : 'Etwas ist schiefgelaufen, bitte nochmal versuchen')
    } finally {
      this.busy = false
      this.updateBubbleText()
    }
  }

  // ---- Ball: liegt im Garten, wird geworfen, geholt, getragen und von den Hunden selbst herumgetragen ----
  private spawnBall(x: number, y: number): void {
    const g = this.add.graphics()
    g.fillStyle(0xc9a227, 1).fillCircle(0, 0, 3.5).fillStyle(0xffffff, 1).fillRect(-3.5, -0.5, 7, 1)
    g.setPosition(x, y).setDepth(y)
    this.ball = { g, x, y, flying: false, carrier: null }
  }

  private mouth(e: Entry): { x: number; y: number } {
    const k = e.record.look.size * e.dog.scale
    return { x: e.dog.x + e.dog.facing * 50 * k, y: e.dog.y - 44 * k }
  }

  private randomSpot(): { x: number; y: number } {
    return { x: GARDEN_BOUNDS.x + 20 + Math.random() * (GARDEN_BOUNDS.w - 40), y: GARDEN_BOUNDS.y + 20 + Math.random() * (GARDEN_BOUNDS.h - 40) }
  }

  private updateBall(): void {
    const b = this.ball
    if (!b || !b.carrier) return
    if (b.carrier.dog.sleeping) { this.dropBall(b.carrier, false); return }
    const m = this.mouth(b.carrier)
    b.x = m.x
    b.y = m.y
    b.g.setPosition(m.x, m.y).setDepth(b.carrier.dog.y + 1)
  }

  // Ball werfen: alle wachen, nicht zu muede Hunde rennen los, der schnellste nimmt ihn ins Maul und bringt ihn zurueck.
  private throwBallAt(wx: number, wy: number): void {
    if (this.contestBusy) return
    if (!this.ball) this.spawnBall(320, 292)
    const b = this.ball!
    if (b.flying) return
    const t = { x: Math.min(GARDEN_BOUNDS.x + GARDEN_BOUNDS.w, Math.max(GARDEN_BOUNDS.x, wx)), y: Math.min(GARDEN_BOUNDS.y + GARDEN_BOUNDS.h, Math.max(GARDEN_BOUNDS.y, wy)) }
    b.carrier = null
    for (const e of this.entries.values()) e.dog.cancelChase()
    const runners = [...this.entries.values()].filter((e) => !e.dog.sleeping && !e.dog.busyMeeting && this.currentNeeds(e).energy >= PLAY_MIN_ENERGY)
    const from = { x: 320, y: 292 }
    b.flying = true
    this.tweens.addCounter({
      from: 0, to: 1, duration: 650,
      onUpdate: (tw) => {
        const v = tw.getValue() ?? 0
        b.x = from.x + (t.x - from.x) * v
        b.y = from.y + (t.y - from.y) * v
        b.g.setPosition(b.x, b.y - Math.sin(v * Math.PI) * 60).setDepth(3000)
      },
      onComplete: () => { b.flying = false; b.g.setPosition(t.x, t.y).setDepth(t.y) },
    })
    if (runners.length === 0) { this.hud.toast('Gerade hat niemand Lust auf den Ball'); return }
    for (const e of runners) e.dog.goTo(t, () => this.reachBall(e, runners))
  }

  private reachBall(e: Entry, runners: Entry[]): void {
    const b = this.ball
    if (!b || b.carrier) return
    if (b.flying) { e.dog.hold(300); this.time.delayedCall(150, () => this.reachBall(e, runners)); return }
    b.carrier = e
    // Die anderen jagen dem Ballträger hinterher.
    const chase = this.time.addEvent({ delay: 900, loop: true, callback: () => {
      if (this.ball?.carrier !== e) { chase.remove(false); return }
      for (const o of runners) if (o !== e && !o.dog.sleeping) o.dog.goTo({ x: e.dog.x - e.dog.facing * 28 + (Math.random() - 0.5) * 20, y: e.dog.y + (Math.random() - 0.5) * 14 }, () => undefined)
    } })
    for (const o of runners) if (o !== e) o.dog.cancelChase()
    const back = { x: 320 + (Math.random() - 0.5) * 90, y: GARDEN_BOUNDS.y + GARDEN_BOUNDS.h - 6 - Math.random() * 14 }
    e.dog.goTo(back, () => this.dropBall(e, true))
    this.time.delayedCall(20000, () => { if (this.ball?.carrier === e) this.dropBall(e, false) })
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
    this.tweens.addCounter({
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
    this.hud.toast(`${e.record.name} bringt den Ball zurück`)
    this.fulfill(e.record.id, 'ball')
    void playWithDog(e.record).then(() => { this.hud.refresh(); return this.reload() }).catch((err) => this.hud.toast(err instanceof Error ? err.message : 'Etwas ist schiefgelaufen, bitte nochmal versuchen'))
  }

  // Von allein: ein Hund holt den Ball, traegt ihn herum, laesst ihn fallen, der naechste schnappt ihn sich.
  private ambientBall(): void {
    const b = this.ball
    if (!b || b.flying || b.carrier || this.contestBusy || Math.random() > 0.6) return
    const pool = [...this.entries.values()].filter((e) => !e.dog.sleeping && !e.dog.busyMeeting)
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
        const others = [...this.entries.values()].filter((o) => o !== e && !o.dog.sleeping && !o.dog.busyMeeting)
        if (others.length > 0 && Math.random() < chain) this.time.delayedCall(700, () => this.ambientFetch(others[Math.floor(Math.random() * others.length)], chain * 0.6))
      })
      this.time.delayedCall(15000, () => { if (this.ball?.carrier === e) this.dropBall(e, false) })
    })
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
      if (action === 'pet') this.fulfill(sel.record.id, 'pet')
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
    this.updateBall()
    this.atmosphere.update(delta)
    this.placeBubble()
  }
}
