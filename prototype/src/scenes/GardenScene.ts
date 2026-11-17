import { parseTimestamp } from '../time'
import Phaser from 'phaser'
import { describeActivity, relativeTime, type ActivityEntry } from '../activity'
import { DogSprite, type Pose } from '../dog/dogSprite'
import { LivingDog } from '../dog/livingDog'
import { randomLook } from '../dog/look'
import { applyElapsed, mood, moodPersonality, type Mood, type Needs } from '../dog/needs'
import { careForDog, loadActivity, loadDogs, subscribeToHousehold, type DogRecord } from '../dogRepo'
import { GARDEN_BOUNDS } from '../garden'
import type { Session } from '../session'
import { openDogDetail } from '../ui/dogPanels'
import { createHud } from '../ui/hud'
import { mulberry32 } from '../util/rng'
import { isRestless, resistsWaking } from '../nightlife'
import { createAtmosphere, type Atmosphere } from './atmosphere'
import { drawScenery } from './scenery'

type Action = 'feed' | 'pet' | 'details' | 'wake' | 'walk'

// Ring aus runden Symbol-Knoepfen um den Hund, ohne Textkasten.
interface Bubble {
  box: Phaser.GameObjects.Container
  dogId: string
  timer: Phaser.Time.TimerEvent
  state: string
}

const ACTION_COLOR: Record<Action, number> = { feed: 0x2b6cb0, pet: 0xe0527a, details: 0x5a6b7d, wake: 0x8a5cc2, walk: 0xd9822b }

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
  private refusals = new Map<string, number>()
  private atmosphere!: Atmosphere
  private unsubscribe: (() => void) | null = null

  constructor() {
    super('garden')
  }

  create(): void {
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
    // Ins Leere tippen schliesst die Sprechblase.
    this.input.on('pointerdown', (_p: unknown, over: unknown[]) => { if (over.length === 0) this.closeBubble() })
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
      const [records, activity] = await Promise.all([loadDogs(this.session), loadActivity(this.session, 8)])
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
      dog.setKey(record.id)
      dog.onTap(() => this.openBubble(record.id))
      this.entries.set(record.id, { record, dog })
    })
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
    } else if (kind === 'walk') {
      g.fillEllipse(0, 3, 9, 7).fillCircle(-5, -2, 2.3).fillCircle(-1.8, -5, 2.3).fillCircle(1.8, -5, 2.3).fillCircle(5, -2, 2.3)
    } else {
      const t = this.add.text(0, 0, kind === 'details' ? 'i' : 'Zzz', { fontSize: kind === 'details' ? '17px' : '11px', color: '#ffffff', fontStyle: 'bold', resolution: 3, fontFamily: FONT }).setOrigin(0.5)
      parts.push(t)
    }
    const c = this.add.container(0, 0, parts)
    c.setSize(30, 30).setInteractive(new Phaser.Geom.Circle(0, 0, 18), Phaser.Geom.Circle.Contains)
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
      state === 'asleep' ? [['wake', () => this.tryWake(e.record.id)], ['details', () => openDogDetail(e.record, this.currentNeeds(e))]]
      : state === 'restless' ? [['walk', () => this.scene.start('walk')], ['details', () => openDogDetail(e.record, this.currentNeeds(e))]]
      : [['feed', () => void this.care('feed')], ['pet', () => void this.care('pet')], ['details', () => openDogDetail(e.record, this.currentNeeds(e))]]
    const n = actions.length
    actions.forEach(([kind, fn], i) => {
      const a = (-150 + (n === 1 ? 60 : (i * 120) / (n - 1))) * (Math.PI / 180)
      const b = this.iconButton(kind, fn)
      const tx = Math.cos(a) * 40
      const ty = Math.sin(a) * 34 - 30
      b.setPosition(0, -20).setScale(0.3).setAlpha(0)
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
    const y = Math.min(300, Math.max(90, e.dog.y - 60))
    this.bubble.box.setPosition(x, y)
  }

  private async care(action: 'feed' | 'pet'): Promise<void> {
    const sel = this.selectedId ? this.entries.get(this.selectedId) : undefined
    if (!sel || this.busy) return
    this.busy = true
    this.updateBubbleText()
    try {
      await careForDog(this.session, sel.record, action)
      await this.reload()
      this.bubble?.timer.reset({ delay: 8000, callback: () => this.closeBubble() })
    } catch (e) {
      this.hud.toast(e instanceof Error ? e.message : 'Etwas ist schiefgelaufen, bitte nochmal versuchen')
    } finally {
      this.busy = false
      this.updateBubbleText()
    }
  }

  update(_time: number, delta: number): void {
    for (const d of this.poseDogs) d.update(delta)
    for (const e of this.entries.values()) e.dog.update(delta)
    this.atmosphere.update(delta)
    this.placeBubble()
  }
}
