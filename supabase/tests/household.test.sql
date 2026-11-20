-- Servertest fuer Beitritt zum Haushalt und die Tagesaufgaben. Laeuft in einer Transaktion, die am Ende immer zurueckgerollt wird.
-- Aufruf: npx supabase db query --remote=<ref> --yes -f supabase/tests/household.test.sql
-- Erfolg: Fehlermeldung "TESTS OK (n Pruefungen)". Alles andere ist ein Fehlschlag.
do $$
declare
  u1 uuid := gen_random_uuid();
  u2 uuid := gen_random_uuid();
  u3 uuid := gen_random_uuid();
  hid uuid;
  did uuid;
  code text;
  r jsonb;
  c0 int;
  n int := 0;
begin
  insert into auth.users (id, email, instance_id, aud, role) values
    (u1, 'sqltest-' || u1 || '@example.invalid', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (u2, 'sqltest-' || u2 || '@example.invalid', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (u3, 'sqltest-' || u3 || '@example.invalid', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u1::text, true);
  code := 'H' || upper(substr(replace(u1::text, '-', ''), 1, 7));
  hid := public.create_household('Eins', code);
  insert into public.dogs (household_id, picked_by, is_starter, name, look, personality, needs)
    values (hid, u1, true, 'Tester', '{}', '{}', '{"hunger":80,"energy":80,"happiness":80}') returning id into did;

  -- Beitritt 1: unbekannter Code
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u2::text, true);
  begin perform public.join_household('Zwei', 'NIEMAND'); raise exception 'FAIL: unbekannter Code akzeptiert';
  exception when others then if sqlerrm not like '%Code unbekannt%' then raise; end if; end; n := n + 1;

  -- Beitritt 2: Code klein und mit Bindestrich geschrieben funktioniert
  if public.join_household('  Zwei  ', substr(code, 1, 4) || '-' || lower(substr(code, 5))) <> hid then raise exception 'FAIL: Beitritt mit Bindestrich landete im falschen Haushalt'; end if;
  if (select display_name from public.members where user_id = u2) <> 'Zwei' then raise exception 'FAIL: Name nicht gekuerzt'; end if; n := n + 1;

  -- Beitritt 3: wer schon drin ist, kann nicht noch einmal
  begin perform public.join_household('Zwei', code); raise exception 'FAIL: zweiter Beitritt akzeptiert';
  exception when others then if sqlerrm not like '%schon zu einem Haushalt%' then raise; end if; end; n := n + 1;

  -- Beitritt 4: ein dritter Mensch kommt nicht mehr hinein
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u3::text, true);
  begin perform public.join_household('Drei', code); raise exception 'FAIL: dritter Mensch aufgenommen';
  exception when others then if sqlerrm not like '%voll%' then raise; end if; end; n := n + 1;

  -- Tagesaufgabe 1: ohne Aktivitaeten nicht abholbar
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u2::text, true);
  begin perform public.claim_daily(1); raise exception 'FAIL: Aufgabe ohne Fortschritt abgeholt';
  exception when others then if sqlerrm not like '%noch nicht geschafft%' then raise; end if; end; n := n + 1;
  begin perform public.claim_daily(4); raise exception 'FAIL: Aufgabe 4 akzeptiert';
  exception when others then if sqlerrm not like '%Ungültige%' then raise; end if; end; n := n + 1;

  -- Tagesaufgabe 2: beide Mitglieder zusammen schaffen Aufgabe 1 (2x Futter), +5 Muenzen, nur einmal abholbar
  insert into public.activity (household_id, dog_id, user_id, kind) values (hid, did, u1, 'feed'), (hid, did, u2, 'feed');
  select coins into c0 from public.households where id = hid;
  r := public.claim_daily(1);
  if (r ->> 'reward')::int <> 5 or (r ->> 'bonus')::int <> 0 then raise exception 'FAIL: Auszahlung Aufgabe 1 falsch: %', r; end if;
  if (select coins from public.households where id = hid) <> c0 + 5 then raise exception 'FAIL: Muenzen nach Aufgabe 1 falsch'; end if; n := n + 1;
  begin perform public.claim_daily(1); raise exception 'FAIL: Aufgabe zweimal abgeholt';
  exception when others then if sqlerrm not like '%Schon abgeholt%' then raise; end if; end; n := n + 1;

  -- Tagesaufgabe 3: alle drei abgeholt gibt +10 Bonus zusaetzlich zu den +5 der letzten
  insert into public.activity (household_id, dog_id, user_id, kind) select hid, did, u1, 'pet' from generate_series(1, 3);
  insert into public.activity (household_id, dog_id, user_id, kind) select hid, did, u1, 'train' from generate_series(1, 2);
  perform public.claim_daily(2);
  select coins into c0 from public.households where id = hid;
  r := public.claim_daily(3);
  if (r ->> 'bonus')::int < 10 then raise exception 'FAIL: kein Bonus bei drei Aufgaben: %', r; end if;
  if (select coins from public.households where id = hid) <> c0 + 5 + (r ->> 'bonus')::int then raise exception 'FAIL: Muenzen mit Bonus falsch'; end if; n := n + 1;

  raise exception 'TESTS OK (% Pruefungen)', n;
end;
$$;
