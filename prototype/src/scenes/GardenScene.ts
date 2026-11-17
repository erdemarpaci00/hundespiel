import Phaser from 'phaser'

export const GARDEN_BOUNDS = { x: 20, y: 300, w: 320, h: 300 }

export class GardenScene extends Phaser.Scene {
  constructor() {
    super('garden')
  }

  create() {
    const g = this.add.graphics()
    g.fillStyle(0x9fd8f5).fillRect(0, 0, 360, 300)
    g.fillStyle(0x6bbf59).fillRect(0, 300, 360, 340)
    g.fillStyle(0x8b5a2b)
    for (let x = 0; x < 360; x += 30) g.fillRect(x + 4, 262, 18, 44)
    g.fillRect(0, 276, 360, 8).fillRect(0, 296, 360, 8)
  }
}
