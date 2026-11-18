import { buildShop } from './shop'
import { isMuted, setMuted, cue } from '../feedback'
import { loadInviteCode, signOut } from '../session'

export interface SettingsOptions {
  householdId: string
  getActivity?: () => string[]
}

// Einstellungsfenster: Einladungscode, Verlauf, Vollbild, Abmelden.
export function openSettings(opts: SettingsOptions): void {
  document.getElementById('settings')?.remove()
  const overlay = document.createElement('div')
  overlay.id = 'settings'
  const card = document.createElement('div')
  card.className = 'card'
  const h = document.createElement('h1')
  h.textContent = 'Einstellungen'
  card.appendChild(h)

  const codeBtn = document.createElement('button')
  codeBtn.className = 'alt'
  codeBtn.textContent = 'Einladungscode anzeigen'
  codeBtn.addEventListener('click', async () => {
    try { codeBtn.textContent = `Code: ${await loadInviteCode(opts.householdId)}` } catch { codeBtn.textContent = 'Keine Verbindung, bitte nochmal' }
  })
  card.appendChild(codeBtn)

  const shop = buildShop()
  const shopTitle = document.createElement('div')
  shopTitle.className = 'sub'
  shopTitle.textContent = 'Laden'
  card.append(shopTitle, shop)

  const lines = opts.getActivity?.() ?? []
  if (opts.getActivity) {
    const title = document.createElement('div')
    title.className = 'sub'
    title.textContent = 'Zuletzt passiert'
    const list = document.createElement('div')
    list.className = 'verlauf'
    if (lines.length === 0) list.textContent = 'Noch nichts'
    for (const l of lines) {
      const d = document.createElement('div')
      d.textContent = l
      list.appendChild(d)
    }
    card.append(title, list)
  }

  const snd = document.createElement('button')
  const label = (): string => (isMuted() ? 'Ton und Vibration: aus' : 'Ton und Vibration: an')
  snd.textContent = label()
  snd.addEventListener('click', () => { setMuted(!isMuted()); snd.textContent = label(); cue('good') })
  const btnrow = document.createElement('div')
  btnrow.className = 'btnrow'
  btnrow.appendChild(snd)

  if (document.fullscreenEnabled) {
    const fs = document.createElement('button')
    fs.textContent = document.fullscreenElement ? 'Vollbild beenden' : 'Vollbild'
    fs.addEventListener('click', async () => {
      try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen() } catch { /* nicht erlaubt */ }
      overlay.remove()
    })
    btnrow.appendChild(fs)
  }

  const out = document.createElement('button')
  out.className = 'danger'
  out.textContent = 'Abmelden'
  out.addEventListener('click', async () => { try { await signOut() } finally { location.reload() } })
  const close = document.createElement('button')
  close.className = 'tab'
  close.textContent = 'Zurück'
  close.addEventListener('click', () => overlay.remove())
  btnrow.append(out, close)
  card.appendChild(btnrow)
  overlay.appendChild(card)
  document.body.appendChild(overlay)
}
