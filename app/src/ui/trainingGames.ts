import type { StatKey } from '../dog/stats'
import { commandScore, jumpScore, rhythmScore, SPRINT_SECONDS, sprintScore } from '../dog/trainingScore'

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

function title(card: HTMLElement, text: string, hint: string): HTMLElement {
  card.replaceChildren()
  const h = document.createElement('h1')
  h.textContent = text
  const s = document.createElement('div')
  s.className = 'sub'
  s.textContent = hint
  card.append(h, s)
  return s
}

function bigButton(label: string): HTMLButtonElement {
  const b = document.createElement('button')
  b.textContent = label
  b.style.cssText = 'font-size:22px;padding:18px 10px;touch-action:manipulation;user-select:none'
  return b
}

function meter(): { wrap: HTMLElement; fill: HTMLElement; zone: HTMLElement } {
  const wrap = document.createElement('div')
  wrap.style.cssText = 'position:relative;height:22px;border-radius:11px;margin:12px 0;background:#d9dee5;overflow:hidden'
  const zone = document.createElement('div')
  zone.style.cssText = 'position:absolute;top:0;bottom:0;background:rgba(76,175,80,.55)'
  const fill = document.createElement('div')
  fill.style.cssText = 'position:absolute;left:0;top:0;bottom:0;width:0;background:#2f6fb0;opacity:.85'
  wrap.append(zone, fill)
  return { wrap, fill, zone }
}

// Sprinten: fuenf Sekunden lang so schnell wie moeglich tippen.
async function sprint(card: HTMLElement): Promise<number> {
  const hint = title(card, 'Sprinten', `Tippe ${SPRINT_SECONDS} Sekunden lang so schnell du kannst auf den Knopf. Der erste Tipp startet.`)
  const m = meter()
  const b = bigButton('Renn!')
  card.append(m.wrap, b)
  let taps = 0
  let started = false
  return new Promise((resolve) => {
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      if (!started) {
        started = true
        setTimeout(() => { b.disabled = true; resolve(sprintScore(taps)) }, SPRINT_SECONDS * 1000)
      }
      taps++
      m.fill.style.width = `${sprintScore(taps) * 100}%`
      hint.textContent = `${taps} Schritte`
    })
  })
}

// Ausdauerlauf: acht Schlaege im gleichen Takt, jeder Tipp wird mit dem naechsten Schlag verglichen.
async function endurance(card: HTMLElement): Promise<number> {
  const hint = title(card, 'Ausdauerlauf', 'Tippe im Takt, wenn der Ring die Mitte erreicht. Acht Schritte, nicht aus dem Rhythmus kommen.')
  const ring = document.createElement('div')
  ring.style.cssText = 'margin:14px auto;width:90px;height:90px;position:relative'
  const target = document.createElement('div')
  target.style.cssText = 'position:absolute;inset:30px;border-radius:50%;border:3px solid #4caf50'
  const pulse = document.createElement('div')
  pulse.style.cssText = 'position:absolute;inset:0;border-radius:50%;border:3px solid #2f6fb0'
  ring.append(target, pulse)
  const b = bigButton('Schritt')
  card.append(ring, b)
  const BEAT = 700
  const BEATS = 8
  const t0 = performance.now() + 1400
  const taps: number[] = []
  let raf = 0
  const tick = (): void => {
    const ph = ((((performance.now() - t0) % BEAT) + BEAT) % BEAT) / BEAT
    pulse.style.inset = `${30 * ph}px`
    pulse.style.opacity = performance.now() < t0 - 300 ? '0.3' : '1'
    raf = requestAnimationFrame(tick)
  }
  tick()
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    taps.push(performance.now())
    b.style.transform = 'scale(.97)'
    setTimeout(() => { b.style.transform = '' }, 80)
  })
  await wait(1400 + BEATS * BEAT + 300)
  cancelAnimationFrame(raf)
  b.disabled = true
  const beats = Array.from({ length: BEATS }, (_, i) => t0 + i * BEAT)
  const errors = beats.map((bt) => {
    const near = taps.reduce<number | null>((best, t) => { const d = Math.abs(t - bt); return d < (best ?? Infinity) ? d : best }, null)
    return near !== null && near <= 350 ? near : null
  })
  const score = rhythmScore(errors)
  hint.textContent = `${errors.filter((e) => e !== null && e <= 120).length} von ${BEATS} Schritten genau im Takt`
  await wait(700)
  return score
}

