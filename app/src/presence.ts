import { supabase } from './supabase'
import type { Session } from './session'

type PresenceState = Record<string, { name?: string }[]>

// Namen aller anderen Mitglieder, die gerade im Garten sind (ohne mich selbst, sortiert).
export function othersFrom(state: PresenceState, myId: string): string[] {
  return Object.entries(state)
    .filter(([id]) => id !== myId)
    .map(([, metas]) => metas[0]?.name ?? 'Jemand')
    .sort((a, b) => a.localeCompare(b, 'de'))
}

// Wer ist gerade im Garten? Meldet die Namen der anderen bei jeder Aenderung.
export function watchPresence(session: Session, onChange: (others: string[]) => void): () => void {
  const channel = supabase.channel(`garden-${session.householdId}`, { config: { presence: { key: session.userId } } })
  channel
    .on('presence', { event: 'sync' }, () => onChange(othersFrom(channel.presenceState() as unknown as PresenceState, session.userId)))
    .subscribe((status) => { if (status === 'SUBSCRIBED') void channel.track({ name: session.displayName }) })
  return () => { void supabase.removeChannel(channel) }
}
