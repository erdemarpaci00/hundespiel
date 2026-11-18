// "Waehrend du weg warst": fasst zusammen, was der Partner getan hat und was im Garten liegt.
export function awayMessage(partnerActs: number, poops: number, partnerName: string): string | null {
  const parts: string[] = []
  if (partnerActs > 0) parts.push(`${partnerName} hat sich ${partnerActs}-mal um die Hunde gekümmert`)
  if (poops > 0) parts.push(poops === 1 ? 'im Garten liegt ein Häufchen' : `im Garten liegen ${poops} Häufchen`)
  if (parts.length === 0) return null
  const text = parts.join(', ')
  return `Während du weg warst: ${text}`
}
