const KEY = 'hundespiel-tutorial-v1'

const STEPS = [
  { title: 'Willkommen!', text: 'Das ist euer Garten. Wische mit dem Finger über deinen Hund, um ihn zu streicheln. Tippe ihn an für das Menü.' },
  { title: 'Die Leiste unten', text: 'Wähle Futter, Leckerli, Ball oder Bürste und tippe dann direkt auf einen Hund oder in den Garten. Mit dem Ball spielen alle Hunde mit. Die Hand ist zum Streicheln.' },
  { title: 'Karte und Tagesbuch', text: 'Über die Karte geht es zum Training, in den Park und zum Laden. Im Tagesbuch warten jeden Tag drei Aufgaben mit Münzen auf euch beide.' },
  { title: 'Turniere', text: 'Trainierte Hunde dürfen zum Frisbee-Turnier: Tippe auf den Hund und dann auf das i. Wirf in der Mitte des Balkens, dann springt dein Hund höher.' },
  { title: 'Gemeinsam spielen', text: 'Im Zahnrad oben links steht euer Einladungscode. Gib ihn deinem Partner, dann seht ihr beide dieselben Hunde, Münzen und das Tagesbuch.' },
]

export function tutorialSeen(): boolean {
  try { return localStorage.getItem(KEY) === '1' } catch { return true }
}

export function showTutorial(): void {
  if (tutorialSeen() || document.getElementById('tutorial')) return
  const overlay = document.createElement('div')
  overlay.id = 'tutorial'
  const card = document.createElement('div')
  card.className = 'card'
  overlay.appendChild(card)
  let i = 0
  const done = (): void => {
    try { localStorage.setItem(KEY, '1') } catch { /* ohne Speicher kommt sie beim naechsten Start wieder */ }
    overlay.remove()
  }
  const render = (): void => {
    card.innerHTML = ''
    const h = document.createElement('h1')
    h.textContent = STEPS[i].title
    const p = document.createElement('p')
    p.textContent = STEPS[i].text
    const dots = document.createElement('small')
    dots.textContent = `${i + 1} von ${STEPS.length}`
    const next = document.createElement('button')
    next.textContent = i === STEPS.length - 1 ? 'Los geht’s' : 'Weiter'
    next.addEventListener('click', () => { if (i === STEPS.length - 1) done(); else { i++; render() } })
    const skip = document.createElement('button')
    skip.className = 'tab'
    skip.textContent = 'Überspringen'
    skip.addEventListener('click', done)
    card.append(h, p, dots, next, skip)
  }
  render()
  document.body.appendChild(overlay)
}
