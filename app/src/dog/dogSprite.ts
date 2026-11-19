import Phaser from 'phaser'
import { clampDelta } from '../util/rng'
import type { DogLook } from './look'

export type Feeling = 'ok' | 'happy' | 'sad' | 'blissful'

export type Pose = 'walk' | 'sit' | 'sleep' | 'sniff'

const LEG_LEN = 26

function shade(color: number, amount: number): number {
  return Phaser.Display.Color.IntegerToColor(color).darken(amount).color
}

export class DogSprite {
  readonly container: Phaser.GameObjects.Container
  private readonly look: DogLook
  private pose: Pose = 'sit'
  private phase = 0
  private dir: -1 | 1 = 1

  private readonly body: Phaser.GameObjects.Ellipse
  private readonly head: Phaser.GameObjects.Container
  private readonly tail: Phaser.GameObjects.Container
  private readonly legs: Phaser.GameObjects.Rectangle[] // hinten, hinten, vorne, vorne
  private readonly eyeOpen: Phaser.GameObjects.Arc
  private readonly eyeClosed: Phaser.GameObjects.Rectangle
  private shut = false
  private readonly blinkOff = 600 + Math.random() * 3000
  private readonly zzz: Phaser.GameObjects.Text
  private readonly patternShapes: { obj: Phaser.GameObjects.Shape; baseY: number }[] = []

  constructor(scene: Phaser.Scene, look: DogLook, x: number, y: number) {
    this.look = look
    const { coat, patternColor } = look
    const dark = shade(coat, 20)
    const light = Phaser.Display.Color.IntegerToColor(coat).lighten(25).color

    this.container = scene.add.container(x, y)

    // Beine zuerst, damit sie hinter dem Körper liegen
    this.legs = [-22, -13, 13, 22].map((lx, i) => {
      const leg = scene.add.rectangle(lx, -26, 8, LEG_LEN, i % 2 === 0 ? dark : coat).setOrigin(0.5, 0)
      return leg
    })
    this.container.add(this.legs)

    this.body = scene.add.ellipse(0, -36, 64, 34, coat)
    this.container.add(this.body)

    if (look.pattern === 'spots') {
      for (const [sx, sy, r] of [[-14, -42, 6], [6, -32, 5], [16, -44, 4]]) {
        const spot = scene.add.circle(sx, sy, r, patternColor)
        this.patternShapes.push({ obj: spot, baseY: sy })
        this.container.add(spot)
      }
    } else if (look.pattern === 'patch') {
      const patch = scene.add.ellipse(-8, -40, 28, 18, patternColor)
      this.patternShapes.push({ obj: patch, baseY: -40 })
      this.container.add(patch)
    }

    // Schwanz
    this.tail = scene.add.container(-30, -42)
    if (look.tail === 'short') {
      this.tail.add(scene.add.ellipse(-4, 0, 12, 8, dark))
    } else if (look.tail === 'long') {
      this.tail.add(scene.add.rectangle(0, 0, 30, 6, dark).setOrigin(1, 0.5))
    } else {
      const g = scene.add.graphics()
      g.lineStyle(6, dark)
      g.beginPath()
      g.arc(-8, -4, 8, Math.PI * 0.4, Math.PI * 2.2, false)
      g.strokePath()
      this.tail.add(g)
    }
    this.container.add(this.tail)

    // Kopf
    this.head = scene.add.container(34, -52)
    this.head.add(scene.add.circle(0, 0, 15, coat))
    if (look.pattern === 'patch') this.head.add(scene.add.circle(6, -4, 8, patternColor))
    this.head.add(scene.add.ellipse(14, 5, 20, 13, light))
    this.head.add(scene.add.circle(23, 3, 3.5, 0x1a1a1a))
    this.eyeOpen = scene.add.circle(7, -4, 2.6, 0x1a1a1a)
    this.eyeClosed = scene.add.rectangle(7, -4, 7, 2, 0x1a1a1a)
    this.head.add([this.eyeOpen, this.eyeClosed])
    if (look.ear === 'floppy') {
      const ear = scene.add.ellipse(-6, 4, 11, 24, dark)
      ear.setRotation(0.25)
      this.head.add(ear)
    } else if (look.ear === 'pointy') {
      this.head.add(scene.add.triangle(-5, -13, -9, 8, 0, -10, 9, 8, dark))
    } else {
      this.head.add(scene.add.circle(-6, -12, 8, dark))
    }
    this.container.add(this.head)

    this.zzz = scene.add.text(40, -78, 'Z', { fontSize: '18px', color: '#ffffff', fontStyle: 'bold', resolution: 3, fontFamily: 'Arial, Helvetica, sans-serif' })
    this.container.add(this.zzz)

    this.container.setScale(look.size)
    this.setPose('sit')
  }

  setPose(pose: Pose): void {
    this.pose = pose
    this.phase = 0
    const sleeping = pose === 'sleep'
    this.shut = sleeping
    this.eyeOpen.setVisible(!sleeping)
    this.eyeClosed.setVisible(sleeping)
    this.zzz.setVisible(sleeping)
    this.layout(0)
  }

  private collar: Phaser.GameObjects.Rectangle | null = null

