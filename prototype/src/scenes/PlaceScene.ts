import Phaser from 'phaser'
import { BREEDS, breedById, rollBreedPuppy } from '../dog/breeds'
import { ageDays, ageStage } from '../dog/age'
import { parseTimestamp } from '../time'
import { LivingDog } from '../dog/livingDog'
import { loadDogs } from '../dogRepo'
import type { Session } from '../session'
import { isRestless } from '../nightlife'
import { createAtmosphere, type Atmosphere } from './atmosphere'
import { dialogJustClosed, openAdoption, openTraining } from '../ui/dogPanels'
import { createHud } from '../ui/hud'
import { buildShop } from '../ui/shop'
import { mulberry32 } from '../util/rng'

type Kind = 'walk' | 'shop' | 'kennel' | 'training'

const TITLES: Record<Kind, string> = { walk: 'Spaziergang im Park', shop: 'Laden', kennel: 'Hundeheim', training: 'Trainingsplatz' }

// Gemeinsame Szene fuer alle Orte ausser dem Garten: gezeichneter Hintergrund, Hunde, Karte und Zahnrad.
export class PlaceScene extends Phaser.Scene {
  private hud!: ReturnType<typeof createHud>
  private dogs: LivingDog[] = []
  private atmosphere!: Atmosphere
  private nightOwls = new Set<LivingDog>()

  constructor(private readonly kind: Kind) {
    super(kind)
  }

  create(): void {
    const session = this.registry.get('session') as Session
    this.cameras.main.setZoom(3).centerOn(320, 180)
    this.dogs = []
    this.nightOwls = new Set()
    const backdrop = this.draw()
    this.atmosphere = createAtmosphere(this, this.kind === 'walk' || this.kind === 'training', backdrop)
    this.add.text(320, 14, TITLES[this.kind], { fontSize: '14px', color: '#ffffff', stroke: '#2b2b2b', strokeThickness: 4, resolution: 3, fontFamily: 'Arial, Helvetica, sans-serif', fontStyle: 'bold' }).setOrigin(0.5, 0).setDepth(5)
    this.hud = createHud({ householdId: session.householdId, getActivity: () => [], travel: (k) => this.scene.start(k), current: this.kind })
    if (this.kind === 'shop') this.openShopPanel()
    else void this.populate(session)
  }

  private openShopPanel(): void {
    document.getElementById('settings')?.remove()
    const overlay = document.createElement('div')
    overlay.id = 'settings'
    const card = document.createElement('div')
    card.className = 'card'
    const h = document.createElement('h1')
    h.textContent = 'Willkommen im Laden'
    const back = document.createElement('button')
    back.className = 'tab'
    back.textContent = 'Zurück in den Garten'
    back.addEventListener('click', () => { overlay.remove(); this.scene.start('garden') })
    card.append(h, buildShop(), back)
    overlay.appendChild(card)
    document.body.appendChild(overlay)
    this.events.once('shutdown', () => overlay.remove())
  }

  private async populate(session: Session): Promise<void> {
    const rng = mulberry32(Date.now() & 0xffff)
    const area = this.kind === 'kennel' ? { x: 60, y: 210, w: 520, h: 120 } : { x: 40, y: 200, w: 560, h: 140 }
    let own: Awaited<ReturnType<typeof loadDogs>> = []
    try { own = await loadDogs(session) } catch { this.hud.toast('Keine Verbindung, bitte Netz prüfen') }
    if (!this.scene.isActive(this.kind)) return
    const records = new Map(own.map((r) => [r.id, r]))
    const restless = own.filter((r) => isRestless(r.id, r.personality, new Date()))
    own.forEach((r, i) => {
      if (this.kind === 'kennel') return
      const d = new LivingDog(this, r.look, r.personality, area, { x: 100 + i * 70, y: 270 }, Math.random)
      d.setCaption(r.name)
      d.setSize(ageStage(ageDays(parseTimestamp(r.createdAt), Date.now())).scale)
      d.setKey(r.id)
      if (isRestless(r.id, r.personality, new Date())) d.wake(30 * 60 * 1000)
      d.onTap(() => {
        if (dialogJustClosed()) return
        if (d.sleeping) { d.wake(15 * 60 * 1000); this.hud.toast(`${r.name} ist wach, aber noch müde`) }
        else if (this.kind === 'training') openTraining(records.get(r.id) ?? r, (t) => this.hud.toast(t), (nd) => records.set(r.id, nd))
        else this.hud.toast(`${r.name} (${r.look.breed ? breedById(r.look.breed).name : 'Mischling'})`)
      })
      this.dogs.push(d)
    })
    const strangers = this.kind === 'walk' ? 4 : this.kind === 'kennel' ? 6 : 0
    for (let i = 0; i < strangers; i++) {
      const breed = BREEDS[Math.floor(rng() * BREEDS.length)]
      const pup = rollBreedPuppy(breed, rng)
      const pen = this.kind === 'kennel' ? { x: 40 + i * 100, y: 290, w: 40, h: 20 } : area
      const d = new LivingDog(this, pup.look, pup.personality, pen, this.kind === 'kennel' ? { x: pen.x + 20, y: pen.y + 10 } : { x: 120 + i * 90, y: 230 + (i % 2) * 50 }, Math.random)
      d.setCaption(breed.name)
      d.onTap(() => {
        if (dialogJustClosed()) return
        if (this.kind === 'kennel') openAdoption(session, pup, (nd) => { this.hud.toast(`${nd.name} ist jetzt bei euch zu Hause`); this.scene.start('garden') })
        else this.hud.toast(`Ein fremder ${breed.name}`)
      })
      if (this.kind !== 'kennel') this.nightOwls.add(d)
      this.dogs.push(d)
    }
    if (this.atmosphere.isNight() && this.kind === 'walk' && restless.length > 0) this.hud.toast(`${restless.map((r) => r.name).join(' und ')} wollte unbedingt noch raus`)
    else if (this.atmosphere.isNight() && (this.kind === 'walk' || this.kind === 'training')) this.hud.toast('Es ist spät, die Hunde schlafen. Antippen weckt sie, aber sie sind dann müde.')
    else if (this.kind === 'training') this.hud.toast('Tippe einen Hund an, um mit ihm zu trainieren')
  }

