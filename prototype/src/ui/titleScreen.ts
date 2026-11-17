import type { Session } from '../session'
import { openSettings } from './settings'

// Startbildschirm nach dem Login.
export function showTitleScreen(session: Session): Promise<void> {
  return new Promise((resolve) => {
    const ui = document.getElementById('ui') as HTMLElement
    ui.className = 'title'
    ui.style.display = 'flex'
    const card = document.createElement('div')
    card.className = 'card'
    const h = document.createElement('h1')
    h.textContent = 'Hundespiel'
    const p = document.createElement('p')
    p.className = 'sub'
    p.textContent = `Hallo ${session.displayName}!`
    const play = document.createElement('button')
    play.textContent = 'Spielen'
    play.addEventListener('click', () => { ui.style.display = 'none'; ui.className = ''; resolve() })
    const set = document.createElement('button')
    set.className = 'alt'
    set.textContent = 'Einstellungen'
    set.addEventListener('click', () => openSettings({ householdId: session.householdId }))
    card.append(h, p, play, set)
    ui.replaceChildren(card)
  })
}
