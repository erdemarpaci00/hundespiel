-- Turniere (contest_win/contest_lose) zaehlen jetzt fuer die dritte Tagesaufgabe.
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
    (select count(*) from public.activity a where a.household_id = p_household and a.kind in ('train', 'contest', 'contest_win', 'contest_lose') and (a.created_at at time zone 'Europe/Berlin')::date = p_day)::int
  ]
$$;
