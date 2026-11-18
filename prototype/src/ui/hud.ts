import { PLACES } from '../scenes/places'
import { claimDaily, loadDaily, loadEconomy } from '../economy'
import { DAILY_TASKS, readyCount, taskStatus } from '../daily'
import { friendlyError } from '../errors'
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
  root.innerHTML = '<button id="gear" aria-label="Einstellungen">⚙</button><button id="map" aria-label="Karte">🗺</button><button id="book" aria-label="Tagesbuch">📖</button><div id="stats"></div><div id="toast"></div><div id="hotbar">' + SLOTS.map(([t, icon, label]) => `<button data-tool="${t}" aria-label="${label}"><b>${icon}</b><small>${label}</small><i></i></button>`).join('') + '</div>'
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
  const bookBtn = root.querySelector('#book') as HTMLElement
  const refreshBook = (): void => {
    void loadDaily().then((d) => bookBtn.classList.toggle('ready', readyCount(d) > 0)).catch(() => { /* ohne Netz bleibt es */ })
  }
  bookBtn.addEventListener('click', () => void openBook())
  const openBook = async (): Promise<void> => {
    document.getElementById('settings')?.remove()
    let d
    try { d = await loadDaily() } catch (e) { toastEl.textContent = e instanceof Error ? e.message : 'Das Tagesbuch lässt sich gerade nicht laden'; toastEl.style.opacity = '1'; return }
    const overlay = document.createElement('div')
    overlay.id = 'settings'
    const card = document.createElement('div')
    card.className = 'card'
    const h = document.createElement('h1')
    h.textContent = 'Tagesbuch'
    card.appendChild(h)
    const sub = document.createElement('div')
    sub.className = 'task'
    sub.innerHTML = `<small>Gilt für euch beide. Serie: ${d.streak} ${d.streak === 1 ? 'Tag' : 'Tage'} in Folge. Alle drei: +10 Münzen, an Tag 3 und 7 mehr.</small>`
    card.appendChild(sub)
    DAILY_TASKS.forEach((t, i) => {
      const st = taskStatus(d, i)
      const row = document.createElement('div')
      row.className = 'task' + (st === 'done' ? ' done' : '')
      const text = document.createElement('div')
      text.innerHTML = `${t.label}<br><small>${Math.min(d.have[i] ?? 0, t.need)} von ${t.need}</small>`
      row.appendChild(text)
      const b = document.createElement('button')
      b.textContent = st === 'done' ? '✓' : st === 'ready' ? '+5 holen' : '…'
      b.disabled = st !== 'ready'
      b.addEventListener('click', () => {
        b.disabled = true
        void claimDaily(i + 1).then((r) => {
          overlay.remove()
          toastEl.textContent = r.bonus > 0 ? `+${r.reward} Münzen und ${r.bonus} Bonus für das ganze Tagesbuch` : `+${r.reward} Münzen`
          toastEl.style.opacity = '1'
          refresh()
          refreshBook()
        }).catch((e) => { toastEl.textContent = friendlyError(e instanceof Error ? e.message : String(e)); toastEl.style.opacity = '1'; b.disabled = false })
      })
      row.appendChild(b)
      card.appendChild(row)
    })
    const close = document.createElement('button')
    close.className = 'tab'
    close.textContent = 'Zurück'
    close.addEventListener('click', () => overlay.remove())
    card.appendChild(close)
    overlay.appendChild(card)
    document.body.appendChild(overlay)
  }
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
  refreshBook()
  const poll = window.setInterval(() => { refresh(); refreshBook() }, 15000)
  const stop = new MutationObserver(() => { if (!document.body.contains(statsEl)) { window.clearInterval(poll); stop.disconnect() } })
  stop.observe(document.body, { childList: true, subtree: true })
  // Meldungen laufen nacheinander (mindestens 2 s je Meldung), damit keine verschluckt wird.
  const queue: string[] = []
  let busy = false
  const next = (): void => {
    const text = queue.shift()
    if (text === undefined) { busy = false; toastEl.style.opacity = '0'; return }
    busy = true
    toastEl.textContent = text
    toastEl.style.opacity = '1'
    window.setTimeout(next, queue.length > 0 ? 2000 : 4000)
  }
  return {
    refresh,
    setTool,
    showHotbar(v: boolean): void { hotbar.style.display = v ? 'flex' : 'none' },
    toast(text: string): void {
      if (queue[queue.length - 1] === text || (!busy && toastEl.textContent === text && toastEl.style.opacity === '1')) return
      queue.push(text)
      if (queue.length > 4) queue.shift()
      if (!busy) next()
    },
  }
}
