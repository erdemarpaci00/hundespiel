-- Tagesbuch: drei Aufgaben pro Tag fuer den ganzen Haushalt, Fortschritt aus dem Verlauf (activity), Belohnung einmal pro Aufgabe.
-- Alle drei: Bonus, dazu Serie (Tage in Folge komplett) mit Extra an Tag 3 und Tag 7. Tag = Berliner Datum.
create table if not exists public.daily_claims (
  household_id uuid not null references public.households(id) on delete cascade,
  day date not null,
  task int not null check (task between 1 and 3),
  primary key (household_id, day, task)
);
alter table public.daily_claims enable row level security;
revoke all on public.daily_claims from anon, authenticated;

create or replace function public.daily_progress(p_household uuid, p_day date)
returns int[]
language sql
stable
security definer
set search_path = public
as $$
  select array[
    (select count(*) from public.activity a where a.household_id = p_household and a.kind in ('feed', 'treat') and (a.created_at at time zone 'Europe/Berlin')::date = p_day)::int,
    (select count(*) from public.activity a where a.household_id = p_household and a.kind in ('play', 'pet', 'groom') and (a.created_at at time zone 'Europe/Berlin')::date = p_day)::int,
    (select count(*) from public.activity a where a.household_id = p_household and a.kind in ('train', 'contest') and (a.created_at at time zone 'Europe/Berlin')::date = p_day)::int
  ]
$$;

create or replace function public.daily_streak(p_household uuid)
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  d date := (now() at time zone 'Europe/Berlin')::date;
  n int := 0;
begin
  if (select count(*) from public.daily_claims where household_id = p_household and day = d) < 3 then
    d := d - 1;
  end if;
  while (select count(*) from public.daily_claims where household_id = p_household and day = d) >= 3 loop
    n := n + 1;
    d := d - 1;
  end loop;
  return n;
end;
$$;

create or replace function public.daily_state()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
  d date := (now() at time zone 'Europe/Berlin')::date;
  prog int[];
begin
  select household_id into hid from public.members where user_id = auth.uid();
  if hid is null then raise exception 'Kein Haushalt'; end if;
  prog := public.daily_progress(hid, d);
  return jsonb_build_object(
    'have', to_jsonb(prog),
    'claimed', (select coalesce(jsonb_agg(task order by task), '[]'::jsonb) from public.daily_claims where household_id = hid and day = d),
    'streak', public.daily_streak(hid)
  );
end;
$$;

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
    if streak = 7 then bonus := bonus + 40; end if;
  end if;
  update public.households set coins = coins + reward + bonus where id = hid;
  return jsonb_build_object('reward', reward, 'bonus', bonus);
end;
$$;

revoke all on function public.daily_progress(uuid, date), public.daily_streak(uuid) from public, anon, authenticated;
revoke all on function public.daily_state(), public.claim_daily(int) from public, anon;
grant execute on function public.daily_state(), public.claim_daily(int) to authenticated;
