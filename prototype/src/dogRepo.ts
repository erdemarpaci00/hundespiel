import type { ActivityEntry, ActivityKind } from './activity'
import type { Personality } from './dog/behavior'
import type { DogLook } from './dog/look'
import { applyElapsed, feed, pet, type Needs } from './dog/needs'
import { friendlyError } from './errors'
import type { Puppy } from './puppies'
import type { Session } from './session'
import { supabase } from './supabase'

export interface DogRecord {
  id: string
  name: string
  pickedBy: string
  isStarter: boolean
  look: DogLook
  personality: Personality
  needs: Needs
  needsUpdatedAt: string
}

interface DogRow {
  id: string
  name: string
  picked_by: string
  is_starter: boolean
  look: DogLook
  personality: Personality
  needs: Needs
  needs_updated_at: string
}

const COLUMNS = 'id, name, picked_by, is_starter, look, personality, needs, needs_updated_at'

const toRecord = (r: DogRow): DogRecord => ({
  id: r.id,
  name: r.name,
  pickedBy: r.picked_by,
  isStarter: r.is_starter,
  look: r.look,
  personality: r.personality,
  needs: r.needs,
  needsUpdatedAt: r.needs_updated_at,
})

function fail(error: { message?: string } | null): void {
  if (error) throw new Error(friendlyError(error.message))
}

async function logActivity(session: Session, dogId: string, kind: ActivityKind): Promise<void> {
  const { error } = await supabase
    .from('activity')
    .insert({ household_id: session.householdId, dog_id: dogId, user_id: session.userId, kind })
  fail(error)
}

export async function adoptPuppy(session: Session, pick: Puppy, name: string): Promise<DogRecord> {
  const clean = name.trim()
  if (!clean) throw new Error('Bitte gib dem Welpen einen Namen')
  const { data, error } = await supabase
    .from('dogs')
    .insert({
      household_id: session.householdId,
      picked_by: session.userId,
      is_starter: true,
      name: clean,
      look: pick.look,
      personality: pick.personality,
      needs: { hunger: 100, energy: 100, happiness: 100 },
    })
    .select(COLUMNS)
    .single()
  if (error?.code === '23505') throw new Error('Du hast schon einen Starter-Hund gewählt')
  fail(error)
  const dog = toRecord(data as DogRow)
  await logActivity(session, dog.id, 'adopt')
  return dog
}

export async function loadDogs(session: Session): Promise<DogRecord[]> {
  const { data, error } = await supabase
    .from('dogs')
    .select(COLUMNS)
    .eq('household_id', session.householdId)
    .order('created_at')
  fail(error)
  return (data as DogRow[]).map(toRecord)
}

async function loadDog(id: string): Promise<DogRecord> {
  const { data, error } = await supabase.from('dogs').select(COLUMNS).eq('id', id).single()
  fail(error)
  return toRecord(data as DogRow)
}

// Rechnet die Zeit seit dem letzten Stand hoch, wendet die Aktion an und schreibt nur,
// wenn niemand dazwischen war. Sonst genau ein zweiter Versuch auf dem neuen Stand.
export async function careForDog(session: Session, dog: DogRecord, action: 'feed' | 'pet'): Promise<DogRecord> {
  let current = dog
  for (let attempt = 0; attempt < 2; attempt++) {
    const elapsed = Date.now() - Date.parse(current.needsUpdatedAt)
    const decayed = applyElapsed(current.needs, elapsed, current.personality)
    const next = action === 'feed' ? feed(decayed) : pet(decayed, current.personality)
    const { data, error } = await supabase.rpc('update_needs', {
      p_dog_id: current.id,
      p_expected: current.needsUpdatedAt,
      p_needs: next,
    })
    fail(error)
    if (data === true) {
      await logActivity(session, current.id, action)
      return loadDog(current.id)
    }
    current = await loadDog(current.id)
  }
  throw new Error('Gerade war jemand schneller, bitte nochmal tippen')
}

export function subscribeToHousehold(session: Session, onChange: () => void): () => void {
  const channel = supabase
    .channel(`household-${session.householdId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dogs', filter: `household_id=eq.${session.householdId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'activity', filter: `household_id=eq.${session.householdId}` }, onChange)
    .subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}

export async function loadActivity(session: Session, limit: number): Promise<ActivityEntry[]> {
  const { data, error } = await supabase
    .from('activity')
    .select('id, kind, created_at, user_id, dog_id')
    .eq('household_id', session.householdId)
    .order('created_at', { ascending: false })
    .limit(limit)
  fail(error)
  const rows = data as { id: string; kind: ActivityKind; created_at: string; user_id: string; dog_id: string }[]
  const [members, dogs] = await Promise.all([
    supabase.from('members').select('user_id, display_name').eq('household_id', session.householdId),
    supabase.from('dogs').select('id, name').eq('household_id', session.householdId),
  ])
  fail(members.error)
  fail(dogs.error)
  const userNames = new Map((members.data ?? []).map((m) => [m.user_id as string, m.display_name as string]))
  const dogNames = new Map((dogs.data ?? []).map((d) => [d.id as string, d.name as string]))
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    userName: userNames.get(r.user_id) ?? 'Jemand',
    dogName: dogNames.get(r.dog_id) ?? 'einen Hund',
    at: r.created_at,
  }))
}
