import { supabase } from './supabase'
import type { Session } from './session'
import { othersFrom, type PresenceState } from './presenceNames'

export type GardenLink = { stop: () => void; sendThrow: (x: number, y: number) => void }

// Wer ist gerade im Garten? Meldet die Namen der anderen bei jeder Aenderung und reicht Ballwuerfe sofort weiter.
export function watchPresence(session: Session, onChange: (others: string[]) => void, onThrow: (name: string, x: number, y: number) => void): GardenLink {
  const channel = supabase.channel(`garden-${session.householdId}`, { config: { presence: { key: session.userId } } })
  channel
    .on('presence', { event: 'sync' }, () => onChange(othersFrom(channel.presenceState() as unknown as PresenceState, session.userId)))
    .on('broadcast', { event: 'throw' }, ({ payload }) => {
      const m = payload as { userId?: string; name?: string; x?: number; y?: number }
      if (m.userId && m.userId !== session.userId && typeof m.x === 'number' && typeof m.y === 'number') onThrow(m.name ?? 'Jemand', m.x, m.y)
    })
    .subscribe((status) => { if (status === 'SUBSCRIBED') void channel.track({ name: session.displayName }) })
  return {
    stop: () => { void supabase.removeChannel(channel) },
    sendThrow: (x, y) => { void channel.send({ type: 'broadcast', event: 'throw', payload: { userId: session.userId, name: session.displayName, x, y } }) },
  }
}
