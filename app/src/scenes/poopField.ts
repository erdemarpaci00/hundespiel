import Phaser from 'phaser'
import { cleanPoop } from '../dogRepo'
import type { Poop } from '../garden/poop'

interface Entry { data: Poop; obj: Phaser.GameObjects.Container }

// Haeufchen im Garten: braune Wirbel, antippen raeumt auf (fuer alle im Haushalt).
export class PoopField {
  private list: Entry[] = []

  constructor(private scene: Phaser.Scene, private toast: (text: string) => void, private refresh: () => void) {}

  get count(): number { return this.list.length }

  private add(data: Poop): void {
    const c = this.scene.add.container(data.x, data.y).setDepth(data.y).setSize(22, 22)
    const g = this.scene.add.graphics()
    g.fillStyle(0x6b4423).fillEllipse(0, 3, 14, 6).fillEllipse(0, -1, 10, 5).fillEllipse(0, -5, 6, 4)
    g.fillStyle(0xffffff, 0.35).fillEllipse(-2, -6, 2, 1)
    c.add(g)
    c.setInteractive(new Phaser.Geom.Circle(11, 11, 14), Phaser.Geom.Circle.Contains)
    const entry = { data, obj: c }
    c.on('pointerdown', () => {
      this.remove(entry)
      void cleanPoop(data.id)
        .then((coins) => { this.toast(coins > 0 ? 'Aufgeräumt, +1 Münze' : 'Aufgeräumt'); if (coins > 0) this.refresh() })
        .catch(() => this.toast('Aufräumen hat nicht geklappt'))
    })
    this.list.push(entry)
  }

  private remove(entry: Entry): void {
    this.list = this.list.filter((p) => p !== entry)
    this.scene.tweens.add({ targets: entry.obj, scale: 0, alpha: 0, duration: 200, onComplete: () => entry.obj.destroy() })
  }

  // Abgleich mit dem gemeinsamen Stand aus der Datenbank.
  sync(next: Poop[]): void {
    const ids = new Set(next.map((p) => p.id))
    // Kopie, weil beim Entfernen aus der Liste veraendert wird.
    // oxlint-disable-next-line unicorn/no-useless-spread
    for (const entry of [...this.list]) if (!ids.has(entry.data.id)) this.remove(entry)
    const have = new Set(this.list.map((p) => p.data.id))
    for (const p of next) if (!have.has(p.id)) this.add(p)
  }
}
