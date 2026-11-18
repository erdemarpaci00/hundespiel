import Phaser from 'phaser'
import { loadDogs } from './dogRepo'
import { GardenScene } from './scenes/GardenScene'
import { WalkScene } from './scenes/WalkScene'
import { ArenaScene } from './scenes/ArenaScene'
import { PlaceScene } from './scenes/PlaceScene'
import { PickerScene } from './scenes/PickerScene'
import { friendlyError } from './errors'
import { runAuthFlow } from './ui/authScreen'
import { showTitleScreen } from './ui/titleScreen'

async function start(): Promise<void> {
  const session = await runAuthFlow()
  const dogs = await loadDogs(session)
  await showTitleScreen(session)
  const hasOwnStarter = dogs.some((d) => d.isStarter && d.pickedBy === session.userId)
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: 1920,
    height: 1080,
    backgroundColor: '#6bbf59',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    // Die erste Szene startet von selbst.
    scene: [...(hasOwnStarter ? [GardenScene, PickerScene] : [PickerScene, GardenScene]), ...(['shop', 'kennel', 'training'] as const).map((k) => new PlaceScene(k)), new ArenaScene(), new WalkScene()],
    callbacks: { preBoot: (g) => g.registry.set('session', session) },
  })
  // Nur zum Testen: mit ?debug in der Adresse ist das Spiel von aussen erreichbar.
  if (location.search.includes('debug')) (window as unknown as { __game: Phaser.Game }).__game = game
}

// Scheitert der Start (zum Beispiel kein Netz), steht sonst eine leere Flaeche da, und die installierte App hat keinen Neu-laden-Knopf.
function showStartError(e: unknown): void {
  const ui = document.getElementById('ui') as HTMLElement
  ui.className = ''
  ui.style.display = 'flex'
  const card = document.createElement('div')
  card.className = 'card'
  const h = document.createElement('h1')
  h.textContent = 'Das Spiel konnte nicht starten'
  const p = document.createElement('p')
  p.className = 'msg'
  p.textContent = friendlyError(e instanceof Error ? e.message : undefined)
  const b = document.createElement('button')
  b.textContent = 'Neu laden'
  b.addEventListener('click', () => location.reload())
  card.append(h, p, b)
  ui.replaceChildren(card)
}

start().catch(showStartError)
