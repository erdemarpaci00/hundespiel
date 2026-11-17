import Phaser from 'phaser'
import { GardenScene } from './scenes/GardenScene'
import { runAuthFlow } from './ui/authScreen'

async function start(): Promise<void> {
  const session = await runAuthFlow()
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: 1920,
    height: 1080,
    backgroundColor: '#6bbf59',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [GardenScene],
  })
  game.registry.set('session', session)
}

void start()
