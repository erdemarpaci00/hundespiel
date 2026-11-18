// Halsbaender als dauerhafte Muenzen-Ausgabe. Der Server kennt dieselben Ids und denselben Preis (supabase/019-collar.sql).
export const COLLAR_PRICE = 25

export const COLLARS: { id: string; name: string; color: number }[] = [
  { id: 'rot', name: 'Rot', color: 0xd32f2f },
  { id: 'blau', name: 'Blau', color: 0x1976d2 },
  { id: 'gruen', name: 'Grün', color: 0x388e3c },
  { id: 'gelb', name: 'Gelb', color: 0xfbc02d },
  { id: 'pink', name: 'Pink', color: 0xe91e8c },
  { id: 'lila', name: 'Lila', color: 0x7b1fa2 },
]

export function collarColor(id: string | null | undefined): number | null {
  return COLLARS.find((c) => c.id === id)?.color ?? null
}
