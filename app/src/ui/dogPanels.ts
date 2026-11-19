import { favoriteLine } from '../activity'
import { bondLabel } from '../dog/bond'
import { ageDays, ageLabel } from '../dog/age'
import { parseTimestamp } from '../time'
import { breedById } from '../dog/breeds'
import { applyElapsed, type Needs } from '../dog/needs'
import { EXERCISE, STAT_KEYS, STAT_LABEL, statValue, type StatKey } from '../dog/stats'
import type { DogRecord } from '../dogRepo'
import { adoptFromKennel, buyCollar, enterContest, trainDog } from '../dogRepo'
import { COLLARS, COLLAR_PRICE } from '../dog/collar'
import { contestWaitMinutes, cupsMissing, eligible, formBonus, LEAGUES, trophyShelf, type League } from '../dog/contest'
import type { Puppy } from '../puppies'
import type { Session } from '../session'
import { friendlyError } from '../errors'

let closedAt = 0

// Ein Tipp auf "Schliessen" darf nicht gleichzeitig den Hund oder das Gehege darunter antippen.
export function dialogJustClosed(): boolean {
  return document.getElementById('settings') !== null || Date.now() - closedAt < 500
}

function overlay(): { overlay: HTMLElement; card: HTMLElement } {
  document.getElementById('settings')?.remove()
  const o = document.createElement('div')
  const realRemove = o.remove.bind(o)
  o.remove = () => { closedAt = Date.now(); realRemove() }
  o.id = 'settings'
  const card = document.createElement('div')
  card.className = 'card'
  o.appendChild(card)
  document.body.appendChild(o)
  return { overlay: o, card }
}

function row(label: string, value: number): HTMLElement {
  const r = document.createElement('div')
  r.className = 'row'
  const l = document.createElement('span')
  l.textContent = label
  const bar = document.createElement('div')
  bar.className = 'bar'
  const fill = document.createElement('i')
  fill.style.width = `${Math.max(0, Math.min(100, value))}%`
  bar.appendChild(fill)
  const v = document.createElement('span')
  v.textContent = String(Math.round(value))
  r.append(l, bar, v)
  return r
}

function heading(text: string): HTMLElement {
  const d = document.createElement('div')
  d.className = 'sub'
  d.textContent = text
  return d
}

function closeButton(o: HTMLElement, label = 'Zurück'): HTMLButtonElement {
  const b = document.createElement('button')
  b.className = 'tab'
  b.textContent = label
  b.addEventListener('click', () => o.remove())
  return b
}

// Zeigerbalken im Fenster: ein Tipp auf "Jetzt!" stoppt den Zeiger. Liefert 0 bis 1 (1 = Mitte). Ohne Tipp nach 6 s: 0.3.
function timingBar(card: HTMLElement, text: string): Promise<number> {
  return new Promise((resolve) => {
    card.replaceChildren()
    const t = document.createElement('div')
    t.className = 'sub'
    t.textContent = text
    const bar = document.createElement('div')
    bar.style.cssText = 'position:relative;height:18px;border-radius:9px;margin:12px 0;background:linear-gradient(90deg,#e05555 0%,#f0c040 20%,#4caf50 40%,#4caf50 60%,#f0c040 80%,#e05555 100%)'
    const cur = document.createElement('div')
    cur.style.cssText = 'position:absolute;top:-4px;width:4px;height:26px;background:#fff;border:1px solid #333;border-radius:2px'
    bar.appendChild(cur)
    const go = document.createElement('button')
    go.textContent = 'Jetzt!'
    card.append(t, bar, go)
    const t0 = performance.now()
    const pos = (): number => 0.5 + 0.5 * Math.sin(((performance.now() - t0) / 1000) * 3.2 - Math.PI / 2)
    let raf = 0
    const tick = (): void => { cur.style.left = `calc(${pos() * 100}% - 2px)`; raf = requestAnimationFrame(tick) }
    tick()
    let done = false
    const finish = (q: number): void => { if (done) return; done = true; cancelAnimationFrame(raf); resolve(q) }
    go.addEventListener('click', () => finish(1 - Math.abs(pos() - 0.5) * 2))
    setTimeout(() => finish(0.3), 6000)
  })
}

