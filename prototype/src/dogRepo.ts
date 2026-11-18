import { parseTimestamp } from './time'
import type { ActivityEntry, ActivityKind } from './activity'
import type { Personality } from './dog/behavior'
import type { DogLook } from './dog/look'
import type { Poop } from './garden/poop'
import { CONTEST_MIN_ENERGY, runContest, type League, type Result } from './dog/contest'
import { applyElapsed, feed, treat, groom, pet, play, PLAY_MIN_ENERGY, TRAIN_MIN_ENERGY, train, type Needs } from './dog/needs'
import { NO_TRAINING, STAT_KEYS, statValue, trainGain, type StatKey, type Training } from './dog/stats'
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
  trophies: Record<string, number>
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
  trophies: Record<string, number> | null
  created_at: string
}

const COLUMNS = 'id, name, picked_by, is_starter, look, personality, needs, needs_updated_at, training, trophies, created_at'

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
  trophies: r.trophies ?? {},
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

// Verlauf fuer Aktionen ohne Session-Parameter: still, ein Fehler hier darf die Aktion nicht kaputtmachen.
async function logQuiet(dogId: string, kind: ActivityKind): Promise<void> {
  try {
    const { data: u } = await supabase.auth.getUser()
    const { data: d } = await supabase.from('dogs').select('household_id').eq('id', dogId).single()
    if (!u.user || !d) return
    await supabase.from('activity').insert({ household_id: d.household_id, dog_id: dogId, user_id: u.user.id, kind })
  } catch { /* Verlauf ist nur Beiwerk */ }
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
    if (data === true) { void logQuiet(current.id, 'play'); return loadDog(current.id) }
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
    if (data === true) { void logQuiet(current.id, 'groom'); return loadDog(current.id) }
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
    if (data === true) { void logQuiet(current.id, 'train'); return { dog: await loadDog(current.id), gain } }
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
    .on('postgres_changes', { event: '*', schema: 'public', table: 'poops', filter: `household_id=eq.${session.householdId}` }, onChange)
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

export interface Relation { a: string; b: string; meetings: number }

export async function loadRelations(): Promise<Relation[]> {
  const { data, error } = await supabase.from('dog_relations').select('dog_a, dog_b, meetings')
  fail(error)
  return (data ?? []).map((r) => ({ a: r.dog_a as string, b: r.dog_b as string, meetings: r.meetings as number }))
}

export async function recordMeeting(a: string, b: string): Promise<void> {
  const { error } = await supabase.rpc('record_meeting', { p_a: a, p_b: b })
  fail(error)
}

// Wettkampf: braucht Restkraft, kostet Energie, das Preisgeld geht aufs Haushaltskonto.
// `preset`: ein schon sichtbar gespieltes Ergebnis (Frisbee), sonst wird es ausgewuerfelt. Der Server deckelt den Preis.
export async function enterContest(dog: DogRecord, league: League, preset?: Result): Promise<{ dog: DogRecord; result: Result }> {
  let current = dog
  for (let attempt = 0; attempt < 2; attempt++) {
    const decayed = applyElapsed(current.needs, Date.now() - parseTimestamp(current.needsUpdatedAt), current.personality)
    if (decayed.energy < CONTEST_MIN_ENERGY) throw new Error(`${current.name} ist zu müde für ein Turnier`)
    const values = Object.fromEntries(STAT_KEYS.map((k) => [k, statValue(current.look.breed, current.training, k)])) as Record<StatKey, number>
    const result = preset ?? runContest(league, values, Math.random, decayed.happiness, current.personality.affection)
    const { data, error } = await supabase.rpc('enter_contest', {
      p_dog_id: current.id,
      p_expected: current.needsUpdatedAt,
      p_needs: { ...decayed, energy: Math.max(10, decayed.energy - 30), hunger: Math.max(10, decayed.hunger - 10) },
      p_league: league.id,
      p_won: result.won,
      p_prize: result.prize,
    })
    fail(error)
    if (data === true) { void logQuiet(current.id, result.won ? 'contest_win' : 'contest_lose'); return { dog: await loadDog(current.id), result } }
    current = await loadDog(current.id)
  }
  throw new Error('Gerade war jemand schneller, bitte nochmal tippen')
}

export async function loadPoopsFromDb(): Promise<Poop[]> {
  const { data, error } = await supabase.from('poops').select('id, x, y')
  fail(error)
  return (data ?? []) as Poop[]
}

export async function dropPoop(x: number, y: number): Promise<void> {
  const { error } = await supabase.rpc('drop_poop', { p_x: Math.round(x), p_y: Math.round(y) })
  fail(error)
}

// Liefert die Belohnung in Muenzen (0 oder 1).
export async function cleanPoop(id: string): Promise<number> {
  const { data, error } = await supabase.rpc('clean_poop', { p_id: id })
  fail(error)
  return typeof data === 'number' && data > 0 ? data : 0
}

// Leckerli aus dem Vorrat geben: etwas Hunger, viel Laune.
export async function treatDog(dog: DogRecord): Promise<DogRecord> {
  let current = dog
  for (let attempt = 0; attempt < 2; attempt++) {
    const decayed = applyElapsed(current.needs, Date.now() - parseTimestamp(current.needsUpdatedAt), current.personality)
    const { data, error } = await supabase.rpc('feed_dog', { p_dog_id: current.id, p_expected: current.needsUpdatedAt, p_needs: treat(decayed), p_item: 'leckerli' })
    if (error && /kein futter/i.test(error.message ?? '')) throw new Error('Ihr habt keine Leckerli mehr, im Laden gibt es neue')
    fail(error)
    if (data === true) { void logQuiet(current.id, 'treat'); return loadDog(current.id) }
    current = await loadDog(current.id)
  }
  throw new Error('Gerade war jemand schneller, bitte nochmal tippen')
}

// Zufallsfund beim Buddeln. Null, wenn gerade Pause ist.
export async function findTreasure(dogId: string): Promise<{ coins: number; what: string } | null> {
  const { data, error } = await supabase.rpc('find_treasure', { p_dog_id: dogId })
  fail(error)
  const d = data as { coins?: number; what?: string } | null
  return d && typeof d.coins === 'number' ? { coins: d.coins, what: String(d.what ?? 'etwas') } : null
}

// Zuwendungen (ohne Aufnahme) der letzten 7 Tage: Hund-Id -> Name -> Anzahl.
export async function loadAffection(session: Session): Promise<Record<string, Record<string, number>>> {
  const since = new Date(Date.now() - 7 * 86400_000).toISOString()
  const [acts, members] = await Promise.all([
    supabase.from('activity').select('dog_id, user_id, kind').eq('household_id', session.householdId).gte('created_at', since).neq('kind', 'adopt').limit(1000),
    supabase.from('members').select('user_id, display_name').eq('household_id', session.householdId),
  ])
  fail(acts.error)
  fail(members.error)
  const names = new Map((members.data ?? []).map((m) => [m.user_id as string, m.display_name as string]))
  const out: Record<string, Record<string, number>> = {}
  for (const a of acts.data ?? []) {
    const who = names.get(a.user_id as string) ?? 'Jemand'
    const d = (out[a.dog_id as string] ??= {})
    d[who] = (d[who] ?? 0) + 1
  }
  return out
}
