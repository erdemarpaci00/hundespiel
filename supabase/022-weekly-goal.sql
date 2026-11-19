-- Hundespiel: Wochenziel. Ab Montag (Berlin) zaehlen alle Aktivitaeten ausser Aufnahme, bei 25 gibt es 30 Muenzen, einmal pro Woche.
create table if not exists public.weekly_claims (
  household_id uuid not null references public.households(id) on delete cascade,
  week date not null,
  primary key (household_id, week)
);
alter table public.weekly_claims enable row level security;

create or replace function public.weekly_count(p_hid uuid, p_week date)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.activity
   where household_id = p_hid and kind <> 'adopt'
     and created_at >= (p_week::timestamp at time zone 'Europe/Berlin');
$$;

create or replace function public.weekly_state()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  hid uuid;
  w date := date_trunc('week', now() at time zone 'Europe/Berlin')::date;
begin
  select household_id into hid from public.members where user_id = auth.uid();
  if hid is null then raise exception 'Kein Haushalt'; end if;
  return jsonb_build_object('count', public.weekly_count(hid, w), 'need', 25, 'reward', 30,
    'claimed', exists (select 1 from public.weekly_claims where household_id = hid and week = w));
end;
$$;

create or replace function public.claim_weekly()
returns int language plpgsql security definer set search_path = public as $$
declare
  hid uuid;
  w date := date_trunc('week', now() at time zone 'Europe/Berlin')::date;
begin
  select household_id into hid from public.members where user_id = auth.uid();
  if hid is null then raise exception 'Kein Haushalt'; end if;
  perform 1 from public.households where id = hid for update;
  if public.weekly_count(hid, w) < 25 then raise exception 'Wochenziel noch nicht geschafft'; end if;
  insert into public.weekly_claims (household_id, week) values (hid, w) on conflict do nothing;
  if not found then raise exception 'Schon abgeholt'; end if;
  update public.households set coins = coins + 30 where id = hid;
  return 30;
end;
$$;

revoke all on function public.weekly_state() from public, anon;
revoke all on function public.claim_weekly() from public, anon;
revoke all on function public.weekly_count(uuid, date) from public, anon, authenticated;
grant execute on function public.weekly_state() to authenticated;
grant execute on function public.claim_weekly() to authenticated;
