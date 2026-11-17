import { parseTimestamp } from '../time'
import Phaser from 'phaser'
import { describeActivity, relativeTime, type ActivityEntry } from '../activity'
import { DogSprite, type Pose } from '../dog/dogSprite'
import { LivingDog } from '../dog/livingDog'
import { randomLook } from '../dog/look'
import { applyElapsed, mood, moodPersonality, type Mood, type Needs } from '../dog/needs'
import { careForDog, loadActivity, loadDogs, subscribeToHousehold, type DogRecord } from '../dogRepo'
import { GARDEN_BOUNDS } from '../garden'
import { loadInviteCode, type Session } from '../session'
import { createHud } from '../ui/hud'
import { mulberry32 } from '../util/rng'
import { drawScenery } from './scenery'

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
  private message = ''
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
    this.hud = createHud({
      onSelect: (id) => {
        this.selectedId = id
        this.renderHud()
      },
      onCare: (action) => void this.care(action),
      loadInviteCode: () => loadInviteCode(this.session.householdId),
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

  private async reload(): Promise<void> {
    try {
      const [records, activity] = await Promise.all([loadDogs(this.session), loadActivity(this.session, 8)])
      this.activity = activity
      this.syncDogs(records)
      this.message = ''
    } catch (e) {
      this.message = e instanceof Error ? e.message : 'Keine Verbindung, bitte Netz prüfen'
    }
    this.refreshNeeds()
  }

  private syncDogs(records: DogRecord[]): void {
    const ids = new Set(records.map((r) => r.id))
    for (const [id, e] of this.entries) {
      if (!ids.has(id)) {
        e.dog.destroy()
        this.entries.delete(id)
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
      this.entries.set(record.id, { record, dog })
    })
    if (!this.selectedId || !this.entries.has(this.selectedId)) {
      const own = records.find((r) => r.pickedBy === this.session.userId)
      this.selectedId = (own ?? records[0])?.id ?? null
    }
  }

  private currentNeeds(e: Entry): Needs {
    return applyElapsed(e.record.needs, Date.now() - parseTimestamp(e.record.needsUpdatedAt), e.record.personality)
  }

  private refreshNeeds(): void {
    for (const e of this.entries.values()) {
      e.dog.setPersonality(moodPersonality(e.record.personality, mood(this.currentNeeds(e))))
    }
    this.renderHud()
  }

  private renderHud(): void {
    if (!this.hud) return
    const sel = this.selectedId ? this.entries.get(this.selectedId) : undefined
    const needs = sel ? this.currentNeeds(sel) : null
    const m: Mood | null = needs ? mood(needs) : null
    const now = Date.now()
    this.hud.render({
      dogs: [...this.entries.values()].map((e) => ({ id: e.record.id, name: e.record.name })),
      selectedId: this.selectedId,
      needs,
      mood: m,
      activity: this.activity.map((a) => `${describeActivity(a)}, ${relativeTime(a.at, now)}`),
      busy: this.busy,
      message: this.message,
    })
  }

  private async care(action: 'feed' | 'pet'): Promise<void> {
    const sel = this.selectedId ? this.entries.get(this.selectedId) : undefined
    if (!sel || this.busy) return
    this.busy = true
    this.message = ''
    this.renderHud()
    try {
      await careForDog(this.session, sel.record, action)
      await this.reload()
    } catch (e) {
      this.message = e instanceof Error ? e.message : 'Etwas ist schiefgelaufen, bitte nochmal versuchen'
    } finally {
      this.busy = false
      this.renderHud()
    }
  }

  update(_time: number, delta: number): void {
    for (const d of this.poseDogs) d.update(delta)
    for (const e of this.entries.values()) e.dog.update(delta)
  }
}
