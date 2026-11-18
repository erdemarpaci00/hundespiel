import { parseTimestamp } from './time'
import type { ActivityEntry, ActivityKind } from './activity'
import type { Personality } from './dog/behavior'
import type { DogLook } from './dog/look'
import { applyElapsed, feed, groom, pet, play, PLAY_MIN_ENERGY, TRAIN_MIN_ENERGY, train, type Needs } from './dog/needs'
import { NO_TRAINING, trainGain, type StatKey, type Training } from './dog/stats'
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
  training: Training
  createdAt: string
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
  training: Training | null
  created_at: string
}

const COLUMNS = 'id, name, picked_by, is_starter, look, personality, needs, needs_updated_at, training, created_at'

const toRecord = (r: DogRow): DogRecord => ({
  id: r.id,
  name: r.name,
  pickedBy: r.picked_by,
  isStarter: r.is_starter,
  look: r.look,
  personality: r.personality,
  needs: r.needs,
  needsUpdatedAt: r.needs_updated_at,
  training: { ...NO_TRAINING, ...(r.training ?? {}) },
  createdAt: r.created_at,
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

// Hund aus dem Hundeheim holen: kostet Muenzen, die Datenbank prueft Preis und Platz.
export async function adoptFromKennel(session: Session, pick: Puppy, name: string): Promise<DogRecord> {
  const clean = name.trim()
  if (!clean) throw new Error('Bitte gib dem Hund einen Namen')
  const { data, error } = await supabase.rpc('adopt_dog', { p_name: clean, p_look: pick.look, p_personality: pick.personality })
  fail(error)
  const dog = await loadDog(data as string)
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
    const elapsed = Date.now() - parseTimestamp(current.needsUpdatedAt)
    const decayed = applyElapsed(current.needs, elapsed, current.personality)
    const next = action === 'feed' ? feed(decayed) : pet(decayed, current.personality)
    const args = { p_dog_id: current.id, p_expected: current.needsUpdatedAt, p_needs: next }
    const { data, error } =
      action === 'feed' ? await supabase.rpc('feed_dog', { ...args, p_item: 'futter' }) : await supabase.rpc('update_needs', args)
    fail(error)
    if (data === true) {
      await logActivity(session, current.id, action)
      return loadDog(current.id)
    }
    current = await loadDog(current.id)
  }
  throw new Error('Gerade war jemand schneller, bitte nochmal tippen')
}

// Ballspiel: braucht etwas Restkraft, schreibt die neuen Werte mit Konfliktpruefung.
export async function playWithDog(dog: DogRecord): Promise<DogRecord> {
  let current = dog
  for (let attempt = 0; attempt < 2; attempt++) {
    const decayed = applyElapsed(current.needs, Date.now() - parseTimestamp(current.needsUpdatedAt), current.personality)
    if (decayed.energy < PLAY_MIN_ENERGY) throw new Error(`${current.name} ist zu müde zum Spielen`)
    const { data, error } = await supabase.rpc('update_needs', { p_dog_id: current.id, p_expected: current.needsUpdatedAt, p_needs: play(decayed) })
    fail(error)
    if (data === true) return loadDog(current.id)
    current = await loadDog(current.id)
  }
  throw new Error('Gerade war jemand schneller, bitte nochmal tippen')
}

// Buersten: nur die Laune steigt.
export async function groomDog(dog: DogRecord): Promise<DogRecord> {
  let current = dog
  for (let attempt = 0; attempt < 2; attempt++) {
    const decayed = applyElapsed(current.needs, Date.now() - parseTimestamp(current.needsUpdatedAt), current.personality)
    const { data, error } = await supabase.rpc('update_needs', { p_dog_id: current.id, p_expected: current.needsUpdatedAt, p_needs: groom(decayed) })
    fail(error)
    if (data === true) return loadDog(current.id)
    current = await loadDog(current.id)
  }
  throw new Error('Gerade war jemand schneller, bitte nochmal tippen')
}

// Ein Trainingsdurchgang: braucht Restkraft, kostet Energie, steigert genau einen Wert.
export async function trainDog(dog: DogRecord, stat: StatKey): Promise<{ dog: DogRecord; gain: number }> {
  let current = dog
  for (let attempt = 0; attempt < 2; attempt++) {
    const decayed = applyElapsed(current.needs, Date.now() - parseTimestamp(current.needsUpdatedAt), current.personality)
    if (decayed.energy < TRAIN_MIN_ENERGY) throw new Error(`${current.name} ist zu müde zum Trainieren`)
    const gain = trainGain(current.personality.learning)
    const { data, error } = await supabase.rpc('train_dog', {
      p_dog_id: current.id,
      p_expected: current.needsUpdatedAt,
      p_needs: train(decayed),
      p_stat: stat,
      p_gain: gain,
    })
    fail(error)
    if (data === true) return { dog: await loadDog(current.id), gain }
    current = await loadDog(current.id)
  }
  throw new Error('Gerade war jemand schneller, bitte nochmal tippen')
}

export function subscribeToHousehold(session: Session, onChange: () => void): () => void {
  let connectedBefore = false
  const channel = supabase
    .channel(`household-${session.householdId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dogs', filter: `household_id=eq.${session.householdId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'activity', filter: `household_id=eq.${session.householdId}` }, onChange)
    .subscribe((status) => {
      // Nach einem Verbindungsabbruch (Handy gesperrt, App im Hintergrund) werden verpasste Aenderungen nicht nachgeliefert: neu laden.
      if (status === 'SUBSCRIBED') {
        if (connectedBefore) onChange()
        connectedBefore = true
      }
    })
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
