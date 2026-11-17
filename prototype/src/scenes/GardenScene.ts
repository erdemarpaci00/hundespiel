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
import { createHud } from '../ui/hud'
import { mulberry32 } from '../util/rng'
import { drawScenery } from './scenery'

interface Bubble {
  box: Phaser.GameObjects.Container
  title: Phaser.GameObjects.Text
  buttons: Phaser.GameObjects.Text[]
  dogId: string
  timer: Phaser.Time.TimerEvent
}

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
  private unsubscribe: (() => void) | null = null

  constructor() {
    super('garden')
  }

  create(): void {
    // Welt ist 640x360, gerendert wird 3-fach scharf auf 1920x1080
    this.cameras.main.setZoom(3).centerOn(320, 180)
    drawScenery(this)

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
      dog.onTap(() => this.openBubble(record.id))
      this.entries.set(record.id, { record, dog })
    })
  }

  private currentNeeds(e: Entry): Needs {
    return applyElapsed(e.record.needs, Date.now() - parseTimestamp(e.record.needsUpdatedAt), e.record.personality)
  }

  private refreshNeeds(): void {
    for (const e of this.entries.values()) {
      e.dog.setPersonality(moodPersonality(e.record.personality, mood(this.currentNeeds(e))))
    }
    this.updateBubbleText()
  }

  private pill(label: string, color: string, onTap: () => void): Phaser.GameObjects.Text {
    const t = this.add
      .text(0, 0, label, { fontSize: '12px', color: '#ffffff', backgroundColor: color, padding: { x: 9, y: 6 }, resolution: 3, fontFamily: FONT, fontStyle: 'bold' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
    t.on('pointerdown', onTap)
    return t
  }

  // Der Gemuetszustand zeigt sich nur auf Antippen, als Sprechblase am Hund.
  private openBubble(dogId: string): void {
    this.closeBubble()
    const e = this.entries.get(dogId)
    if (!e) return
    this.selectedId = dogId
    const bg = this.add.graphics()
    bg.fillStyle(0xffffff, 1).fillRoundedRect(-92, -10, 184, 76, 12)
    const title = this.add.text(0, 6, '', { fontSize: '12px', color: '#2b2b2b', fontStyle: 'bold', resolution: 3, fontFamily: FONT }).setOrigin(0.5)
    const feed = this.pill('Füttern', '#2b6cb0', () => void this.care('feed')).setPosition(-44, 42)
    const pet = this.pill('Streicheln', '#4a9b3a', () => void this.care('pet')).setPosition(46, 42)
    const box = this.add.container(0, 0, [bg, title, feed, pet]).setDepth(2000)
    const timer = this.time.delayedCall(8000, () => this.closeBubble())
    this.bubble = { box, title, buttons: [feed, pet], dogId, timer }
    this.updateBubbleText()
    this.placeBubble()
  }

  private closeBubble(): void {
    if (!this.bubble) return
    this.bubble.timer.remove(false)
    this.bubble.box.destroy()
    this.bubble = null
  }

  private updateBubbleText(): void {
    if (!this.bubble) return
    const e = this.entries.get(this.bubble.dogId)
    if (!e) return
    this.bubble.title.setText(`${e.record.name} ist ${MOOD_PHRASE[mood(this.currentNeeds(e))]}`)
    for (const b of this.bubble.buttons) b.setAlpha(this.busy ? 0.5 : 1)
  }

  private placeBubble(): void {
    if (!this.bubble) return
    const e = this.entries.get(this.bubble.dogId)
    if (!e) return
    const x = Math.min(544, Math.max(96, e.dog.x))
    const y = Math.min(280, Math.max(6, e.dog.y - 112))
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
    this.placeBubble()
  }
}
