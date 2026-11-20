-- Servertest fuer Wochenziel und Training. Laeuft in einer Transaktion, die am Ende immer zurueckgerollt wird.
-- Aufruf: npx supabase db query --remote=<ref> --yes -f supabase/tests/progress.test.sql
-- Erfolg: Fehlermeldung "TESTS OK (n Pruefungen)". Alles andere ist ein Fehlschlag.
do $$
declare
  uid uuid := gen_random_uuid();
  hid uuid;
  did uuid;
  stamp timestamptz;
  ok boolean;
  paid int;
  n int := 0;
  needs jsonb := '{"hunger":50,"energy":40,"happiness":60}';
begin
  insert into auth.users (id, email, instance_id, aud, role) values (uid, 'sqltest-' || uid || '@example.invalid', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
  insert into public.households (invite_code) values ('P' || substr(uid::text, 1, 7)) returning id into hid;
  insert into public.members (household_id, user_id, display_name) values (hid, uid, 'Test');
  insert into public.dogs (household_id, picked_by, is_starter, name, look, personality, needs)
    values (hid, uid, true, 'Tester', '{}', '{}', '{"hunger":80,"energy":80,"happiness":80}') returning id, needs_updated_at into did, stamp;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);

  -- Wochenziel 1: mit 24 Aktivitaeten noch nicht abholbar
  insert into public.activity (household_id, dog_id, user_id, kind) select hid, did, uid, 'pet' from generate_series(1, 24);
  begin
    perform public.claim_weekly();
    raise exception 'FAIL: Wochenziel mit 24 Aktivitaeten abgeholt';
  exception when others then
    if sqlerrm not like '%noch nicht geschafft%' then raise; end if;
  end; n := n + 1;

  -- Wochenziel 2: Aufnahmen zaehlen nicht mit
  insert into public.activity (household_id, dog_id, user_id, kind) values (hid, did, uid, 'adopt');
  if (public.weekly_state() ->> 'count')::int <> 24 then raise exception 'FAIL: Aufnahme wurde mitgezaehlt'; end if; n := n + 1;

  -- Wochenziel 3: mit 25 abholbar, +30 Muenzen
  insert into public.activity (household_id, dog_id, user_id, kind) values (hid, did, uid, 'feed');
  paid := public.claim_weekly();
  if paid <> 30 then raise exception 'FAIL: Auszahlung % statt 30', paid; end if;
  if (select coins from public.households where id = hid) <> 70 then raise exception 'FAIL: Muenzen nach Wochenziel nicht 70'; end if; n := n + 1;

  -- Wochenziel 4: nur einmal pro Woche
  begin
    perform public.claim_weekly();
    raise exception 'FAIL: Wochenziel doppelt abgeholt';
  exception when others then
    if sqlerrm not like '%Schon abgeholt%' then raise; end if;
  end; n := n + 1;
  if (select coins from public.households where id = hid) <> 70 then raise exception 'FAIL: Muenzen nach Doppelversuch geaendert'; end if;

  -- Training 1: unbekannte Uebung und falscher Gewinn
  begin
    perform public.train_dog(did, stamp, needs, 'bellen', 1);
    raise exception 'FAIL: unbekannte Uebung akzeptiert';
  exception when others then
    if sqlerrm not like '%Unbekannte Übung%' then raise; end if;
  end; n := n + 1;
  begin
    perform public.train_dog(did, stamp, needs, 'tempo', 4);
    raise exception 'FAIL: Gewinn 4 akzeptiert';
  exception when others then
    if sqlerrm not like '%Ungültiger Gewinn%' then raise; end if;
  end; n := n + 1;

  -- Training 2: gueltig, Wert steigt um 2
  ok := public.train_dog(did, stamp, needs, 'tempo', 2);
  if not ok then raise exception 'FAIL: gueltiges Training abgelehnt'; end if;
  if (select (training ->> 'tempo')::int from public.dogs where id = did) <> 2 then raise exception 'FAIL: Tempo nicht 2'; end if; n := n + 1;

  -- Training 3: sofort nochmal -> Wartezeit
  select needs_updated_at into stamp from public.dogs where id = did;
  begin
    perform public.train_dog(did, stamp, needs, 'tempo', 1);
    raise exception 'FAIL: Training ohne Wartezeit';
  exception when others then
    if sqlerrm not like '%Zu schnell%' then raise; end if;
  end; n := n + 1;

  -- Training 4: Deckel bei 100
  update public.dogs set training = jsonb_set(training, '{tempo}', '99'), trained_at = null where id = did;
  select needs_updated_at into stamp from public.dogs where id = did;
  ok := public.train_dog(did, stamp, needs, 'tempo', 3);
  if (select (training ->> 'tempo')::int from public.dogs where id = did) <> 100 then raise exception 'FAIL: Tempo nicht bei 100 gedeckelt'; end if; n := n + 1;

  raise exception 'TESTS OK (% Pruefungen)', n;
end;
$$;
