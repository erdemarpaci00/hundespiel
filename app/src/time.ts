// Postgres liefert Zeitstempel mit Mikrosekunden und "+00". Nicht jeder Browser (Safari) liest das, deshalb auf Millisekunden normalisieren.
export function parseTimestamp(iso: string): number {
  const normalized = iso
    .trim()
    .replace(' ', 'T')
    .replace(/\.(\d+)/, (_, f: string) => `.${f.padEnd(3, '0').slice(0, 3)}`)
    .replace(/([+-]\d{2})$/, '$1:00')
  return Date.parse(normalized)
}
