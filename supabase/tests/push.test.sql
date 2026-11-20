-- Servertest fuer die Anmeldung zu Handy-Mitteilungen. Rollt am Ende immer zurueck.
-- Aufruf: npx supabase db query --remote=<ref> --yes -f supabase/tests/push.test.sql
-- Erfolg: Fehlermeldung "TESTS OK (n Pruefungen)".
do $$
declare
  uid uuid := gen_random_uuid();
  hid uuid;
  did uuid;
  stamp timestamptz;
  pid uuid;
  ok boolean;
  d date := (now() at time zone 'Europe/Berlin')::date;
  c0 int;
  r jsonb;
  other uuid;
  n int := 0;
  needs jsonb := '{"hunger":50,"energy":40,"happiness":60}';
begin
  insert into auth.users (id, email, instance_id, aud, role) values (uid, 'sqltest-' || uid || '@example.invalid', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
  insert into public.households (invite_code) values ('H' || substr(uid::text, 1, 7)) returning id into hid;
  insert into public.members (household_id, user_id, display_name) values (hid, uid, 'Test');
  insert into public.dogs (household_id, picked_by, is_starter, name, look, personality, needs)
    values (hid, uid, true, 'Tester', '{}', '{}', '{"hunger":80,"energy":80,"happiness":80}') returning id, needs_updated_at into did, stamp;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  update public.households set coins = 20 where id = hid;
  perform public.my_economy();
  -- Ungueltige Anmeldungen werden abgelehnt
  begin perform public.save_push_subscription('http://unsicher.example/x', 'k', 'a'); raise exception 'FAIL: http-Adresse akzeptiert';
  exception when others then if sqlerrm not like '%Ungültige Anmeldung%' then raise; end if; end; n := n + 1;
  begin perform public.save_push_subscription('https://push.example/x', '', 'a'); raise exception 'FAIL: leerer Schluessel akzeptiert';
  exception when others then if sqlerrm not like '%Ungültige Anmeldung%' then raise; end if; end; n := n + 1;

  -- Speichern, doppeltes Speichern ergibt nur eine Zeile (Schluessel wird aktualisiert)
  perform public.save_push_subscription('https://push.example/a', 'k1', 'a1');
  perform public.save_push_subscription('https://push.example/a', 'k2', 'a2');
  if (select count(*) from public.push_subscriptions where endpoint = 'https://push.example/a') <> 1 then raise exception 'FAIL: doppelte Zeile'; end if; n := n + 1;
  if (select p256dh from public.push_subscriptions where endpoint = 'https://push.example/a') <> 'k2' then raise exception 'FAIL: Schluessel nicht aktualisiert'; end if; n := n + 1;
  if (select household_id from public.push_subscriptions where endpoint = 'https://push.example/a') <> hid then raise exception 'FAIL: falscher Haushalt'; end if; n := n + 1;

  -- Fremde Anmeldung kann nicht entfernt werden, eigene schon
  other := gen_random_uuid();
  insert into auth.users (id, email, instance_id, aud, role) values (other, 'sqltest-' || other || '@example.invalid', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
  insert into public.push_subscriptions (endpoint, user_id, household_id, p256dh, auth) values ('https://push.example/fremd', other, hid, 'k', 'a');
  perform public.remove_push_subscription('https://push.example/fremd');
  if not exists (select 1 from public.push_subscriptions where endpoint = 'https://push.example/fremd') then raise exception 'FAIL: fremde Anmeldung entfernt'; end if; n := n + 1;
  perform public.remove_push_subscription('https://push.example/a');
  if exists (select 1 from public.push_subscriptions where endpoint = 'https://push.example/a') then raise exception 'FAIL: eigene Anmeldung nicht entfernt'; end if; n := n + 1;

  raise exception 'TESTS OK (% Pruefungen)', n;
end;
$$;
