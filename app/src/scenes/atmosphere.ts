import Phaser from 'phaser'
import { dayPhase, weatherAt, type Phase, type Weather } from '../daytime'

const TINT: Record<Phase, [number, number]> = { night: [0x0b1233, 0.55], dawn: [0xffb98a, 0.18], day: [0x000000, 0], dusk: [0xff8a4d, 0.22] }

export interface Atmosphere {
  update(dtMs: number): void
  isNight(): boolean
  describe(): string
}

// Dunkelheit, Mond, Sterne, Wolken und Regen je nach echter Uhrzeit. Drinnen nur die Dunkelheit.
export function createAtmosphere(scene: Phaser.Scene, outdoor: boolean, backdrop?: { sun: Phaser.GameObjects.Graphics; clouds: Phaser.GameObjects.Graphics }, now: () => Date = () => new Date()): Atmosphere {
  const shade = scene.add.graphics().setDepth(900)
  const sky = scene.add.graphics().setDepth(1)
  const rain = scene.add.graphics().setDepth(901)
  const drops = Array.from({ length: 70 }, (_, i) => ({ x: (i * 97) % 640, y: (i * 53) % 360, v: 0.35 + (i % 5) * 0.05 }))
  const SIDE: Record<string, string> = { day: '#6fc45a', dusk: '#4f8a45', dawn: '#5fa850', night: '#1f3a2a' }
  let phase: Phase = 'day'
  let weather: Weather = 'sun'
  let sinceCheck = 99999
  let drawn = false
  // Nur zum Testen: ?debug&hour=23&weather=rain
  const q = new URLSearchParams(location.search)
  const debug = q.has('debug')

  const redraw = (): void => {
    const [color, alpha] = TINT[phase]
    shade.clear().fillStyle(color, alpha + (outdoor && weather === 'rain' ? 0.12 : 0)).fillRect(0, 0, 640, 360)
    sky.clear()
    backdrop?.sun.setVisible(phase !== 'night' && weather !== 'rain')
    backdrop?.clouds.setVisible(weather === 'sun')
    if (!outdoor) return
    if (phase === 'night') {
      sky.fillStyle(0xffffff, 0.9)
      for (let i = 0; i < 40; i++) sky.fillCircle((i * 83) % 640, 8 + ((i * 37) % 110), i % 7 === 0 ? 1.4 : 0.8)
      sky.fillStyle(0xf4f1d0, 0.25).fillCircle(540, 44, 24).fillStyle(0xf4f1d0, 1).fillCircle(540, 44, 16)
    }
    if (weather !== 'sun') {
      const a = weather === 'rain' ? 0.9 : 0.75
      for (const [cx, cy] of [[90, 30], [260, 50], [430, 26], [580, 58]]) {
        sky.fillStyle(weather === 'rain' ? 0x8c97a6 : 0xe8eef5, a).fillCircle(cx, cy, 20).fillCircle(cx + 22, cy + 5, 16).fillCircle(cx - 22, cy + 6, 15)
      }
    }
  }

  return {
    update(dtMs: number): void {
      sinceCheck += dtMs
      if (sinceCheck > 20000) {
        sinceCheck = 0
        const d = now()
        if (debug && q.has('hour')) d.setHours(Number(q.get('hour')))
        const p = dayPhase(d)
        const forced = q.get('weather')
        const w: Weather = !outdoor ? 'sun' : debug && (forced === 'rain' || forced === 'cloud' || forced === 'sun') ? forced : weatherAt(d)
        if (p !== phase || w !== weather || !drawn) {
          drawn = true
          phase = p
          weather = w
          try { document.body.style.background = SIDE[phase] ?? SIDE.day } catch { /* egal */ }
          redraw()
        }
      }
      rain.clear()
      if (outdoor && weather === 'rain') {
        rain.lineStyle(1, 0xcfe3ff, 0.7)
        for (const d of drops) {
          d.y += d.v * dtMs
          d.x -= d.v * dtMs * 0.2
          if (d.y > 360) { d.y = -10; d.x = Math.random() * 660 }
          rain.lineBetween(d.x, d.y, d.x - 2, d.y + 7)
        }
      }
    },
    isNight: () => phase === 'night',
    describe: () => `${phase}/${weather}`,
  }
}
