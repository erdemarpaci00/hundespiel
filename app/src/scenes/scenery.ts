import Phaser from 'phaser'
import { mulberry32 } from '../util/rng'

// Alles in Welt-Koordinaten 640x360, nur gezeichnete Formen, keine fremden Dateien.
export function drawScenery(scene: Phaser.Scene): { sun: Phaser.GameObjects.Graphics; clouds: Phaser.GameObjects.Graphics } {
  const g = scene.add.graphics().setDepth(0)
  const rng = mulberry32(7)

  // Himmel mit Verlauf
  scene.add.graphics().setDepth(-1).fillGradientStyle(0x6ec6ff, 0x6ec6ff, 0xcdeeff, 0xcdeeff, 1).fillRect(0, 0, 640, 150)

  const sun = scene.add.graphics().setDepth(-0.5)
  sun.fillStyle(0xfff3a0, 0.25).fillCircle(560, 46, 40)
  sun.fillStyle(0xfff3a0, 0.4).fillCircle(560, 46, 30)
  sun.fillStyle(0xffd84a, 1).fillCircle(560, 46, 22)

  const clouds = scene.add.graphics().setDepth(-0.5)
  for (const [cx, cy, s] of [[110, 40, 1], [300, 70, 0.8], [440, 30, 0.7]]) {
    clouds.fillStyle(0xffffff, 0.95)
    clouds.fillCircle(cx, cy, 16 * s).fillCircle(cx + 18 * s, cy + 4 * s, 13 * s)
    clouds.fillCircle(cx - 18 * s, cy + 5 * s, 12 * s).fillRect(cx - 18 * s, cy + 4 * s, 36 * s, 13 * s)
  }

  // Ferne Huegel
  g.fillStyle(0x8fd08a).fillEllipse(120, 150, 300, 70).fillEllipse(430, 152, 360, 60)
  g.fillStyle(0x79c276).fillEllipse(290, 152, 320, 40)

  // Baeume hinter dem Zaun
  for (const tx of [60, 250, 600]) {
    g.fillStyle(0x7a4e2a).fillRect(tx - 5, 96, 10, 44)
    g.fillStyle(0x3f9b4a).fillCircle(tx, 84, 26).fillCircle(tx - 18, 98, 18).fillCircle(tx + 18, 98, 18)
    g.fillStyle(0x56b25e, 0.8).fillCircle(tx - 7, 76, 13)
  }

  // Wiese mit Maehstreifen
  g.fillStyle(0x6fc45a).fillRect(0, 150, 640, 210)
  for (let i = 0; i < 8; i++) {
    g.fillStyle(0x62b94e, 0.55).fillRect(i * 80, 150, 40, 210)
  }

  // Zaun mit spitzen Brettern
  g.fillStyle(0xc99a5b)
  g.fillRect(0, 124, 640, 7).fillRect(0, 144, 640, 7)
  for (let x = 6; x < 640; x += 26) {
    g.fillStyle(0xdcae6d).fillRect(x, 108, 14, 52)
    g.fillStyle(0xdcae6d).fillTriangle(x, 108, x + 14, 108, x + 7, 98)
    g.fillStyle(0xa8793f, 0.5).fillRect(x + 11, 108, 3, 52)
  }
  g.fillStyle(0x4c9b3a, 0.6).fillRect(0, 158, 640, 6)

  // Sandweg zu Napf und Huette
  g.fillStyle(0xe9d7a4, 0.9).fillEllipse(120, 222, 150, 34).fillEllipse(520, 214, 130, 30)

  // Grasbueschel und Blumen
  for (let i = 0; i < 70; i++) {
    const x = rng() * 640, y = 170 + rng() * 185
    g.fillStyle(0x4c9b3a)
    g.fillTriangle(x - 4, y, x - 1, y - 9, x + 1, y).fillTriangle(x, y, x + 3, y - 11, x + 6, y)
  }
  const petals = [0xff7aa8, 0xffffff, 0xffe05a, 0xb48cff]
  for (let i = 0; i < 28; i++) {
    const x = rng() * 640, y = 175 + rng() * 180
    g.fillStyle(petals[i % petals.length]).fillCircle(x - 2, y, 2.4).fillCircle(x + 2, y, 2.4)
    g.fillCircle(x, y - 2, 2.4).fillCircle(x, y + 2, 2.4)
    g.fillStyle(0xffd84a).fillCircle(x, y, 1.6)
  }

  // Hundehuette
  g.fillStyle(0xb5532a).fillRect(500, 168, 56, 38)
  g.fillStyle(0x8f3f1f).fillTriangle(494, 170, 562, 170, 528, 142)
  g.fillStyle(0x2b1a12).fillCircle(528, 195, 11).fillRect(517, 195, 22, 11)
  g.fillStyle(0xdd6b3c, 0.5).fillRect(500, 168, 8, 38)

  // Napf und Wassernapf
  g.fillStyle(0x3b6ea5).fillEllipse(96, 222, 30, 10)
  g.fillStyle(0x4f8bd0).fillEllipse(96, 219, 30, 10)
  g.fillStyle(0x8fd0ff).fillEllipse(96, 219, 22, 6)
  g.fillStyle(0xa23b2a).fillEllipse(138, 224, 30, 10)
  g.fillStyle(0xc4553f).fillEllipse(138, 221, 30, 10)
  g.fillStyle(0x7a4a2a).fillEllipse(138, 220, 22, 6)
  return { sun, clouds }
}
