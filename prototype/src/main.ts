import Phaser from 'phaser'
import { GardenScene } from './scenes/GardenScene'

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 360,
  height: 640,
  backgroundColor: '#6bbf59',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [GardenScene],
})
