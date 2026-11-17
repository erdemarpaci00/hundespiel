import Phaser from 'phaser'
import { randomPersonality } from '../dog/behavior'
import { DogSprite, type Pose } from '../dog/dogSprite'
import { LivingDog } from '../dog/livingDog'
import { randomLook } from '../dog/look'
import { GARDEN_BOUNDS } from '../garden'
import { mulberry32 } from '../util/rng'

export class GardenScene extends Phaser.Scene {
  private poseDogs: DogSprite[] = []
  private dogs: LivingDog[] = []

  constructor() {
    super('garden')
  }

  create() {
    const g = this.add.graphics()
    g.fillStyle(0x9fd8f5).fillRect(0, 0, 640, 150)
    g.fillStyle(0x6bbf59).fillRect(0, 150, 640, 210)
    g.fillStyle(0x8b5a2b)
    for (let x = 0; x < 640; x += 30) g.fillRect(x + 4, 112, 18, 44)
    g.fillRect(0, 126, 640, 8).fillRect(0, 146, 640, 8)

    const params = new URLSearchParams(location.search)
    if (params.get('demo') === 'poses') {
      const poses: Pose[] = ['walk', 'sit', 'sleep', 'sniff']
      poses.forEach((pose, i) => {
        const d = new DogSprite(this, randomLook(mulberry32(i + 1)), 95 + i * 150, 270)
        d.setPose(pose)
        this.poseDogs.push(d)
      })
      return
    }

    const seed = params.get('seed')
    this.spawnPuppies(seed === null ? Math.floor(Math.random() * 1e9) : Number(seed))

    const button = this.add
      .text(320, 352, 'Neue Welpen', {
        fontSize: '16px', color: '#ffffff', backgroundColor: '#2b6cb0', padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5, 1)
      .setDepth(2000)
      .setInteractive({ useHandCursor: true })
    button.on('pointerdown', () => this.spawnPuppies(Math.floor(Math.random() * 1e9)))
    this.input.keyboard?.on('keydown-N', () => this.spawnPuppies(Math.floor(Math.random() * 1e9)))
  }

  private spawnPuppies(seed: number): void {
    for (const d of this.dogs) d.destroy()
    this.dogs = []
    const rng = mulberry32(seed)
    const starts = [{ x: 140, y: 260 }, { x: 320, y: 310 }, { x: 500, y: 250 }]
    for (const start of starts) {
      this.dogs.push(new LivingDog(this, randomLook(rng), randomPersonality(rng), GARDEN_BOUNDS, start, rng))
    }
  }

  update(_time: number, delta: number) {
    for (const d of this.poseDogs) d.update(delta)
    for (const d of this.dogs) d.update(delta)
  }
}