// Huerdenspringen: Knopf halten laedt die Kraft, beim Loslassen springt der Hund. Drei Huerden, jede hoeher.
async function hurdles(card: HTMLElement): Promise<number> {
  const needs = [0.4, 0.65, 0.85]
  const scores: number[] = []
  for (let i = 0; i < needs.length; i++) {
    const hint = title(card, `Hürdenspringen ${i + 1}/${needs.length}`, 'Halte den Knopf, bis die Kraft in der grünen Zone steht, und lasse los.')
    const m = meter()
    m.zone.style.left = `${(needs[i] - 0.1) * 100}%`
    m.zone.style.width = '20%'
    const b = bigButton('Halten und loslassen')
    card.append(m.wrap, b)
    const power = await new Promise<number>((resolve) => {
      let t0 = 0
      let raf = 0
      const val = (): number => { const x = ((performance.now() - t0) / 1300) % 2; return x < 1 ? x : 2 - x }
      const loop = (): void => { m.fill.style.width = `${val() * 100}%`; raf = requestAnimationFrame(loop) }
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); if (t0) return; t0 = performance.now(); loop() })
      const release = (): void => { if (!t0) return; cancelAnimationFrame(raf); const v = val(); b.disabled = true; resolve(v) }
      b.addEventListener('pointerup', release)
      b.addEventListener('pointercancel', release)
      b.addEventListener('pointerleave', release)
    })
    const sc = jumpScore(power, needs[i])
    scores.push(sc)
    hint.textContent = sc > 0.8 ? 'Drüber, sauber!' : sc > 0.3 ? 'Streift die Stange' : 'Gerissen'
    await wait(800)
  }
  return scores.reduce((a, c) => a + c, 0) / scores.length
}

const COMMANDS = [{ id: 'sitz', label: 'Sitz' }, { id: 'platz', label: 'Platz' }, { id: 'pfote', label: 'Pfote' }, { id: 'dreh', label: 'Dreh dich' }]

// Sitz und Platz: Reihenfolge der Kommandos merken und wiederholen.
async function commands(card: HTMLElement): Promise<number> {
  const hint = title(card, 'Sitz und Platz', 'Merke dir die Reihenfolge der Kommandos.')
  const shown = Array.from({ length: 4 }, () => COMMANDS[Math.floor(Math.random() * COMMANDS.length)].id)
  const label = (id: string): string => COMMANDS.find((c) => c.id === id)?.label ?? id
  const big = document.createElement('div')
  big.style.cssText = 'font-size:34px;font-weight:bold;text-align:center;height:50px;margin:12px 0'
  card.appendChild(big)
  await wait(800)
  for (const id of shown) { big.textContent = label(id); await wait(750); big.textContent = ''; await wait(250) }
  hint.textContent = 'Jetzt du: gib die Kommandos in der gleichen Reihenfolge.'
  const row = document.createElement('div')
  row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px'
  card.appendChild(row)
  const given: string[] = []
  await new Promise<void>((resolve) => {
    for (const c of COMMANDS) {
      const b = document.createElement('button')
      b.textContent = c.label
      b.style.cssText = 'touch-action:manipulation;font-size:18px;padding:14px 6px'
      b.addEventListener('click', () => { given.push(c.id); big.textContent = given.map(label).join(' - '); if (given.length >= shown.length) resolve() })
      row.appendChild(b)
    }
  })
  row.querySelectorAll('button').forEach((x) => { (x as HTMLButtonElement).disabled = true })
  const score = commandScore(shown, given)
  hint.textContent = `${Math.round(score * shown.length)} von ${shown.length} richtig`
  big.textContent = `Richtig: ${shown.map(label).join(' - ')}`
  await wait(1400)
  return score
}

// Spielt die zur Disziplin passende Uebung und liefert die Guete 0 bis 1.
export function playExercise(card: HTMLElement, key: StatKey): Promise<number> {
  switch (key) {
    case 'tempo': return sprint(card)
    case 'ausdauer': return endurance(card)
    case 'sprungkraft': return hurdles(card)
    case 'gehorsam': return commands(card)
  }
}
