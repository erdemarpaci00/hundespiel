import { bondLabel } from '../dog/bond'
import { ageDays, ageLabel } from '../dog/age'
import { parseTimestamp } from '../time'
import { breedById } from '../dog/breeds'
import type { Needs } from '../dog/needs'
import { EXERCISE, STAT_KEYS, STAT_LABEL, statValue } from '../dog/stats'
import type { DogRecord } from '../dogRepo'
import { adoptFromKennel, trainDog } from '../dogRepo'
import type { Puppy } from '../puppies'
import type { Session } from '../session'
import { friendlyError } from '../errors'

function overlay(): { overlay: HTMLElement; card: HTMLElement } {
  document.getElementById('settings')?.remove()
  const o = document.createElement('div')
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

const TRAITS: [keyof DogRecord['personality'], string][] = [
  ['energy', 'Energie'], ['courage', 'Mut'], ['affection', 'Anhänglichkeit'], ['learning', 'Lernfreude'], ['appetite', 'Appetit'],
]

// Alles ueber einen Hund: Rasse, Charakter, Befinden, Werte. Nur auf Wunsch sichtbar.
export function openDogDetail(dog: DogRecord, needs: Needs, bonds: { name: string; meetings: number }[] = []): void {
  const { overlay: o, card } = overlay()
  const h = document.createElement('h1')
  const breed = dog.look.breed ? breedById(dog.look.breed).name : 'Mischling'
  h.textContent = `${dog.name} (${breed})`
  const age = document.createElement('div')
  age.className = 'sub'
  age.textContent = ageLabel(ageDays(parseTimestamp(dog.createdAt), Date.now()))
  card.append(h, age, heading('Werte'))
  for (const k of STAT_KEYS) card.appendChild(row(STAT_LABEL[k], statValue(dog.look.breed, dog.training, k)))
  card.appendChild(heading('Charakter'))
  for (const [k, label] of TRAITS) card.appendChild(row(label, dog.personality[k] * 100))
  card.appendChild(heading('Befinden'))
  card.append(row('Sattheit', needs.hunger), row('Kraft', needs.energy), row('Laune', needs.happiness))
  if (bonds.length > 0) {
    card.appendChild(heading('Freundschaften'))
    for (const b of bonds) {
      const r = row(b.name, Math.min(100, (b.meetings / 15) * 100))
      r.title = bondLabel(b.meetings)
      const lab = r.lastElementChild as HTMLElement
      lab.textContent = bondLabel(b.meetings)
      lab.style.fontSize = '11px'
      card.appendChild(r)
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
          const res = await trainDog(current, k)
          current = res.dog
          onChange(current)
          render(`${STAT_LABEL[k]} +${res.gain}`)
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
