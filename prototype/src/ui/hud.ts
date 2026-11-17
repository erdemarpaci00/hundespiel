import { PLACES } from '../scenes/places'
import { openSettings } from './settings'

export interface HudActions {
  householdId: string
  getActivity(): string[]
  travel(key: string): void
  current: string
}

// Im Spiel bleibt nur ein Zahnrad und eine kurze Meldung, kein Dauer-Anzeigen von Werten.
export function createHud(actions: HudActions): { toast(text: string): void } {
  const root = document.getElementById('hud') as HTMLElement
  root.style.display = 'block'
  root.innerHTML = '<button id="gear" aria-label="Einstellungen">⚙</button><button id="map" aria-label="Karte">🗺</button><div id="toast"></div>'
  const toastEl = root.querySelector('#toast') as HTMLElement
  root.querySelector('#gear')!.addEventListener('click', () => openSettings({ householdId: actions.householdId, getActivity: actions.getActivity }))
  root.querySelector('#map')!.addEventListener('click', () => {
    document.getElementById('settings')?.remove()
    const overlay = document.createElement('div')
    overlay.id = 'settings'
    const card = document.createElement('div')
    card.className = 'card'
    const h = document.createElement('h1')
    h.textContent = 'Wohin?'
    card.appendChild(h)
    for (const pl of PLACES) {
      const b = document.createElement('button')
      b.textContent = pl.label
      if (pl.key === actions.current) b.className = 'alt'
      b.addEventListener('click', () => { overlay.remove(); if (pl.key !== actions.current) actions.travel(pl.key) })
      card.appendChild(b)
    }
    const close = document.createElement('button')
    close.className = 'tab'
    close.textContent = 'Zurück'
    close.addEventListener('click', () => overlay.remove())
    card.appendChild(close)
    overlay.appendChild(card)
    document.body.appendChild(overlay)
  })
  let timer: number | undefined
  return {
    toast(text: string): void {
      toastEl.textContent = text
      toastEl.style.opacity = '1'
      window.clearTimeout(timer)
      timer = window.setTimeout(() => { toastEl.style.opacity = '0' }, 4000)
    },
  }
}
