import Phaser from 'phaser'
import { dayPhase, seasonOf, weatherAt, type Phase, type Season, type Weather } from '../daytime'

const TINT: Record<Phase, [number, number]> = { night: [0x0b1233, 0.55], dawn: [0xffb98a, 0.18], day: [0x000000, 0], dusk: [0xff8a4d, 0.22] }

export interface Atmosphere {
  update(dtMs: number): void
  isNight(): boolean
  describe(): string
}

// Dunkelheit, Mond, Sterne, Wolken und Regen je nach echter Uhrzeit. Drinnen nur die Dunkelheit.
export function createAtmosphere(scene: Phaser.Scene, outdoor: boolean, backdrop?: { sun: Phaser.GameObjects.Graphics; clouds: Phaser.GameObjects.Graphics }, now: () => Date = () => new Date(), fixed = false): Atmosphere {
  const shade = scene.add.graphics().setDepth(900)
  const sky = scene.add.graphics().setDepth(1)
  const rain = scene.add.graphics().setDepth(901)
  if (fixed) { shade.setScrollFactor(0); sky.setScrollFactor(0); rain.setScrollFactor(0) }
  const drops = Array.from({ length: 70 }, (_, i) => ({ x: (i * 97) % 640, y: (i * 53) % 360, v: 0.35 + (i % 5) * 0.05 }))
  const leaves = Array.from({ length: 24 }, (_, i) => ({ x: (i * 131) % 640, y: (i * 71) % 360, v: 0.02 + (i % 4) * 0.008, ph: i * 1.7, c: [0xd9822b, 0xb5502a, 0xe0b040, 0x9c6b30][i % 4] }))
  const SIDE: Record<string, string> = { day: '#6fc45a', dusk: '#4f8a45', dawn: '#5fa850', night: '#1f3a2a' }
  let phase: Phase = 'day'
  let weather: Weather = 'sun'
  let season: Season = 'summer'
  let sinceCheck = 99999
  let drawn = false
  // Nur zum Testen: ?debug&hour=23&weather=rain
  const q = new URLSearchParams(location.search)
  const debug = q.has('debug')

  // Tint blendet weich ueber (ca. 3 s) statt hart umzuschalten.
  let cur = { r: 0, g: 0, b: 0, a: 0 }
  let target = { ...cur }
  let shaded = false
  const paintShade = (): void => {
    shade.clear().fillStyle((Math.round(cur.r) << 16) | (Math.round(cur.g) << 8) | Math.round(cur.b), cur.a).fillRect(0, 0, 640, 360)
  }
  const fadeShade = (dtMs: number): void => {
    const k = Math.min(1, dtMs / 3000)
    const d = Math.abs(target.r - cur.r) + Math.abs(target.g - cur.g) + Math.abs(target.b - cur.b) + Math.abs(target.a - cur.a) * 255
    if (d < 0.5) { if (d > 0) { cur = { ...target }; paintShade() } return }
    cur = { r: cur.r + (target.r - cur.r) * k, g: cur.g + (target.g - cur.g) * k, b: cur.b + (target.b - cur.b) * k, a: cur.a + (target.a - cur.a) * k }
    paintShade()
  }

  let drift = 0

  const redraw = (): void => {
    const [color, alpha] = TINT[phase]
    target = { r: (color >> 16) & 255, g: (color >> 8) & 255, b: color & 255, a: alpha + (outdoor && weather === 'rain' ? 0.12 : 0) }
    if (!shaded) { cur = { ...target }; shaded = true; paintShade() }
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
      fadeShade(dtMs)
      drift += dtMs
      if (phase === 'night' && outdoor) sky.setAlpha(0.75 + Math.sin(drift / 700) * 0.25)
      else sky.setAlpha(1)
      if (backdrop) backdrop.clouds.x = Math.sin(drift / 9000) * 28
      if (sinceCheck > 20000) {
        sinceCheck = 0
        const d = now()
        if (debug && q.has('hour')) d.setHours(Number(q.get('hour')))
        const p = dayPhase(d)
        const forced = q.get('weather')
        const sn: Season = debug && ['winter', 'spring', 'summer', 'autumn'].includes(q.get('season') ?? '') ? (q.get('season') as Season) : seasonOf(d)
        season = sn
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
        const snow = season === 'winter'
        rain.lineStyle(1, 0xcfe3ff, 0.7).fillStyle(0xffffff, 0.95)
        for (const d of drops) {
          d.y += d.v * dtMs * (snow ? 0.3 : 1)
          d.x -= d.v * dtMs * (snow ? Math.sin(drift / 900 + d.y / 40) * 0.12 : 0.2)
          if (d.y > 360) { d.y = -10; d.x = Math.random() * 660 }
          if (snow) rain.fillCircle(d.x, d.y, 1.4)
          else rain.lineBetween(d.x, d.y, d.x - 2, d.y + 7)
        }
      } else if (outdoor && season === 'autumn') {
        // Herbst: bei trockenem Wetter segeln ein paar bunte Blaetter herunter.
        for (const l of leaves) {
          l.y += l.v * dtMs
          l.x += Math.sin(drift / 700 + l.ph) * 0.35
          if (l.y > 360) { l.y = -8; l.x = Math.random() * 640 }
          rain.fillStyle(l.c, 0.95).fillEllipse(l.x, l.y, 8, 4.5)
        }
      }
    },
    isNight: () => phase === 'night',
    describe: () => `${phase}/${weather}`,
  }
}
