import { PLACES } from '../scenes/places'
import { loadEconomy } from '../economy'
import { openSettings } from './settings'

export type Tool = 'hand' | 'futter' | 'leckerli' | 'ball' | 'buerste'

export interface HudActions {
  onEconomy?(items: Record<string, number>): void
  onTool?(t: Tool): void
  householdId: string
  getActivity(): string[]
  travel(key: string): void
  current: string
}

const SLOTS: [Tool, string, string][] = [['hand', '✋', 'Hand'], ['futter', '🍖', 'Futter'], ['leckerli', '🦴', 'Leckerli'], ['ball', '🎾', 'Ball'], ['buerste', '🪥', 'Bürste']]

// Im Spiel bleibt nur ein Zahnrad und eine kurze Meldung, kein Dauer-Anzeigen von Werten.
export function createHud(actions: HudActions): { toast(text: string): void; refresh(): void; setTool(t: Tool): void; showHotbar(v: boolean): void } {
  const root = document.getElementById('hud') as HTMLElement
  root.style.display = 'block'
  root.innerHTML = '<button id="gear" aria-label="Einstellungen">⚙</button><button id="map" aria-label="Karte">🗺</button><div id="stats"></div><div id="toast"></div><div id="hotbar">' + SLOTS.map(([t, icon, label]) => `<button data-tool="${t}" aria-label="${label}"><b>${icon}</b><small>${label}</small><i></i></button>`).join('') + '</div>'
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
  const hotbar = root.querySelector('#hotbar') as HTMLElement
  const slotOf = (t: Tool): HTMLElement => hotbar.querySelector(`[data-tool="${t}"]`) as HTMLElement
  const setTool = (t: Tool): void => { for (const [k] of SLOTS) slotOf(k).classList.toggle('on', k === t) }
  setTool('hand')
  if (!actions.onTool) hotbar.style.display = 'none'
  hotbar.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest('button')
    if (b) actions.onTool?.(b.dataset.tool as Tool)
  })
  const refresh = (): void => {
    void loadEconomy().then((eco) => {
      statsEl.innerHTML = `<span><i class="coin"></i>${eco.coins}</span>`
      for (const [t] of SLOTS) {
        if (t === 'hand') continue
        const n = eco.items[t] ?? 0
        const el = slotOf(t)
        el.classList.toggle('off', n < 1)
        ;(el.querySelector('i') as HTMLElement).textContent = t === 'futter' || t === 'leckerli' ? String(n) : n < 1 ? '🔒' : ''
      }
      actions.onEconomy?.(eco.items)
    }).catch(() => { /* ohne Netz bleibt die letzte Anzeige */ })
  }
  refresh()
  const poll = window.setInterval(refresh, 15000)
  const stop = new MutationObserver(() => { if (!document.body.contains(statsEl)) { window.clearInterval(poll); stop.disconnect() } })
  stop.observe(document.body, { childList: true, subtree: true })
  let timer: number | undefined
  return {
    refresh,
    setTool,
    showHotbar(v: boolean): void { hotbar.style.display = v ? 'flex' : 'none' },
    toast(text: string): void {
      toastEl.textContent = text
      toastEl.style.opacity = '1'
      window.clearTimeout(timer)
      timer = window.setTimeout(() => { toastEl.style.opacity = '0' }, 4000)
    },
  }
}
