// Ende-zu-Ende-Test des Backends gegen das echte Supabase-Projekt (legt Testkonten hundetest.* an, danach per SQL löschen).
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter(Boolean).map((l) => l.split(/=(.*)/s).slice(0, 2)))
const mk = () => createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_KEY, { auth: { persistSession: false } })
const tag = Date.now()
let failed = 0
const check = (name, ok, extra = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${name} ${ok ? '' : extra}`); if (!ok) failed++ }

async function user(label) {
  const c = mk()
  const { data, error } = await c.auth.signUp({ email: `hundetest.${label}.${tag}@example.com`, password: 'testpasswort123' })
  if (error || !data.session) throw new Error(`signUp ${label}: ${error?.message ?? 'keine Sitzung'}`)
  return { c, id: data.user.id }
}
const dog = (name) => ({ name, look: { breed: 'corgi', size: 0.8, ear: 'pointy', tail: 'short', coat: 1, pattern: 'plain', patternColor: 2 }, personality: { energy: 0.5, courage: 0.5, affection: 0.5, learning: 0.5, appetite: 0.5 }, needs: { hunger: 100, energy: 100, happiness: 100 } })

const A = await user('a'), B = await user('b'), C = await user('c'), D = await user('d')
check('Registrierung ohne E-Mail-Bestätigung', true)

const code = 'TS' + String(tag).slice(-4)
const { data: hidA, error: e1 } = await A.c.rpc('create_household', { p_display_name: 'Anna', p_code: code })
check('A legt Haushalt an', !e1 && hidA, e1?.message)
const { error: e1b } = await A.c.rpc('create_household', { p_display_name: 'Anna', p_code: 'ZZ9999' })
check('A kann keinen zweiten Haushalt anlegen', !!e1b, 'kein Fehler')

const { data: hidB, error: e2 } = await B.c.rpc('join_household', { p_display_name: 'Ben', p_code: ` ${code.toLowerCase().slice(0, 3)}-${code.toLowerCase().slice(3)} ` })
check('B tritt mit Kleinbuchstaben, Leerzeichen und Bindestrich bei', !e2 && hidB === hidA, e2?.message)
const { error: e3 } = await C.c.rpc('join_household', { p_display_name: 'Cem', p_code: code })
check('Dritter Mensch: Haushalt ist voll', e3?.message?.includes('Haushalt ist voll'), e3?.message)
const { error: e4 } = await C.c.rpc('join_household', { p_display_name: 'Cem', p_code: 'NOPE99' })
check('Falscher Code: Code unbekannt', e4?.message?.includes('Code unbekannt'), e4?.message)

const { data: hidD } = await D.c.rpc('create_household', { p_display_name: 'Dora', p_code: 'DD' + String(tag).slice(-4) })

const a1 = await A.c.from('dogs').insert({ household_id: hidA, picked_by: A.id, is_starter: true, ...dog('Bello') }).select().single()
check('A wählt Starter-Hund', !a1.error, a1.error?.message)
const a2 = await A.c.from('dogs').insert({ household_id: hidA, picked_by: A.id, is_starter: true, ...dog('Zweiter') })
check('A kann keinen zweiten Starter wählen', a2.error?.code === '23505', JSON.stringify(a2.error))
const b1 = await B.c.from('dogs').insert({ household_id: hidA, picked_by: B.id, is_starter: true, ...dog('Luna') }).select().single()
check('B wählt eigenen Starter-Hund', !b1.error, b1.error?.message)
const forged = await B.c.from('dogs').insert({ household_id: hidA, picked_by: A.id, is_starter: false, ...dog('Fake') })
check('Niemand wählt einen Hund im Namen eines anderen', !!forged.error, 'kein Fehler')

const seenByB = await B.c.from('dogs').select('name').eq('household_id', hidA)
check('B sieht beide Hunde des Haushalts', seenByB.data?.length === 2, JSON.stringify(seenByB))
const d1 = await D.c.from('dogs').insert({ household_id: hidD, picked_by: D.id, is_starter: true, ...dog('Fremder') })
const peek = await A.c.from('dogs').select('name').eq('household_id', hidD)
check('A sieht keine Hunde eines fremden Haushalts', peek.data?.length === 0 && !d1.error, JSON.stringify(peek))
const intrude = await A.c.from('dogs').insert({ household_id: hidD, picked_by: A.id, is_starter: false, ...dog('Eindringling') })
check('A kann keinen Hund in fremden Haushalt legen', !!intrude.error, 'kein Fehler')
const peekHH = await A.c.from('households').select('invite_code').eq('id', hidD)
check('A sieht den Code eines fremden Haushalts nicht', peekHH.data?.length === 0)
const direct = await A.c.from('dogs').update({ needs: { hunger: 0, energy: 0, happiness: 0 } }).eq('id', a1.data.id).select()
check('Direktes Ändern der Bedürfnisse ist gesperrt (nur über update_needs)', !direct.data?.length, JSON.stringify(direct.data))

// Gleichzeitig fuettern: beide erwarten denselben Stand, nur einer gewinnt, der andere arbeitet auf dem neuen Stand.
const expected = a1.data.needs_updated_at
const [r1, r2] = await Promise.all([
  A.c.rpc('update_needs', { p_dog_id: a1.data.id, p_expected: expected, p_needs: { hunger: 70, energy: 100, happiness: 100 } }),
  B.c.rpc('update_needs', { p_dog_id: a1.data.id, p_expected: expected, p_needs: { hunger: 71, energy: 100, happiness: 100 } }),
])
check('Gleichzeitiges Schreiben: genau einer gewinnt', [r1.data, r2.data].filter(Boolean).length === 1, JSON.stringify([r1.data, r2.data, r1.error, r2.error]))
const fresh = await B.c.from('dogs').select('needs, needs_updated_at').eq('id', a1.data.id).single()
const retry = await (r1.data ? B : A).c.rpc('update_needs', { p_dog_id: a1.data.id, p_expected: fresh.data.needs_updated_at, p_needs: { hunger: 90, energy: 100, happiness: 100 } })
check('Verlierer klappt im zweiten Versuch auf dem neuen Stand', retry.data === true, JSON.stringify(retry))
const foreign = await C.c.rpc('update_needs', { p_dog_id: a1.data.id, p_expected: fresh.data.needs_updated_at, p_needs: { hunger: 1, energy: 1, happiness: 1 } })
check('Fremder kann Bedürfnisse nicht ändern', foreign.data === false, JSON.stringify(foreign))

const act = await A.c.from('activity').insert({ household_id: hidA, dog_id: a1.data.id, user_id: A.id, kind: 'feed' })
check('Aktivität schreiben', !act.error, act.error?.message)
const act2 = await B.c.from('activity').select('kind, user_id').eq('household_id', hidA)
check('B sieht A\'s Aktivität', act2.data?.length === 1, JSON.stringify(act2))
const actForeign = await D.c.from('activity').insert({ household_id: hidA, dog_id: a1.data.id, user_id: D.id, kind: 'feed' })
check('Fremder kann keine Aktivität in meinen Haushalt schreiben', !!actForeign.error, 'kein Fehler')

// Wirtschaft
const eco = await A.c.rpc('my_economy')
check('Start: 40 Münzen, 3 Futter', eco.data?.coins === 40 && eco.data?.items?.futter === 3, JSON.stringify(eco))
const ecoB = await B.c.rpc('my_economy')
check('B sieht denselben Haushaltsstand', ecoB.data?.coins === 40, JSON.stringify(ecoB))
const direct2 = await A.c.from('households').update({ coins: 9999 }).eq('id', hidA).select()
check('Münzen lassen sich nicht direkt ändern', !direct2.data?.length, JSON.stringify(direct2.data))
const cheat = await A.c.from('household_items').update({ count: 99 }).eq('household_id', hidA).select()
check('Vorrat lässt sich nicht direkt ändern', !cheat.data?.length, JSON.stringify(cheat.data))
const buy = await A.c.rpc('buy_item', { p_item: 'futter', p_qty: 2 })
check('Kauf: 2 Futter kosten 10 Münzen', buy.data?.coins === 30 && buy.data?.items?.futter === 5, JSON.stringify(buy))
const tooMany = await A.c.rpc('buy_item', { p_item: 'futter', p_qty: 11 })
check('Menge über 10 wird abgelehnt', !!tooMany.error)
const unknown = await A.c.rpc('buy_item', { p_item: 'gold', p_qty: 1 })
check('Unbekannter Gegenstand wird abgelehnt', !!unknown.error)
const broke = await A.c.rpc('buy_item', { p_item: 'buerste', p_qty: 1 })
const broke2 = await A.c.rpc('buy_item', { p_item: 'buerste', p_qty: 1 })
check('Bürste nur einmal kaufbar, zweiter Kauf scheitert', !broke.error && !!broke2.error, JSON.stringify([broke.error, broke2.error]))
const fresh2 = await B.c.from('dogs').select('needs_updated_at').eq('id', a1.data.id).single()
const fed = await B.c.rpc('feed_dog', { p_dog_id: a1.data.id, p_expected: fresh2.data.needs_updated_at, p_needs: { hunger: 95, energy: 100, happiness: 100 }, p_item: 'futter' })
const after = await A.c.rpc('my_economy')
check('Füttern verbraucht genau eine Portion', fed.data === true && after.data?.items?.futter === 4, JSON.stringify([fed, after]))
const stale = await B.c.rpc('feed_dog', { p_dog_id: a1.data.id, p_expected: fresh2.data.needs_updated_at, p_needs: { hunger: 95, energy: 100, happiness: 100 }, p_item: 'futter' })
const after2 = await A.c.rpc('my_economy')
check('Veralteter Stand: nichts geschrieben, Vorrat bleibt', stale.data === false && after2.data?.items?.futter === 4, JSON.stringify([stale, after2]))
const badNeeds = await A.c.rpc('update_needs', { p_dog_id: a1.data.id, p_expected: fresh2.data.needs_updated_at, p_needs: { hunger: 500, energy: 1, happiness: 1 } })
check('Unsinnige Werte werden abgelehnt', !!badNeeds.error)
const foreignFeed = await C.c.rpc('feed_dog', { p_dog_id: a1.data.id, p_expected: fresh2.data.needs_updated_at, p_needs: { hunger: 100, energy: 100, happiness: 100 }, p_item: 'futter' })
check('Fremder kann nicht füttern', foreignFeed.data === false || !!foreignFeed.error, JSON.stringify(foreignFeed))
const peekEco = await D.c.from('household_items').select('item').eq('household_id', hidA)
check('Fremder sieht den Vorrat nicht', peekEco.data?.length === 0, JSON.stringify(peekEco.data))

// Training
const t0 = await B.c.from('dogs').select('needs_updated_at, training').eq('id', a1.data.id).single()
const tr = await B.c.rpc('train_dog', { p_dog_id: a1.data.id, p_expected: t0.data.needs_updated_at, p_needs: { hunger: 80, energy: 60, happiness: 100 }, p_stat: 'tempo', p_gain: 2 })
const t1 = await A.c.from('dogs').select('needs_updated_at, training').eq('id', a1.data.id).single()
check('Training erhöht genau den geübten Wert', tr.data === true && t1.data?.training?.tempo === 2 && t1.data?.training?.gehorsam === 0, JSON.stringify([tr, t1.data]))
const quick = await B.c.rpc('train_dog', { p_dog_id: a1.data.id, p_expected: t1.data.needs_updated_at, p_needs: { hunger: 70, energy: 50, happiness: 100 }, p_stat: 'tempo', p_gain: 1 })
check('Zu schnelles zweites Training wird abgelehnt', !!quick.error, JSON.stringify(quick))
const bigGain = await B.c.rpc('train_dog', { p_dog_id: a1.data.id, p_expected: t1.data.needs_updated_at, p_needs: { hunger: 70, energy: 50, happiness: 100 }, p_stat: 'tempo', p_gain: 50 })
check('Zu großer Gewinn wird abgelehnt', !!bigGain.error)
const badStat = await B.c.rpc('train_dog', { p_dog_id: a1.data.id, p_expected: t1.data.needs_updated_at, p_needs: { hunger: 70, energy: 50, happiness: 100 }, p_stat: 'zauberei', p_gain: 1 })
check('Unbekannte Übung wird abgelehnt', !!badStat.error)
const foreignTrain = await C.c.rpc('train_dog', { p_dog_id: a1.data.id, p_expected: t1.data.needs_updated_at, p_needs: { hunger: 70, energy: 50, happiness: 100 }, p_stat: 'tempo', p_gain: 1 })
check('Fremder kann nicht trainieren', foreignTrain.data === false || !!foreignTrain.error, JSON.stringify(foreignTrain))
const directTrain = await A.c.from('dogs').update({ training: { tempo: 100, ausdauer: 100, sprungkraft: 100, gehorsam: 100 } }).eq('id', a1.data.id).select()
check('Trainingswerte lassen sich nicht direkt ändern', !directTrain.data?.length, JSON.stringify(directTrain.data))

console.log(failed === 0 ? '\nALLES GRUEN' : `\n${failed} FEHLER`)
process.exit(failed === 0 ? 0 : 1)
