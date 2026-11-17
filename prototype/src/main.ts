import Phaser from 'phaser'
import { loadDogs } from './dogRepo'
import { GardenScene } from './scenes/GardenScene'
import { PickerScene } from './scenes/PickerScene'
import { friendlyError } from './errors'
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
