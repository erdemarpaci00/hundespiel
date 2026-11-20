-- Servertest fuer die Tagesserie (Bonus an Tag 3 und jedem 7. Tag). Rollt am Ende immer zurueck.
-- Aufruf: npx supabase db query --remote=<ref> --yes -f supabase/tests/streak.test.sql
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
  insert into public.activity (household_id, dog_id, user_id, kind)
    select hid, did, uid, k from (values ('feed'),('feed'),('play'),('play'),('play'),('train'),('train')) v(k);

  -- Serie 1 (nur heute): 3. Abholung gibt 5 + Tagesbonus 10, ohne Serienbonus
  perform public.claim_daily(1); perform public.claim_daily(2);
  c0 := (select coins from public.households where id = hid);
  r := public.claim_daily(3);
  if (r ->> 'bonus')::int <> 10 then raise exception 'FAIL: Bonus bei Serie 1 nicht 10 (%)', r; end if; n := n + 1;
  if (select coins from public.households where id = hid) <> c0 + 15 then raise exception 'FAIL: Muenzen bei Serie 1'; end if; n := n + 1;

  -- Serie 3: zwei volle Vortage dazu, heute die dritte Abholung gibt 10 + 15
  delete from public.daily_claims where household_id = hid and day = d and task = 3;
  insert into public.daily_claims (household_id, day, task) select hid, d - g, t from generate_series(1, 2) g, generate_series(1, 3) t;
  r := public.claim_daily(3);
  if (r ->> 'bonus')::int <> 25 then raise exception 'FAIL: Bonus bei Serie 3 nicht 25 (%)', r; end if; n := n + 1;

  -- Serie 4: kein Serienbonus
  delete from public.daily_claims where household_id = hid and day = d and task = 3;
  insert into public.daily_claims (household_id, day, task) select hid, d - 3, t from generate_series(1, 3) t;
  r := public.claim_daily(3);
  if (r ->> 'bonus')::int <> 10 then raise exception 'FAIL: Bonus bei Serie 4 nicht 10 (%)', r; end if; n := n + 1;

  -- Serie 7: sechs volle Vortage, Bonus 10 + 40
  delete from public.daily_claims where household_id = hid and day = d and task = 3;
  insert into public.daily_claims (household_id, day, task) select hid, d - g, t from generate_series(4, 6) g, generate_series(1, 3) t;
  r := public.claim_daily(3);
  if (r ->> 'bonus')::int <> 50 then raise exception 'FAIL: Bonus bei Serie 7 nicht 50 (%)', r; end if; n := n + 1;

  -- Luecke bricht die Serie: Tag d-2 fehlt, dann zaehlt nur heute und gestern (Serie 2, kein Serienbonus)
  delete from public.daily_claims where household_id = hid and day = d and task = 3;
  delete from public.daily_claims where household_id = hid and day = d - 2;
  r := public.claim_daily(3);
  if (r ->> 'bonus')::int <> 10 then raise exception 'FAIL: Bonus nach Luecke nicht 10 (%)', r; end if; n := n + 1;
  if public.daily_streak(hid) <> 2 then raise exception 'FAIL: Serie nach Luecke nicht 2'; end if; n := n + 1;

  raise exception 'TESTS OK (% Pruefungen)', n;
end;
$$;