// Auswahl eines Hundes aus einer Liste (z.B. Gegner im Duell).
export function pickDog(title: string, dogs: { id: string; name: string }[], onPick: (id: string) => void): void {
  const { overlay: o, card } = overlay()
  const h = document.createElement('h1')
  h.textContent = title
  card.appendChild(h)
  for (const d of dogs) {
    const b = document.createElement('button')
    b.className = 'alt'
    b.textContent = d.name
    b.addEventListener('click', () => { o.remove(); onPick(d.id) })
    card.appendChild(b)
  }
  card.appendChild(closeButton(o, 'Abbrechen'))
}

const TRAITS: [keyof DogRecord['personality'], string][] = [
  ['energy', 'Energie'], ['courage', 'Mut'], ['affection', 'Anhänglichkeit'], ['learning', 'Lernfreude'], ['appetite', 'Appetit'],
]

// Alles ueber einen Hund: Rasse, Charakter, Befinden, Werte. Nur auf Wunsch sichtbar.
export function openDogDetail(dog: DogRecord, needs: Needs, bonds: { name: string; meetings: number }[] = [], onChange?: (d: DogRecord) => void, playContest?: PlayContest, favorite?: string | null, duel?: (d: DogRecord) => void): void {
  const { overlay: o, card } = overlay()
  const h = document.createElement('h1')
  const breed = dog.look.breed ? breedById(dog.look.breed).name : 'Mischling'
  h.textContent = `${dog.name} (${breed})`
  const age = document.createElement('div')
  age.className = 'sub'
  age.textContent = ageLabel(ageDays(parseTimestamp(dog.createdAt), Date.now()))
  const actions = document.createElement('div')
  actions.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin:6px 0'
  const cols = document.createElement('div')
  cols.className = 'cols'
  const left = document.createElement('div')
  const right = document.createElement('div')
  cols.append(left, right)
  card.append(h, age, actions, cols)
  left.appendChild(heading('Werte'))
  for (const k of STAT_KEYS) left.appendChild(row(STAT_LABEL[k], statValue(dog.look.breed, dog.training, k)))
  left.appendChild(heading('Charakter'))
  for (const [k, label] of TRAITS) left.appendChild(row(label, dog.personality[k] * 100))
  right.appendChild(heading('Befinden'))
  right.append(row('Sattheit', needs.hunger), row('Kraft', needs.energy), row('Laune', needs.happiness))
  const favText = favoriteLine(dog.name, favorite ?? null)
  if (favText) {
    const fl = document.createElement('div')
    fl.textContent = '♥ ' + favText
    fl.style.cssText = 'margin:8px 0;font-size:13px;color:#c2185b'
    right.appendChild(fl)
  }
  if (onChange) {
    right.appendChild(heading(`Halsband (${COLLAR_PRICE} Münzen)`))
    const sw = document.createElement('div')
    sw.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin:4px 0'
    for (const c of COLLARS) {
      const b = document.createElement('button')
      b.setAttribute('aria-label', `Halsband ${c.name}`)
      b.style.cssText = `width:34px;height:34px;padding:0;border-radius:50%;background:#${c.color.toString(16).padStart(6, '0')};border:${dog.collar === c.id ? '3px solid #222' : '2px solid #fff'};box-shadow:0 0 0 1px #999`
      b.addEventListener('click', async () => {
        if (dog.collar === c.id) return
        sw.querySelectorAll('button').forEach((x) => { x.disabled = true })
        try {
          await buyCollar(dog.id, c.id)
          o.remove()
          onChange({ ...dog, collar: c.id })
        } catch (e) {
          note.textContent = e instanceof Error ? e.message : friendlyError(undefined)
          sw.querySelectorAll('button').forEach((x) => { x.disabled = false })
        }
      })
      sw.appendChild(b)
    }
    const note = document.createElement('div')
    note.style.cssText = 'font-size:12px;color:#c53030'
    right.append(sw, note)
  }
  const shelf = trophyShelf(dog.trophies)
  if (shelf) {
    right.appendChild(heading('Pokale'))
    const tl = document.createElement('div')
    tl.textContent = '🏆 ' + shelf
    tl.style.cssText = 'font-size:14px;margin:4px 0'
    right.appendChild(tl)
  }
  if (bonds.length > 0) {
    right.appendChild(heading('Freundschaften'))
    for (const b of bonds) {
      const r = row(b.name, Math.min(100, (b.meetings / 15) * 100))
      r.title = bondLabel(b.meetings)
      const lab = r.lastElementChild as HTMLElement
      lab.textContent = bondLabel(b.meetings)
      lab.style.fontSize = '11px'
      right.appendChild(r)
    }
  }
  if (onChange) {
    const t = document.createElement('button')
    t.className = 'alt'
    t.textContent = 'Zum Turnier'
    t.addEventListener('click', () => { o.remove(); openContest(dog, onChange, playContest) })
    actions.appendChild(t)
    if (duel) {
      const dl = document.createElement('button')
      dl.className = 'alt'
      dl.textContent = 'Duell mit einem anderen Hund'
      dl.addEventListener('click', () => { o.remove(); duel(dog) })
      actions.appendChild(dl)
    }
  }
  card.appendChild(closeButton(o))
}

