import { createHousehold, isSignedIn, joinHousehold, loadSession, signIn, signUp, type Session } from '../session'

const root = (): HTMLElement => document.getElementById('ui') as HTMLElement

function card(html: string): HTMLElement {
  const ui = root()
  ui.innerHTML = `<div class="card">${html}</div>`
  ui.style.display = 'flex'
  return ui
}

function wire(
  ui: HTMLElement,
  actions: Record<string, () => Promise<void>>,
): void {
  const msg = ui.querySelector('.msg') as HTMLElement
  for (const [id, run] of Object.entries(actions)) {
    ui.querySelector<HTMLButtonElement>(`#${id}`)?.addEventListener('click', async (ev) => {
      const btn = ev.currentTarget as HTMLButtonElement
      msg.textContent = ''
      btn.disabled = true
      try {
        await run()
      } catch (e) {
        msg.textContent = e instanceof Error ? e.message : 'Etwas ist schiefgelaufen, bitte nochmal versuchen'
      } finally {
        btn.disabled = false
      }
    })
  }
}

const value = (ui: HTMLElement, id: string): string => (ui.querySelector<HTMLInputElement>(`#${id}`)?.value ?? '').trim()

// Zeigt Anmeldung und Haushalt-Auswahl, bis eine Sitzung mit Haushalt da ist.
export async function runAuthFlow(): Promise<Session> {
  return new Promise<Session>((resolve) => {
    const finish = async (): Promise<void> => {
      const s = await loadSession()
      if (s) {
        root().style.display = 'none'
        resolve(s)
      } else showHousehold()
    }

    const showLogin = (): void => {
      const ui = card(`
        <h1>Hundespiel</h1>
        <input id="email" type="email" placeholder="E-Mail" autocomplete="email" />
        <input id="pw" type="password" placeholder="Passwort (mind. 6 Zeichen)" autocomplete="current-password" />
        <div class="row"><button id="in">Anmelden</button><button id="up" class="alt">Registrieren</button></div>
        <p class="msg"></p>`)
      wire(ui, {
        in: async () => { await signIn(value(ui, 'email'), value(ui, 'pw')); await finish() },
        up: async () => { await signUp(value(ui, 'email'), value(ui, 'pw')); await finish() },
      })
    }

    const showHousehold = (): void => {
      const ui = card(`
        <h1>Euer Haushalt</h1>
        <input id="name" placeholder="Dein Name" maxlength="30" />
        <button id="new">Neuen Haushalt anlegen</button>
        <input id="code" placeholder="Einladungscode vom Partner" autocapitalize="characters" />
        <button id="join" class="alt">Mit Code beitreten</button>
        <p class="msg"></p>`)
      const needName = (): string => {
        const n = value(ui, 'name')
        if (!n) throw new Error('Bitte gib deinen Namen ein')
        return n
      }
      wire(ui, {
        new: async () => {
          const { inviteCode } = await createHousehold(needName())
          const shown = card(`
            <h1>Haushalt angelegt</h1>
            <p>Gib diesen Code deinem Partner:</p>
            <div class="code">${inviteCode}</div>
            <button id="go">Weiter</button>
            <p class="msg"></p>`)
          wire(shown, { go: finish })
        },
        join: async () => { await joinHousehold(needName(), value(ui, 'code')); await finish() },
      })
    }

    loadSession().then((s) => {
      if (s) { root().style.display = 'none'; resolve(s) }
      else isSignedIn().then((signed) => (signed ? showHousehold() : showLogin()))
    }).catch(() => showLogin())
  })
}
