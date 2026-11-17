import type { Mood, Needs } from '../dog/needs'

export interface HudState {
  dogs: { id: string; name: string }[]
  selectedId: string | null
  needs: Needs | null
  mood: Mood | null
  activity: string[]
  busy: boolean
  message: string
}

export interface HudActions {
  onSelect(id: string): void
  onCare(action: 'feed' | 'pet'): void
  loadInviteCode(): Promise<string>
}

const MOOD_TEXT: Record<Mood, string> = { happy: 'glücklich', ok: 'zufrieden', hungry: 'hungrig', tired: 'müde', sad: 'traurig' }
const BARS: [keyof Needs, string, string][] = [
  ['hunger', 'Hunger', '#e08a3c'],
  ['energy', 'Energie', '#3c9be0'],
  ['happiness', 'Glück', '#e0568a'],
]

export function createHud(actions: HudActions): { render(s: HudState): void } {
  const root = document.getElementById('hud') as HTMLElement
  root.style.display = 'block'
  root.innerHTML = `
    <div class="hud-panel">
      <div class="tabs"></div>
      <div class="mood"></div>
      <div class="bars"></div>
      <div class="row"><button id="feed">Füttern</button><button id="pet" class="alt">Streicheln</button><button id="code" class="tab">Code</button></div>
      <p class="hud-msg"></p>
    </div>
    <div class="hud-log"></div>`
  const tabs = root.querySelector('.tabs') as HTMLElement
  const moodEl = root.querySelector('.mood') as HTMLElement
  const bars = root.querySelector('.bars') as HTMLElement
  const msg = root.querySelector('.hud-msg') as HTMLElement
  const log = root.querySelector('.hud-log') as HTMLElement
  const feed = root.querySelector('#feed') as HTMLButtonElement
  const pet = root.querySelector('#pet') as HTMLButtonElement
  const codeBtn = root.querySelector('#code') as HTMLButtonElement
  codeBtn.addEventListener('click', async () => {
    if (codeBtn.textContent !== 'Code') { codeBtn.textContent = 'Code'; return }
    try { codeBtn.textContent = await actions.loadInviteCode() } catch { codeBtn.textContent = 'Code' }
  })
  feed.addEventListener('click', () => actions.onCare('feed'))
  pet.addEventListener('click', () => actions.onCare('pet'))

  const text = (s: string): Text => document.createTextNode(s)

  return {
    render(s: HudState): void {
      tabs.replaceChildren(
        ...s.dogs.map((d) => {
          const b = document.createElement('button')
          b.className = d.id === s.selectedId ? 'tab on' : 'tab'
          b.appendChild(text(d.name))
          b.addEventListener('click', () => actions.onSelect(d.id))
          return b
        }),
      )
      moodEl.textContent = s.mood ? MOOD_TEXT[s.mood] : ''
      bars.replaceChildren(
        ...BARS.map(([key, label, color]) => {
          const value = s.needs ? Math.round(s.needs[key]) : 0
          const row = document.createElement('div')
          row.className = 'bar-row'
          const name = document.createElement('span')
          name.textContent = label
          const track = document.createElement('div')
          track.className = 'track'
          const fill = document.createElement('div')
          fill.className = 'fill'
          fill.style.width = `${value}%`
          fill.style.background = color
          track.appendChild(fill)
          row.append(name, track)
          return row
        }),
      )
      feed.disabled = pet.disabled = s.busy || s.selectedId === null
      msg.textContent = s.message
      log.replaceChildren(...s.activity.map((a) => {
        const line = document.createElement('div')
        line.textContent = a
        return line
      }))
    },
  }
}
