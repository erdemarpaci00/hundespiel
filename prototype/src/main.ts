import Phaser from 'phaser'
import { loadDogs } from './dogRepo'
import { GardenScene } from './scenes/GardenScene'
import { PickerScene } from './scenes/PickerScene'
import { runAuthFlow } from './ui/authScreen'

async function start(): Promise<void> {
  const session = await runAuthFlow()
  const dogs = await loadDogs(session)
  const hasOwnStarter = dogs.some((d) => d.isStarter && d.pickedBy === session.userId)
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: 1920,
    height: 1080,
    backgroundColor: '#6bbf59',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    // Die erste Szene startet von selbst.
    scene: hasOwnStarter ? [GardenScene, PickerScene] : [PickerScene, GardenScene],
    callbacks: { preBoot: (g) => g.registry.set('session', session) },
  })
  void game
}

void start()