// Trainingsfenster fuer einen Hund. onChange liefert den neuen Stand an die Szene.
export function openTraining(dog: DogRecord, toast: (t: string) => void, onChange: (d: DogRecord) => void): void {
  const { overlay: o, card } = overlay()
  let current = dog
  const render = (msg?: string): void => {
    card.replaceChildren()
    const h = document.createElement('h1')
    h.textContent = `Training mit ${current.name}`
    card.appendChild(h)
    if (msg) {
      const m = document.createElement('div')
      m.className = 'sub'
      m.textContent = msg
      card.appendChild(m)
    }
    for (const k of STAT_KEYS) {
      const b = document.createElement('button')
      b.className = 'alt'
      b.textContent = `${EXERCISE[k]} (${STAT_LABEL[k]} ${statValue(current.look.breed, current.training, k)})`
      b.addEventListener('click', async () => {
        card.querySelectorAll('button').forEach((x) => { x.disabled = true })
        try {
          const q = await timingBar(card, `${EXERCISE[k]}: tippe, wenn der Zeiger in der Mitte ist!`)
          const res = await trainDog(current, k, q)
          current = res.dog
          onChange(current)
          render(`${q > 0.8 ? 'Perfektes Timing! ' : ''}${STAT_LABEL[k]} +${res.gain}`)
        } catch (e) {
          render(e instanceof Error ? e.message : friendlyError(undefined))
        }
      })
      card.appendChild(b)
    }
    card.appendChild(closeButton(o, 'Fertig'))
  }
  render()
  void toast
}

// Turnier: Liga waehlen, vier Runden (je ein Wert), Preisgeld bei Sieg oder Trostpreis.
// Startet das sichtbare Frisbee-Turnier im Garten (schliesst vorher das Fenster).
export type PlayContest = (dog: DogRecord, league: League) => void

