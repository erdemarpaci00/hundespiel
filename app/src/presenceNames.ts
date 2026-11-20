export type PresenceState = Record<string, { name?: string }[]>

// Namen aller anderen Mitglieder, die gerade im Garten sind (ohne mich selbst, sortiert).
export function othersFrom(state: PresenceState, myId: string): string[] {
  return Object.entries(state)
    .filter(([id]) => id !== myId)
    .map(([, metas]) => metas[0]?.name ?? 'Jemand')
    .sort((a, b) => a.localeCompare(b, 'de'))
}
