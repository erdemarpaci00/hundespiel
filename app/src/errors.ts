const RULES: [RegExp, string][] = [
  [/invalid login credentials/i, 'E-Mail oder Passwort stimmt nicht'],
  [/already registered/i, 'Diese E-Mail ist schon registriert, bitte anmelden'],
  [/password should be at least/i, 'Das Passwort braucht mindestens 6 Zeichen'],
  [/code unbekannt/i, 'Dieser Code ist unbekannt'],
  [/haushalt ist voll/i, 'Dieser Haushalt ist schon voll'],
  [/gehörst schon zu einem haushalt/i, 'Du gehörst schon zu einem Haushalt'],
  [/kein futter mehr/i, 'Kein Futter mehr, kauft neues in den Einstellungen'],
  [/zu wenig münzen/i, 'Zu wenig Münzen'],
  [/das habt ihr schon/i, 'Das habt ihr schon'],
  [/mehr als vier hunde/i, 'Mehr als vier Hunde passen nicht in die Wohnung'],
  [/zu schnell hintereinander/i, 'Nicht so schnell, kurz verschnaufen lassen'],
  [/liga noch nicht freigeschaltet/i, 'Diese Liga ist noch gesperrt, gewinnt erst drei Pokale in der Liga davor'],
  [/dogs_unique_name_per_household/i, 'Einen Hund mit diesem Namen gibt es bei euch schon, nimm bitte einen anderen Namen'],
  [/failed to fetch|load failed|networkerror|network request failed/i, 'Keine Verbindung, bitte Netz prüfen'],
]

export function friendlyError(message: string | undefined): string {
  for (const [re, text] of RULES) if (message && re.test(message)) return text
  return 'Etwas ist schiefgelaufen, bitte nochmal versuchen'
}
