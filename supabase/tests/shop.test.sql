-- Servertest fuer Halsband, Zuhause ausbauen und Hund adoptieren. Rollt am Ende immer zurueck.
-- Aufruf: npx supabase db query --remote=<ref> --yes -f supabase/tests/shop.test.sql
-- Erfolg: Fehlermeldung "TESTS OK (n Pruefungen)".
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
  insert into public.households (invite_code) values ('H' || substr(uid::text, 1, 7)) returning id into hid;
  insert into public.members (household_id, user_id, display_name) values (hid, uid, 'Test');
  insert into public.dogs (household_id, picked_by, is_starter, name, look, personality, needs)
    values (hid, uid, true, 'Tester', '{}', '{}', '{"hunger":80,"energy":80,"happiness":80}') returning id, needs_updated_at into did, stamp;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  update public.households set coins = 20 where id = hid;
  perform public.my_economy();
  -- Halsband: zu wenig Muenzen, unbekannte Farbe, Kauf
  update public.households set coins = 10 where id = hid;
  begin perform public.buy_collar(did, 'rot'); raise exception 'FAIL: Halsband ohne Muenzen';
  exception when others then if sqlerrm not like '%Nicht genug%' then raise; end if; end; n := n + 1;
  update public.households set coins = 100 where id = hid;
  begin perform public.buy_collar(did, 'schwarz'); raise exception 'FAIL: unbekannte Farbe';
  exception when others then if sqlerrm not like '%Unbekanntes%' then raise; end if; end; n := n + 1;
  if public.buy_collar(did, 'blau') <> 75 then raise exception 'FAIL: Restmuenzen nach Halsband nicht 75'; end if; n := n + 1;
  if (select collar from public.dogs where id = did) <> 'blau' then raise exception 'FAIL: Halsband nicht gesetzt'; end if; n := n + 1;

  -- Zuhause: Stufe 1 kostet 80, Stufe 2 kostet 200, zu wenig Muenzen wird abgelehnt
  begin perform public.upgrade_home(); raise exception 'FAIL: Ausbau mit 75 Muenzen';
  exception when others then if sqlerrm not like '%Zu wenig%' then raise; end if; end; n := n + 1;
  update public.households set coins = 300 where id = hid;
  perform public.upgrade_home();
  if (select coins from public.households where id = hid) <> 220 then raise exception 'FAIL: Stufe 1 kostet nicht 80'; end if; n := n + 1;
  perform public.upgrade_home();
  if (select coins from public.households where id = hid) <> 20 then raise exception 'FAIL: Stufe 2 kostet nicht 200'; end if; n := n + 1;
  if (select home_level from public.households where id = hid) <> 2 then raise exception 'FAIL: Stufe nicht 2'; end if; n := n + 1;

  -- Hund adoptieren: Name, Muenzen, Hundegrenze
  begin perform public.adopt_dog('   ', '{}', '{}'); raise exception 'FAIL: leerer Name';
  exception when others then if sqlerrm not like '%Ungültiger Name%' then raise; end if; end; n := n + 1;
  begin perform public.adopt_dog('Rex', '[]', '{}'); raise exception 'FAIL: Look kein Objekt';
  exception when others then if sqlerrm not like '%Ungültiger Hund%' then raise; end if; end; n := n + 1;
  update public.households set coins = 40 where id = hid;
  begin perform public.adopt_dog('Rex', '{}', '{}'); raise exception 'FAIL: Adoption ohne Muenzen';
  exception when others then if sqlerrm not like '%Zu wenig%' then raise; end if; end; n := n + 1;
  update public.households set coins = 500 where id = hid;
  perform public.adopt_dog('  Rex  ', '{}', '{}');
  if not exists (select 1 from public.dogs where household_id = hid and name = 'Rex') then raise exception 'FAIL: Name nicht getrimmt'; end if; n := n + 1;
  if (select coins from public.households where id = hid) <> 450 then raise exception 'FAIL: Adoption kostet nicht 50'; end if; n := n + 1;
  perform public.adopt_dog('A', '{}', '{}'); perform public.adopt_dog('B', '{}', '{}');
  begin perform public.adopt_dog('C', '{}', '{}'); raise exception 'FAIL: fuenfter Hund erlaubt';
  exception when others then if sqlerrm not like '%vier Hunde%' then raise; end if; end; n := n + 1;

  raise exception 'TESTS OK (% Pruefungen)', n;
end;
$$;
