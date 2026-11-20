-- Servertest fuer Muenzen, Einkauf, Fuettern und Haufen aufraeumen. Laeuft in einer Transaktion, die am Ende immer zurueckgerollt wird.
-- Aufruf: npx supabase db query --remote=<ref> --yes -f supabase/tests/economy.test.sql
-- Erfolg: Fehlermeldung "TESTS OK (n Pruefungen)". Alles andere ist ein Fehlschlag.
do $$
declare
  uid uuid := gen_random_uuid();
  hid uuid;
  did uuid;
  stamp timestamptz;
  pid uuid;
  ok boolean;
  n int := 0;
  needs jsonb := '{"hunger":50,"energy":40,"happiness":60}';
begin
  insert into auth.users (id, email, instance_id, aud, role) values (uid, 'sqltest-' || uid || '@example.invalid', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
  insert into public.households (invite_code) values ('E' || substr(uid::text, 1, 7)) returning id into hid;
  insert into public.members (household_id, user_id, display_name) values (hid, uid, 'Test');
  insert into public.dogs (household_id, picked_by, is_starter, name, look, personality, needs)
    values (hid, uid, true, 'Tester', '{}', '{}', '{"hunger":80,"energy":80,"happiness":80}') returning id, needs_updated_at into did, stamp;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  update public.households set coins = 20 where id = hid;
  perform public.my_economy();

  -- Einkauf 1: 2 Futter kosten 10, Muenzen und Vorrat stimmen
  perform public.buy_item('futter', 2);
  if (select coins from public.households where id = hid) <> 10 then raise exception 'FAIL: Muenzen nach Kauf nicht 10'; end if;
  if (select count from public.household_items where household_id = hid and item = 'futter') <> 5 then raise exception 'FAIL: Vorrat nicht 5'; end if; n := n + 1;

  -- Einkauf 2: zu wenig Muenzen wird abgelehnt, nichts wird abgebucht
  begin
    perform public.buy_item('buerste', 1);
    raise exception 'FAIL: Buerste ohne genug Muenzen gekauft';
  exception when others then
    if sqlerrm not like '%Zu wenig%' then raise; end if;
  end; n := n + 1;
  if (select coins from public.households where id = hid) <> 10 then raise exception 'FAIL: Muenzen nach Ablehnung veraendert'; end if; n := n + 1;

  -- Einkauf 3: unbekannter Gegenstand und ungueltige Menge
  begin perform public.buy_item('gold', 1); raise exception 'FAIL: unbekannter Gegenstand gekauft';
  exception when others then if sqlerrm not like '%Unbekannt%' then raise; end if; end; n := n + 1;
  begin perform public.buy_item('futter', 11); raise exception 'FAIL: Menge 11 akzeptiert';
  exception when others then if sqlerrm not like '%Menge%' then raise; end if; end; n := n + 1;

  -- Einkauf 4: Ball gibt es als Startgeschenk, ein zweiter wird abgelehnt; die Buerste nur einmal
  update public.households set coins = 40 where id = hid;
  begin perform public.buy_item('ball', 1); raise exception 'FAIL: zweiter Ball gekauft';
  exception when others then if sqlerrm not like '%schon%' then raise; end if; end; n := n + 1;
  perform public.buy_item('buerste', 1);
  begin perform public.buy_item('buerste', 1); raise exception 'FAIL: zweite Buerste gekauft';
  exception when others then if sqlerrm not like '%schon%' then raise; end if; end; n := n + 1;
  update public.households set coins = 40 where id = hid;

  -- Fuettern 1: schreibt die Werte und senkt den Vorrat um 1
  ok := public.feed_dog(did, stamp, '{"hunger":90,"energy":40,"happiness":60}', 'futter');
  if not ok then raise exception 'FAIL: Fuettern nicht uebernommen'; end if;
  if (select count from public.household_items where household_id = hid and item = 'futter') <> 4 then raise exception 'FAIL: Vorrat nach Fuettern nicht 4'; end if; n := n + 1;

  -- Fuettern 2: hat jemand anderes den Hund inzwischen geaendert (now() ist in einer Transaktion fest, daher per Hand), passiert nichts, der Vorrat bleibt
  update public.dogs set needs_updated_at = stamp - interval '1 minute' where id = did;
  ok := public.feed_dog(did, stamp, '{"hunger":99,"energy":40,"happiness":60}', 'futter');
  if ok then raise exception 'FAIL: veralteter Stand wurde geschrieben'; end if;
  if (select count from public.household_items where household_id = hid and item = 'futter') <> 4 then raise exception 'FAIL: Vorrat bei veraltetem Stand gesunken'; end if; n := n + 1;

  -- Fuettern 3: kein Vorrat wird abgelehnt
  update public.household_items set count = 0 where household_id = hid and item = 'leckerli';
  begin perform public.feed_dog(did, (select needs_updated_at from public.dogs where id = did), needs, 'leckerli'); raise exception 'FAIL: ohne Vorrat gefuettert';
  exception when others then if sqlerrm not like '%Kein Futter%' then raise; end if; end; n := n + 1;

  -- Haufen: frischer Haufen gibt nichts, alter gibt 1 Muenze
  perform public.drop_poop(100, 100);
  select id into pid from public.poops where household_id = hid;
  if public.clean_poop(pid) <> 0 then raise exception 'FAIL: frischer Haufen gab Belohnung'; end if; n := n + 1;
  insert into public.poops (household_id, x, y, created_at) values (hid, 5, 5, now() - interval '10 minutes') returning id into pid;
  if public.clean_poop(pid) <> 1 then raise exception 'FAIL: alter Haufen gab keine Belohnung'; end if;
  if exists (select 1 from public.poops where id = pid) then raise exception 'FAIL: Haufen nicht geloescht'; end if; n := n + 1;

  raise exception 'TESTS OK (% Pruefungen)', n;
end;
$$;
