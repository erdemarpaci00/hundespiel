import { openSettings } from './settings'

export interface HudActions {
  householdId: string
  getActivity(): string[]
}

// Im Spiel bleibt nur ein Zahnrad und eine kurze Meldung, kein Dauer-Anzeigen von Werten.
export function createHud(actions: HudActions): { toast(text: string): void } {
  const root = document.getElementById('hud') as HTMLElement
  root.style.display = 'block'
  root.innerHTML = '<button id="gear" aria-label="Einstellungen">⚙</button><div id="toast"></div>'
  const toastEl = root.querySelector('#toast') as HTMLElement
  root.querySelector('#gear')!.addEventListener('click', () => openSettings({ householdId: actions.householdId, getActivity: actions.getActivity }))
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
