// Schickt dem Partner eine Handy-Mitteilung, wenn im Haushalt etwas Neues passiert ist.
// Aufgerufen vom Datenbank-Ausloeser (activity_notify) mit dem gemeinsamen Geheimnis im Header x-push-secret.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const VERB: Record<string, string> = {
  feed: 'gefüttert',
  pet: 'gestreichelt',
  play: 'den Ball geworfen',
  groom: 'gebürstet',
  treat: 'ein Leckerli gegeben',
  contest_win: 'zum Turniersieg begleitet',
}
const MIN_GAP_MS = 10 * 60 * 1000

Deno.serve(async (req) => {
  if (req.method !== 'POST' || req.headers.get('x-push-secret') !== Deno.env.get('PUSH_SECRET')) return new Response('forbidden', { status: 403 })
  const { activity_id } = await req.json().catch(() => ({}))
  if (typeof activity_id !== 'string') return new Response('bad request', { status: 400 })

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: act } = await db.from('activity').select('kind, user_id, household_id, dogs(name)').eq('id', activity_id).maybeSingle()
  if (!act || !VERB[act.kind]) return new Response('skip', { status: 200 })
  const { data: me } = await db.from('members').select('display_name').eq('household_id', act.household_id).eq('user_id', act.user_id).maybeSingle()
  const dogName = (act.dogs as { name?: string } | null)?.name ?? 'euren Hund'
  const body = `${me?.display_name ?? 'Jemand'} hat ${dogName} ${VERB[act.kind]}`

  const since = new Date(Date.now() - MIN_GAP_MS).toISOString()
  const { data: subs } = await db.from('push_subscriptions').select('endpoint, p256dh, auth').eq('household_id', act.household_id).neq('user_id', act.user_id).lt('last_sent', since)
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!)

  let sent = 0
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title: 'Hundespiel', body }), { TTL: 3600 })
      await db.from('push_subscriptions').update({ last_sent: new Date().toISOString() }).eq('endpoint', s.endpoint)
      sent++
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
    }
  }
  return new Response(JSON.stringify({ sent }), { status: 200 })
})
