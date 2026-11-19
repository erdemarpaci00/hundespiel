import { expect, test } from 'vitest'
import { friendlyError } from '../src/errors'

test('bekannte Fehler werden auf Deutsch erklärt', () => {
  expect(friendlyError('Invalid login credentials')).toBe('E-Mail oder Passwort stimmt nicht')
  expect(friendlyError('User already registered')).toBe('Diese E-Mail ist schon registriert, bitte anmelden')
  expect(friendlyError('Password should be at least 6 characters')).toBe('Das Passwort braucht mindestens 6 Zeichen')
  expect(friendlyError('Code unbekannt')).toBe('Dieser Code ist unbekannt')
  expect(friendlyError('Der Haushalt ist voll')).toBe('Dieser Haushalt ist schon voll')
  expect(friendlyError('Du gehörst schon zu einem Haushalt')).toBe('Du gehörst schon zu einem Haushalt')
})

test('Netzfehler und Unbekanntes ergeben verständliche Meldungen', () => {
  expect(friendlyError('TypeError: Failed to fetch')).toBe('Keine Verbindung, bitte Netz prüfen')
  expect(friendlyError('irgendwas Unerwartetes')).toBe('Etwas ist schiefgelaufen, bitte nochmal versuchen')
  expect(friendlyError(undefined)).toBe('Etwas ist schiefgelaufen, bitte nochmal versuchen')
})

test('Safari meldet Netzfehler als "Load failed"', () => {
  expect(friendlyError('TypeError: Load failed')).toBe('Keine Verbindung, bitte Netz prüfen')
})

test('gesperrte Liga wird verständlich erklärt', () => {
  expect(friendlyError('Liga noch nicht freigeschaltet')).toBe('Diese Liga ist noch gesperrt, gewinnt erst drei Pokale in der Liga davor')
})