export function openContest(dog: DogRecord, onChange: (d: DogRecord) => void, playContest?: PlayContest): void {
  const { overlay: o, card } = overlay()
  let current = dog
  const values = (): Record<StatKey, number> => Object.fromEntries(STAT_KEYS.map((k) => [k, statValue(current.look.breed, current.training, k)])) as Record<StatKey, number>
  const currentHappiness = (): number => applyElapsed(current.needs, Date.now() - parseTimestamp(current.needsUpdatedAt), current.personality).happiness
  const render = (res?: { text: string; lines: string[] }): void => {
    card.replaceChildren()
    const h = document.createElement('h1')
    h.textContent = `Turnier mit ${current.name}`
    card.appendChild(h)
    if (res) {
      const m = document.createElement('div')
      m.className = 'sub'
      m.textContent = res.text
      card.appendChild(m)
      for (const l of res.lines) {
        const d = document.createElement('div')
        d.style.fontSize = '13px'
        d.textContent = l
        card.appendChild(d)
      }
    }
    const bonus = formBonus(currentHappiness())
    if (!res && bonus !== 0) {
      const f = document.createElement('div')
      f.className = 'sub'
      f.textContent = bonus > 0 ? `${current.name} ist bester Laune: +${bonus} pro Runde` : `${current.name} ist niedergeschlagen: ${bonus} pro Runde`
      card.appendChild(f)
    }
    const pause = contestWaitMinutes(current)
    if (!res && pause > 0) {
      const w = document.createElement('div')
      w.className = 'sub'
      w.textContent = `${current.name} verschnauft noch, wieder in ${pause} Min`
      card.appendChild(w)
    }
    for (const league of LEAGUES) {
      const qualified = eligible(league, values(), current.trophies)
      const ok = qualified && pause === 0
      const missing = cupsMissing(league, current.trophies)
      const b = document.createElement('button')
      b.className = 'alt'
      const cups = current.trophies[league.id] ?? 0
      b.textContent = `${league.name} (Sieg ${league.win} Münzen${cups ? `, ${cups} Pokal${cups > 1 ? 'e' : ''}` : ''})${ok || qualified ? '' : missing > 0 ? ` - noch ${missing} Sieg${missing > 1 ? 'e' : ''} in der Liga davor` : ` - ab Schnitt ${league.entry}`}`
      b.disabled = !ok
      b.addEventListener('click', async () => {
        if (playContest) { o.remove(); playContest(current, league); return }
        card.querySelectorAll('button').forEach((x) => { x.disabled = true })
        try {
          const r = await enterContest(current, league)
          current = r.dog
          onChange(current)
          // Runden nacheinander zeigen, damit es spannend bleibt.
          const lines = r.result.rounds.map((x) => `${STAT_LABEL[x.stat]}: ${Math.round(x.dog)} gegen ${Math.round(x.rival)} ${x.won ? '✔' : '✘'}`)
          const final = r.result.won ? `Sieg! +${r.result.prize} Münzen` : `Nicht gewonnen, Trostpreis +${r.result.prize} Münzen`
          for (let i = 0; i <= lines.length; i++) {
            render({ text: i < lines.length ? `${current.name} tritt an ...` : final, lines: lines.slice(0, i) })
            if (i < lines.length) {
              card.querySelectorAll('button').forEach((x) => { x.disabled = true })
              await new Promise((res) => setTimeout(res, 900))
            }
          }
        } catch (e) {
          render({ text: e instanceof Error ? e.message : friendlyError(undefined), lines: [] })
        }
      })
      card.appendChild(b)
    }
    card.appendChild(closeButton(o, 'Fertig'))
  }
  render()
}

export const ADOPT_PRICE = 50

// Hundeheim: einen Hund ansehen und fuer Muenzen mit nach Hause nehmen.
export function openAdoption(session: Session, pup: Puppy, onDone: (d: DogRecord) => void): void {
  const { overlay: o, card } = overlay()
  const breed = pup.look.breed ? breedById(pup.look.breed).name : 'Mischling'
  const h = document.createElement('h1')
  h.textContent = `${breed} sucht ein Zuhause`
  card.appendChild(h)
  for (const [k, label] of TRAITS) card.appendChild(row(label, pup.personality[k] * 100))
  const input = document.createElement('input')
  input.placeholder = 'Name für den Hund'
  input.maxLength = 20
  input.style.cssText = 'font-size:16px;padding:10px 12px;border:2px solid #cbd5e0;border-radius:10px'
  const msg = document.createElement('div')
  msg.className = 'sub'
  const go = document.createElement('button')
  go.className = 'alt'
  go.textContent = `Adoptieren (${ADOPT_PRICE} Münzen)`
  go.addEventListener('click', async () => {
    go.disabled = true
    try {
      const dog = await adoptFromKennel(session, pup, input.value)
      o.remove()
      onDone(dog)
    } catch (e) {
      msg.textContent = friendlyError(e instanceof Error ? e.message : undefined)
      if (e instanceof Error && /bitte gib/i.test(e.message)) msg.textContent = e.message
      go.disabled = false
    }
  })
  card.append(input, msg, go, closeButton(o, 'Nicht jetzt'))
}
