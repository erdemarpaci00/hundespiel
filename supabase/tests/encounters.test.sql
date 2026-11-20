-- Servertest fuer Hunde-Begegnungen und Schatzfunde. Laeuft in einer Transaktion, die am Ende immer zurueckgerollt wird.
-- Aufruf: npx supabase db query --remote=<ref> --yes -f supabase/tests/encounters.test.sql
-- Erfolg: Fehlermeldung "TESTS OK (n Pruefungen)". Alles andere ist ein Fehlschlag.
do $$
declare
  u1 uuid := gen_random_uuid();
  u2 uuid := gen_random_uuid();
  h1 uuid;
  h2 uuid;
  d1 uuid;
  d2 uuid;
  dx uuid;
  r jsonb;
  c0 int;
  c1 int;
  total int;
  n int := 0;
begin
  insert into auth.users (id, email, instance_id, aud, role) values
    (u1, 'sqltest-' || u1 || '@example.invalid', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (u2, 'sqltest-' || u2 || '@example.invalid', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
  insert into public.households (invite_code) values ('B' || substr(replace(u1::text, '-', ''), 1, 7)) returning id into h1;
  insert into public.households (invite_code) values ('C' || substr(replace(u2::text, '-', ''), 1, 7)) returning id into h2;
  insert into public.members (household_id, user_id, display_name) values (h1, u1, 'Eins'), (h2, u2, 'Zwei');
  insert into public.dogs (household_id, picked_by, is_starter, name, look, personality, needs) values (h1, u1, true, 'Anton', '{}', '{}', '{"hunger":80,"energy":80,"happiness":80}') returning id into d1;
  insert into public.dogs (household_id, picked_by, is_starter, name, look, personality, needs) values (h1, u1, false, 'Berta', '{}', '{}', '{"hunger":80,"energy":80,"happiness":80}') returning id into d2;
  insert into public.dogs (household_id, picked_by, is_starter, name, look, personality, needs) values (h2, u2, true, 'Fremd', '{}', '{}', '{"hunger":80,"energy":80,"happiness":80}') returning id into dx;
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u1::text, true);

  -- Begegnung 1: ein Hund mit sich selbst ist ungueltig
  begin perform public.record_meeting(d1, d1); raise exception 'FAIL: Hund trifft sich selbst';
  exception when others then if sqlerrm not like '%Ungültiges Paar%' then raise; end if; end; n := n + 1;

  -- Begegnung 2: Hunde aus fremdem Haushalt zaehlen nicht
  if public.record_meeting(d1, dx) <> -1 then raise exception 'FAIL: Begegnung mit fremdem Hund gezaehlt'; end if; n := n + 1;

  -- Begegnung 3: erste Begegnung zaehlt 1, egal in welcher Reihenfolge, direkt danach nicht noch einmal
  if public.record_meeting(d1, d2) <> 1 then raise exception 'FAIL: erste Begegnung nicht 1'; end if;
  if public.record_meeting(d2, d1) <> 1 then raise exception 'FAIL: Wiederholung innerhalb 10 Minuten gezaehlt'; end if;
  if (select count(*) from public.dog_relations where household_id = h1) <> 1 then raise exception 'FAIL: Paar doppelt gespeichert'; end if; n := n + 1;

  -- Begegnung 4: nach mehr als 10 Minuten zaehlt die naechste
  update public.dog_relations set last_at = now() - interval '11 minutes' where household_id = h1;
  total := public.record_meeting(d2, d1);
  if total <> 2 then raise exception 'FAIL: Begegnung nach 11 Minuten ergibt %', total; end if; n := n + 1;

  -- Fund 1: fremder Hund bringt nichts
  if public.find_treasure(dx) is not null then raise exception 'FAIL: Fund fuer fremden Haushalt'; end if; n := n + 1;

  -- Fund 2: erster Fund gibt 2 bis 5 Muenzen, die direkt danach nicht noch einmal
  select coins into c0 from public.households where id = h1;
  r := public.find_treasure(d1);
  select coins into c1 from public.households where id = h1;
  if r is null or c1 - c0 not between 2 and 5 or (r ->> 'coins')::int <> c1 - c0 then raise exception 'FAIL: Fund % (Muenzen % -> %)', r, c0, c1; end if; n := n + 1;
  if public.find_treasure(d2) is not null then raise exception 'FAIL: zweiter Fund ohne Wartezeit'; end if; n := n + 1;

  -- Fund 3: nach 21 Minuten gibt es wieder einen
  update public.households set find_at = now() - interval '21 minutes' where id = h1;
  if public.find_treasure(d2) is null then raise exception 'FAIL: kein Fund nach der Wartezeit'; end if; n := n + 1;

  raise exception 'TESTS OK (% Pruefungen)', n;
end;
$$;
