import Phaser from 'phaser'
import { randomPersonality } from '../dog/behavior'
import { DogSprite, type Pose } from '../dog/dogSprite'
import { LivingDog } from '../dog/livingDog'
import { randomLook } from '../dog/look'
import { GARDEN_BOUNDS } from '../garden'
import { drawScenery } from './scenery'
import { mulberry32 } from '../util/rng'

export class GardenScene extends Phaser.Scene {
  private poseDogs: DogSprite[] = []
  private dogs: LivingDog[] = []

  constructor() {
    super('garden')
  }

  create() {
    // Welt ist 640x360, gerendert wird 3-fach scharf auf 1920x1080
    this.cameras.main.setZoom(3).centerOn(320, 180)
    drawScenery(this)

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
        fontSize: '16px', color: '#ffffff', backgroundColor: '#2b6cb0', padding: { x: 14, y: 8 }, resolution: 3, fontFamily: 'Arial, Helvetica, sans-serif',
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
