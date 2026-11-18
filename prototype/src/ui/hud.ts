import { PLACES } from '../scenes/places'
import { loadEconomy } from '../economy'
import { openSettings } from './settings'

export interface HudActions {
  householdId: string
  getActivity(): string[]
  travel(key: string): void
  current: string
}

// Im Spiel bleibt nur ein Zahnrad und eine kurze Meldung, kein Dauer-Anzeigen von Werten.
export function createHud(actions: HudActions): { toast(text: string): void; refresh(): void } {
  const root = document.getElementById('hud') as HTMLElement
  root.style.display = 'block'
  root.innerHTML = '<button id="gear" aria-label="Einstellungen">⚙</button><button id="map" aria-label="Karte">🗺</button><div id="stats"></div><div id="toast"></div>'
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
  const statsEl = root.querySelector('#stats') as HTMLElement
  const refresh = (): void => {
    void loadEconomy().then((eco) => {
      const n = (k: 'futter' | 'leckerli'): number => eco.items[k] ?? 0
      const own = (k: 'ball' | 'buerste'): string => ((eco.items[k] ?? 0) > 0 ? 'ja' : 'nein')
      statsEl.innerHTML = `<span><i class="coin"></i>${eco.coins}</span><span>Futter ${n('futter')}</span><span>Leckerli ${n('leckerli')}</span><span>Ball ${own('ball')}</span><span>Bürste ${own('buerste')}</span>`
    }).catch(() => { /* ohne Netz bleibt die letzte Anzeige */ })
  }
  refresh()
  const poll = window.setInterval(refresh, 15000)
  const stop = new MutationObserver(() => { if (!document.body.contains(statsEl)) { window.clearInterval(poll); stop.disconnect() } })
  stop.observe(document.body, { childList: true, subtree: true })
  let timer: number | undefined
  return {
    refresh,
    toast(text: string): void {
      toastEl.textContent = text
      toastEl.style.opacity = '1'
      window.clearTimeout(timer)
      timer = window.setTimeout(() => { toastEl.style.opacity = '0' }, 4000)
    },
  }
}
