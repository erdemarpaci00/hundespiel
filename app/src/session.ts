import { friendlyError } from './errors'
import { generateInviteCode, normalizeInviteCode } from './inviteCode'
import { supabase } from './supabase'

export interface Session {
  userId: string
  householdId: string
  displayName: string
}

function fail(error: { message?: string } | null): void {
  if (error) throw new Error(friendlyError(error.message))
}

export async function signIn(email: string, password: string): Promise<void> {
  fail((await supabase.auth.signInWithPassword({ email: email.trim(), password })).error)
}

export async function signUp(email: string, password: string): Promise<void> {
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
  fail(error)
  // Ohne ausgeschaltete E-Mail-Bestaetigung gibt es noch keine Sitzung.
  if (!data.session) throw new Error('Bitte bestätige deine E-Mail und melde dich dann an')
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

export async function isSignedIn(): Promise<boolean> {
  try {
    return (await supabase.auth.getSession()).data.session !== null
  } catch {
    return false
  }
}

export async function createHousehold(displayName: string): Promise<{ householdId: string; inviteCode: string }> {
  const inviteCode = generateInviteCode(Math.random)
  const { data, error } = await supabase.rpc('create_household', { p_display_name: displayName, p_code: inviteCode })
  fail(error)
  return { householdId: data as string, inviteCode }
}

export async function joinHousehold(displayName: string, code: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_household', {
    p_display_name: displayName,
    p_code: normalizeInviteCode(code),
  })
  fail(error)
  return data as string
}

// null: nicht angemeldet oder noch kein Haushalt.
export async function loadInviteCode(householdId: string): Promise<string> {
  const { data, error } = await supabase.from('households').select('invite_code').eq('id', householdId).single()
  if (error) throw new Error(friendlyError(error.message))
  return data.invite_code as string
}

export async function loadSession(): Promise<Session | null> {
  const { data: auth } = await supabase.auth.getSession()
  const user = auth.session?.user
  if (!user) return null
  const { data, error } = await supabase
    .from('members')
    .select('household_id, display_name')
    .eq('user_id', user.id)
    .maybeSingle()
  fail(error)
  if (!data) return null
  return { userId: user.id, householdId: data.household_id as string, displayName: data.display_name as string }
}
