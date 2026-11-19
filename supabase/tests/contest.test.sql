-- Servertest fuer Wettkaempfe. Laeuft in einer Transaktion, die am Ende immer zurueckgerollt wird.
-- Aufruf: npx supabase db query --remote=<ref> --yes -f supabase/tests/contest.test.sql
-- Erfolg: Fehlermeldung "TESTS OK (n Pruefungen)". Alles andere ist ein Fehlschlag.
do $$
declare
  uid uuid := gen_random_uuid();
  other uuid := gen_random_uuid();
  hid uuid;
  did uuid;
  stamp timestamptz;
  ok boolean;
  n int := 0;
  needs jsonb := '{"hunger":50,"energy":40,"happiness":60}';
  msg text;
begin
  insert into auth.users (id, email, instance_id, aud, role) values (uid, 'sqltest-' || uid || '@example.invalid', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
  insert into public.households (invite_code) values ('T' || substr(uid::text, 1, 7)) returning id into hid;
  insert into public.members (household_id, user_id, display_name) values (hid, uid, 'Test');
  insert into public.dogs (household_id, picked_by, is_starter, name, look, personality, needs)
    values (hid, uid, true, 'Tester', '{}', '{}', '{"hunger":80,"energy":80,"happiness":80}') returning id, needs_updated_at into did, stamp;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);

  -- 1. Gesperrte Liga
  begin
    perform public.enter_contest(did, stamp, needs, 'olympia', true, 120);
    raise exception 'FAIL: Olympia ohne Pokale haette gesperrt sein muessen';
  exception when others then
    if sqlerrm not like '%nicht freigeschaltet%' then raise; end if;
  end; n := n + 1;

  -- 2. Zu hohes Preisgeld
  begin
    perform public.enter_contest(did, stamp, needs, 'bronze', true, 16);
    raise exception 'FAIL: Preisgeld 16 in Bronze haette abgelehnt werden muessen';
  exception when others then
    if sqlerrm not like '%Preisgeld%' then raise; end if;
  end; n := n + 1;

  -- 3. Zu viel Energie
  begin
    perform public.enter_contest(did, stamp, '{"hunger":50,"energy":90,"happiness":60}', 'bronze', true, 15);
    raise exception 'FAIL: Energie ueber 70 haette abgelehnt werden muessen';
  exception when others then
    if sqlerrm not like '%Ungültige Werte%' then raise; end if;
  end; n := n + 1;

  -- 4. Fremder Nutzer darf nicht
  perform set_config('request.jwt.claims', json_build_object('sub', other, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', other::text, true);
  ok := public.enter_contest(did, stamp, needs, 'bronze', true, 15);
  if ok then raise exception 'FAIL: Nicht-Mitglied hat gewertet'; end if; n := n + 1;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);

  -- 5. Veralteter Stand: kein Preisgeld
  ok := public.enter_contest(did, stamp - interval '1 second', needs, 'bronze', true, 15);
  if ok then raise exception 'FAIL: veralteter Stand wurde akzeptiert'; end if;
  if (select coins from public.households where id = hid) <> 40 then raise exception 'FAIL: Muenzen haben sich trotz Ablehnung geaendert'; end if; n := n + 1;

  -- 6. Gueltiger Sieg: Muenzen +15, Pokal +1
  ok := public.enter_contest(did, stamp, needs, 'bronze', true, 15);
  if not ok then raise exception 'FAIL: gueltiger Sieg abgelehnt'; end if;
  if (select coins from public.households where id = hid) <> 55 then raise exception 'FAIL: Muenzen nach Sieg nicht 55'; end if;
  if (select (trophies ->> 'bronze')::int from public.dogs where id = did) <> 1 then raise exception 'FAIL: Bronze-Pokal fehlt'; end if; n := n + 1;

  -- 7. Sofort nochmal: Wartezeit
  select needs_updated_at into stamp from public.dogs where id = did;
  begin
    perform public.enter_contest(did, stamp, needs, 'bronze', true, 15);
    raise exception 'FAIL: zweiter Start ohne Wartezeit';
  exception when others then
    if sqlerrm not like '%Zu schnell%' then raise; end if;
  end; n := n + 1;

  -- 8. Hundename eindeutig pro Haushalt, ohne Gross-/Kleinschreibung
  begin
    insert into public.dogs (household_id, picked_by, name, look, personality, needs)
      values (hid, uid, 'TESTER', '{}', '{}', '{"hunger":80,"energy":80,"happiness":80}');
    raise exception 'FAIL: doppelter Name akzeptiert';
  exception when unique_violation then null;
  end; n := n + 1;

  raise exception 'TESTS OK (% Pruefungen)', n;
end;
$$;
