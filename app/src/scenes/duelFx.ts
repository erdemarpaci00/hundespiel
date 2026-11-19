import Phaser from 'phaser'
import { cue } from '../feedback'
import type { LivingDog } from '../dog/livingDog'

// Gemeinsame Wurf- und Fang-Effekte fuer Duell und Garten.
export interface DuelEntry { record: { look: { size: number } }; dog: LivingDog }

export function mouthOf(e: DuelEntry): { x: number; y: number } {
  const k = e.record.look.size * e.dog.scale
  return { x: e.dog.x + e.dog.facing * 50 * k, y: e.dog.y - 44 * k }
}

// Ein Zeiger pendelt ueber einen Balken, ein Tipp wirft. Mitte (gruen) = perfekter Wurf. Liefert 0 bis 1.
export function timingThrow(scene: Phaser.Scene, title: string): Promise<number> {
  return new Promise((resolve) => {
    const cx = 320, cy = 322, w = 190
    const bar = scene.add.graphics().setDepth(3000)
    bar.fillStyle(0x000000, 0.55).fillRoundedRect(cx - w / 2 - 6, cy - 12, w + 12, 24, 6)
    bar.fillStyle(0xe05555, 1).fillRect(cx - w / 2, cy - 5, w, 10)
    bar.fillStyle(0xf0c040, 1).fillRect(cx - w * 0.3, cy - 5, w * 0.6, 10)
    bar.fillStyle(0x4caf50, 1).fillRect(cx - w * 0.1, cy - 5, w * 0.2, 10)
    const label = scene.add.text(cx, cy - 20, title, { fontSize: '10px', color: '#ffffff', backgroundColor: 'rgba(0,0,0,0.6)', padding: { x: 6, y: 3 }, resolution: 3, fontFamily: 'Arial, Helvetica, sans-serif' }).setOrigin(0.5, 1).setDepth(3002)
    const cursor = scene.add.rectangle(cx, cy, 3, 18, 0xffffff).setDepth(3001)
    const t0 = scene.time.now
    const pos = (): number => 0.5 + 0.5 * Math.sin(((scene.time.now - t0) / 1000) * 3.2 - Math.PI / 2)
    const tick = scene.time.addEvent({ delay: 16, loop: true, callback: () => cursor.setX(cx - w / 2 + pos() * w) })
    let done = false
    const finish = (q: number): void => {
      if (done) return
      done = true
      tick.remove(false)
      bar.destroy(); label.destroy(); cursor.destroy()
      resolve(q)
    }
    scene.time.delayedCall(300, () => {
      if (done) return
      scene.input.once('pointerdown', () => finish(1 - Math.abs(pos() - 0.5) * 2))
    })
    scene.time.delayedCall(8000, () => finish(0.2))
  })
}

// Frisbee im hohen Bogen: der Hund rennt unter die Flugbahn, springt und faengt ihn in der Luft (oder springt daneben).
export async function airCatch(scene: Phaser.Scene, e: DuelEntry, land: { x: number; y: number }, caught: boolean): Promise<void> {
  const from = { x: 320, y: 292 }
  const PEAK = 105
  const CATCH = 0.78
  const catchPt = { x: from.x + (land.x - from.x) * CATCH, y: from.y + (land.y - from.y) * CATCH }
  const dist = Math.hypot(catchPt.x - e.dog.x, catchPt.y - e.dog.y)
  const dur = Math.min(3000, Math.max(1500, (dist / 0.11) * 0.9 + 500))
  const g = scene.add.graphics().setDepth(3000)
  g.fillStyle(0xe8453c, 1).fillEllipse(0, 0, 14, 5.5).fillStyle(0xffffff, 1).fillEllipse(0, -0.8, 8, 2.4)
  const shadow = scene.add.ellipse(from.x, from.y, 12, 4, 0x000000, 0.25).setDepth(1)
  const place = (v: number): void => {
    const x = from.x + (land.x - from.x) * v
    const y = from.y + (land.y - from.y) * v
    g.setPosition(x, y - Math.sin(v * Math.PI) * PEAK).setAngle(v * 1080)
    shadow.setPosition(x, y)
  }
  place(0)
  const flight = new Promise<void>((resolve) => {
    scene.tweens.addCounter({ from: 0, to: CATCH, duration: dur * CATCH, onUpdate: (tw) => place(tw.getValue() ?? 0), onComplete: () => resolve() })
  })
  const run = dogRunsTo(scene, e, catchPt)
  await Promise.all([flight, run])
  const k = e.record.look.size * e.dog.scale
  const A = Math.max(14, Math.sin(CATCH * Math.PI) * PEAK - 40 * k)
  const jumpMs = 620
  cue('soft')
  if (caught) {
    // Sprung: Hund und Frisbee treffen sich auf Maulhoehe, danach traegt er ihn im Maul.
    await new Promise<void>((resolve) => {
      scene.tweens.addCounter({
        from: 0, to: 1, duration: jumpMs,
        onUpdate: (tw) => {
          const v = tw.getValue() ?? 0
          e.dog.setAir(Math.sin(v * Math.PI) * A)
          const m = mouthOf(e)
          g.setPosition(m.x, m.y - e.dog.airNow).setAngle(0).setDepth(e.dog.y + 1)
          shadow.setPosition(e.dog.x, e.dog.y)
        },
        onComplete: () => { e.dog.setAir(0); resolve() },
      })
    })
    const m = mouthOf(e)
    g.setPosition(m.x, m.y)
    await new Promise((r) => scene.time.delayedCall(450, () => r(null)))
  } else {
    // Zu frueh oder zu spaet abgesprungen: der Frisbee segelt darueber und landet im Gras.
    scene.tweens.addCounter({
      from: CATCH, to: 1, duration: dur * (1 - CATCH),
      onUpdate: (tw) => place(tw.getValue() ?? 0),
      onComplete: () => { g.setPosition(land.x, land.y).setAngle(0).setDepth(land.y - 1); shadow.setPosition(land.x, land.y) },
    })
    await new Promise<void>((resolve) => {
      scene.tweens.addCounter({
        from: 0, to: 1, duration: jumpMs,
        onUpdate: (tw) => e.dog.setAir(Math.sin((tw.getValue() ?? 0) * Math.PI) * A * 0.8),
        onComplete: () => { e.dog.setAir(0); resolve() },
      })
    })
    await new Promise((r) => scene.time.delayedCall(dur * (1 - CATCH) + 200, () => r(null)))
  }
  g.destroy()
  shadow.destroy()
}

export function dogRunsTo(scene: Phaser.Scene, e: { dog: LivingDog }, to: { x: number; y: number }): Promise<void> {
  return new Promise((resolve) => {
    let done = false
    const end = (): void => { if (!done) { done = true; resolve() } }
    e.dog.goTo(to, end)
    scene.time.delayedCall(7000, () => { e.dog.cancelChase(); end() })
  })
}

export function floatText(scene: Phaser.Scene, x: number, y: number, text: string, color: string): void {
  const t = scene.add.text(x, y, text, { fontSize: '12px', color, stroke: '#000000', strokeThickness: 3, resolution: 3, fontFamily: 'Arial, Helvetica, sans-serif' }).setOrigin(0.5).setDepth(3003)
  scene.tweens.add({ targets: t, y: y - 26, alpha: 0, duration: 1100, onComplete: () => t.destroy() })
}

