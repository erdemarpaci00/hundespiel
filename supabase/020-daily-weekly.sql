-- Wochenbonus +40 gilt jetzt an jedem 7. Tag der Serie (7, 14, 21, ...), nicht nur einmal.
create or replace function public.claim_daily(p_task int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
  d date := (now() at time zone 'Europe/Berlin')::date;
  prog int[];
  need int[] := array[2, 3, 2];
  reward int := 5;
  bonus int := 0;
  streak int;
begin
  select household_id into hid from public.members where user_id = auth.uid();
  if hid is null then raise exception 'Kein Haushalt'; end if;
  if p_task not between 1 and 3 then raise exception 'Ungültige Aufgabe'; end if;
  perform 1 from public.households where id = hid for update;
  prog := public.daily_progress(hid, d);
  if prog[p_task] < need[p_task] then raise exception 'Aufgabe noch nicht geschafft'; end if;
  insert into public.daily_claims (household_id, day, task) values (hid, d, p_task) on conflict do nothing;
  if not found then raise exception 'Schon abgeholt'; end if;
  if (select count(*) from public.daily_claims where household_id = hid and day = d) = 3 then
    bonus := 10;
    streak := public.daily_streak(hid);
    if streak = 3 then bonus := bonus + 15; end if;
    if streak >= 7 and streak % 7 = 0 then bonus := bonus + 40; end if;
  end if;
  update public.households set coins = coins + reward + bonus where id = hid;
  return jsonb_build_object('reward', reward, 'bonus', bonus);
end;
$$;