  update(_t: number, delta: number): void {
    this.atmosphere.update(delta)
    for (const d of this.dogs) {
      d.setResting(this.atmosphere.isNight() && !this.nightOwls.has(d))
      d.update(delta)
    }
  }

  private draw(): { sun: Phaser.GameObjects.Graphics; clouds: Phaser.GameObjects.Graphics } {
    const sun = this.add.graphics().setDepth(0.05)
    const clouds = this.add.graphics()
    const backdrop = { sun, clouds }
    const g = this.add.graphics().setDepth(0)
    const rng = mulberry32(11)
    if (this.kind === 'shop' || this.kind === 'kennel') {
      const wall = this.kind === 'shop' ? 0xf1e0c0 : 0xdfe8f2
      const floor = this.kind === 'shop' ? 0xb98a5a : 0xc9c9c9
      g.fillStyle(wall).fillRect(0, 0, 640, 170)
      g.fillStyle(floor).fillRect(0, 170, 640, 190)
      for (let x = 0; x < 640; x += 40) g.fillStyle(0x000000, 0.06).fillRect(x, 170, 2, 190)
      if (this.kind === 'shop') {
        for (let s = 0; s < 3; s++) {
          g.fillStyle(0x7a4e2a).fillRect(40, 40 + s * 40, 560, 6)
          for (let i = 0; i < 14; i++) g.fillStyle([0xd9534f, 0x4a90d9, 0xe5b93c, 0x5cb85c][(i + s) % 4]).fillRect(52 + i * 38, 16 + s * 40, 24, 24)
        }
        g.fillStyle(0x8b5a2b).fillRect(200, 190, 240, 40).fillStyle(0xa8793f).fillRect(200, 190, 240, 8)
      } else {
        for (let i = 0; i < 6; i++) {
          g.fillStyle(0x8a8a8a, 0.9).fillRect(30 + i * 100, 190, 4, 140).fillRect(30 + i * 100 + 96, 190, 4, 140)
          g.fillRect(30 + i * 100, 190, 100, 4)
        }
      }
      return backdrop
    }
    g.fillGradientStyle(0x6ec6ff, 0x6ec6ff, 0xcdeeff, 0xcdeeff, 1).fillRect(0, 0, 640, 150)
    sun.fillStyle(0xfff3a0, 0.35).fillCircle(250, 40, 28).fillStyle(0xffd84a, 1).fillCircle(250, 40, 18)
    for (const tx of [60, 180, 330, 470, 590]) {
      g.fillStyle(0x7a4e2a).fillRect(tx - 5, 90, 10, 50)
      g.fillStyle(0x3f9b4a).fillCircle(tx, 78, 28).fillCircle(tx - 18, 96, 18).fillCircle(tx + 18, 96, 18)
    }
    g.fillStyle(0x6fc45a).fillRect(0, 140, 640, 220)
    if (this.kind === 'walk') g.fillStyle(0xe9d7a4).fillEllipse(320, 250, 700, 70)
    else {
      g.fillStyle(0xffffff).fillRect(60, 250, 520, 3)
      for (const cx of [140, 240, 340, 440]) g.fillStyle(0xff8a3d).fillTriangle(cx - 8, 252, cx + 8, 252, cx, 226)
      g.fillStyle(0xa8793f).fillRect(480, 226, 6, 30).fillRect(540, 226, 6, 30).fillRect(480, 226, 66, 5)
    }
    for (let i = 0; i < 50; i++) {
      const x = rng() * 640, y = 160 + rng() * 195
      g.fillStyle(0x4c9b3a).fillTriangle(x - 4, y, x - 1, y - 9, x + 1, y)
    }
    return backdrop
  }
}