  // Halsband in der gekauften Farbe, null entfernt es.
  setCollar(color: number | null): void {
    this.collar?.destroy()
    this.collar = null
    if (color === null) return
    const c = this.container.scene.add.rectangle(23, -33, 8, 15, color).setStrokeStyle(1, 0x000000, 0.35).setAngle(-12)
    this.container.add(c)
    this.collar = c
  }

  private medal: Phaser.GameObjects.Container | null = null

  // Medaille am Halsband (Farbe der hoechsten gewonnenen Liga), null entfernt sie.
  setMedal(color: number | null): void {
    this.medal?.destroy()
    this.medal = null
    if (color === null) return
    const m = this.container.scene.add.container(24, -36)
    m.add(this.container.scene.add.rectangle(0, -3, 3, 7, 0xc62828))
    m.add(this.container.scene.add.circle(0, 2, 4.5, color).setStrokeStyle(1, 0x000000, 0.4))
    this.container.add(m)
    this.medal = m
  }

  private feeling: Feeling = 'ok'

  // Stimmung am Koerper: froehlich wedelt schnell und weit, traurig haengt Schwanz und Kopf, genussvoll schliesst die Augen.
  setFeeling(f: Feeling): void {
    if (f === this.feeling) return
    this.feeling = f
    const sleeping = this.pose === 'sleep'
    this.shut = sleeping || f === 'blissful'
    this.eyeOpen.setVisible(!sleeping && f !== 'blissful')
    this.eyeClosed.setVisible(sleeping || f === 'blissful')
  }

  private ageScale = 1

  // Altersstufe (Welpe kleiner), bleibt beim Umdrehen erhalten.
  setAge(scale: number): void {
    this.ageScale = scale
    this.face(this.dir)
  }

  face(dir: -1 | 1): void {
    this.dir = dir
    const k = this.look.size * this.ageScale
    this.container.setScale(k * dir, k)
  }

  update(dtMs: number): void {
    this.phase += clampDelta(dtMs)
    this.layout(this.phase)
    this.idle()
  }

  // Kleine Lebenszeichen: Blinzeln alle paar Sekunden und leises Atmen.
  private idle(): void {
    if (!this.shut) {
      const blink = (this.phase + this.blinkOff) % 4300 < 140
      this.eyeOpen.setVisible(!blink)
      this.eyeClosed.setVisible(blink)
    }
    this.body.scaleY = 1 + Math.sin(this.phase * 0.004) * 0.022
  }

  private layout(t: number): void {
    const swing = Math.sin(t * 0.012)
    const f = this.feeling
    const wagSpeed = f === 'blissful' ? 0.045 : f === 'happy' ? 0.032 : f === 'sad' ? 0.008 : 0.02
    const wagAmp = f === 'blissful' ? 1.7 : f === 'happy' ? 1.5 : f === 'sad' ? 0.3 : 1
    const wag = Math.sin(t * wagSpeed) * wagAmp
    const tailLift = f === 'happy' || f === 'blissful' ? -0.25 : f === 'sad' ? 0.6 : 0
    const headDrop = f === 'sad' ? 0.18 : f === 'blissful' ? -0.22 : 0
    const [h1, h2, f1, f2] = this.legs
    const setLegs = (a: number, b: number, c: number, d: number, len = LEG_LEN) => {
      for (const [leg, angle] of [[h1, a], [h2, b], [f1, c], [f2, d]] as const) {
        leg.setRotation(angle)
        leg.height = len
      }
    }
    const setBody = (y: number, angle: number) => {
      this.body.setPosition(0, y).setRotation(angle)
      for (const { obj, baseY } of this.patternShapes) obj.setY(baseY + (y + 36))
    }

    switch (this.pose) {
      case 'walk':
        setBody(-36 + Math.sin(t * 0.024) * 1.5, 0)
        setLegs(swing * 0.6, -swing * 0.6, -swing * 0.6, swing * 0.6)
        this.head.setPosition(34, -52 + Math.sin(t * 0.024) * 1.5).setRotation(headDrop)
        this.tail.setRotation(-0.5 + tailLift + wag * 0.35)
        break
      case 'sit':
        setBody(-30, -0.5)
        setLegs(-1.4, -1.4, 0, 0)
        this.head.setPosition(28, -60).setRotation(-0.1 + headDrop)
        this.tail.setPosition(-30, -26).setRotation(-0.2 + tailLift + wag * 0.3)
        break
      case 'sleep':
        setBody(-17, 0)
        setLegs(-1.5, -1.5, -1.5, -1.5, 14)
        this.head.setPosition(36, -22).setRotation(0.3)
        this.tail.setPosition(-30, -22).setRotation(0.4)
        this.zzz.setPosition(46, -64 - ((t * 0.02) % 14)).setAlpha(1 - ((t * 0.02) % 14) / 14)
        break
      case 'sniff':
        setBody(-34, 0.08)
        setLegs(0.1, -0.1, 0.15, -0.15)
        this.head.setPosition(40 + Math.sin(t * 0.03) * 1.5, -30).setRotation(0.7)
        this.tail.setRotation(-0.4 + wag * 0.2)
        break
    }
    if (this.pose !== 'sit') this.tail.setPosition(-30, this.pose === 'sleep' ? -22 : -42)
  }

  getPose(): Pose {
    return this.pose
  }

  getDir(): -1 | 1 {
    return this.dir
  }

  destroy(): void {
    this.container.destroy()
  }
}
