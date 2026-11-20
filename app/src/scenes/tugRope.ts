import type Phaser from 'phaser'
import type { DuelEntry } from './duelFx'

export interface Pt { x: number; y: number }

// Punkte eines wackelnden Seils von a nach b: die Mitte schwingt am staerksten, die Enden bleiben fest.
export function ropePoints(a: Pt, b: Pt, n: number, phase: number): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const wiggle = i === 0 || i === n ? 0 : Math.sin(phase + t * 5) * Math.sin(t * Math.PI) * 2.2
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t + wiggle })
  }
  return out
}

// Zwei Hunde zerren kurz an einem Seil, das sich zwischen ihnen spannt. Raeumt sich nach `ms` selbst auf.
export function tugRope(scene: Phaser.Scene, a: DuelEntry, b: DuelEntry, ms: number): void {
  // Die Hunde ruecken ein Stueck auseinander, damit das Seil zwischen ihnen zu sehen ist.
  const dir = a.dog.x <= b.dog.x ? -1 : 1
  a.dog.slide(dir * 22, 500)
  b.dog.slide(-dir * 22, 500)
  const g = scene.add.graphics()
  const ev = scene.time.addEvent({
    delay: 40, loop: true,
    callback: () => {
      const k = Math.min(a.record.look.size * a.dog.scale, b.record.look.size * b.dog.scale)
      const my = (a.dog.y + b.dog.y) / 2 - 36 * k
      const left = a.dog.x <= b.dog.x ? a : b
      const right = left === a ? b : a
      const from = { x: left.dog.x + 26 * k, y: my }
      const to = { x: right.dog.x - 26 * k, y: my }
      const pts = ropePoints(from, to, 8, scene.time.now / 90)
      g.clear().setDepth(Math.max(a.dog.y, b.dog.y) + 1)
      g.lineStyle(3, 0xb5894a, 1).beginPath().moveTo(pts[0].x, pts[0].y)
      for (const p of pts.slice(1)) g.lineTo(p.x, p.y)
      g.strokePath().lineStyle(1, 0xe6c98a, 1).beginPath().moveTo(pts[0].x, pts[0].y - 0.8)
      for (const p of pts.slice(1)) g.lineTo(p.x, p.y - 0.8)
      g.strokePath()
    },
  })
  scene.time.delayedCall(ms, () => { ev.remove(false); g.destroy() })
}
