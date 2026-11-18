import Phaser from 'phaser'
import { breedById } from '../dog/breeds'
import { standoutTrait } from '../dog/livingDog'
import { DogSprite } from '../dog/dogSprite'
import { adoptPuppy } from '../dogRepo'
import { puppySeedFor, rollPuppies } from '../puppies'
import type { Session } from '../session'
import { drawScenery } from './scenery'

const XS = [120, 320, 520]
const Y = 205

export class PickerScene extends Phaser.Scene {
  private sprites: DogSprite[] = []
  private ring!: Phaser.GameObjects.Graphics

  constructor() {
    super('picker')
  }

  create(): void {
    this.cameras.main.setZoom(3).centerOn(320, 180)
    drawScenery(this)
    const session = this.registry.get('session') as Session
    const puppies = rollPuppies(puppySeedFor(session.userId))
    let selected = 0
    this.ring = this.add.graphics().setDepth(Y - 1)

    const ui = document.getElementById('ui') as HTMLElement
    ui.className = 'bar'
    ui.style.display = 'flex'
    ui.innerHTML = `<div class="card wide">
      <div class="pick-title"></div>
      <div class="row"><input id="pname" placeholder="Name des Welpen" maxlength="20" /><button id="adopt">Aufnehmen</button></div>
      <p class="msg"></p></div>`
    const title = ui.querySelector('.pick-title') as HTMLElement
    const msg = ui.querySelector('.msg') as HTMLElement
    const button = ui.querySelector('#adopt') as HTMLButtonElement
    const input = ui.querySelector('#pname') as HTMLInputElement

    const select = (i: number): void => {
      selected = i
      this.ring.clear().fillStyle(0xffffff, 0.35).fillEllipse(XS[i], Y + 4, 90, 22)
      const b = breedById(puppies[i].look.breed ?? 'labrador')
      title.textContent = `${b.name}: ${standoutTrait(puppies[i].personality)}. Tippe auf einen Welpen zum Wählen.`
    }

    puppies.forEach((pup, i) => {
      const d = new DogSprite(this, pup.look, XS[i], Y)
      d.setPose('sit')
      d.container.setDepth(Y)
      d.container.setInteractive(new Phaser.Geom.Rectangle(-40, -60, 80, 80), Phaser.Geom.Rectangle.Contains)
      d.container.on('pointerdown', () => select(i))
      this.sprites.push(d)
      const b = breedById(pup.look.breed ?? 'labrador')
      this.add
        .text(XS[i], Y - 74, `${b.name}\n${standoutTrait(pup.personality)}`, {
          fontSize: '11px', color: '#ffffff', stroke: '#2b2b2b', strokeThickness: 3, align: 'center', resolution: 3, fontFamily: 'Arial, Helvetica, sans-serif',
        })
        .setOrigin(0.5, 1)
        .setDepth(1000)
    })
    select(0)

    button.addEventListener('click', async () => {
      msg.textContent = ''
      button.disabled = true
      try {
        await adoptPuppy(session, puppies[selected], input.value)
        ui.style.display = 'none'
        ui.className = ''
        this.scene.start('garden')
      } catch (e) {
        msg.textContent = e instanceof Error ? e.message : 'Etwas ist schiefgelaufen, bitte nochmal versuchen'
        button.disabled = false
      }
    })
  }

  update(_time: number, delta: number): void {
    for (const s of this.sprites) s.update(delta)
  }
}
