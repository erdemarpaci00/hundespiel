const RULES: [RegExp, string][] = [
  [/invalid login credentials/i, 'E-Mail oder Passwort stimmt nicht'],
  [/already registered/i, 'Diese E-Mail ist schon registriert, bitte anmelden'],
  [/password should be at least/i, 'Das Passwort braucht mindestens 6 Zeichen'],
  [/code unbekannt/i, 'Dieser Code ist unbekannt'],
  [/haushalt ist voll/i, 'Dieser Haushalt ist schon voll'],
  [/gehörst schon zu einem haushalt/i, 'Du gehörst schon zu einem Haushalt'],
  [/failed to fetch|networkerror|network request failed/i, 'Keine Verbindung, bitte Netz prüfen'],
]

export function friendlyError(message: string | undefined): string {
  for (const [re, text] of RULES) if (message && re.test(message)) return text
  return 'Etwas ist schiefgelaufen, bitte nochmal versuchen'
}
