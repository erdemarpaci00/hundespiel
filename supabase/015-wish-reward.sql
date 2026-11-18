-- Erfuellter Hundewunsch: +2 Muenzen, hoechstens alle 10 Minuten pro Haushalt (Schutz gegen Dauerklicken).
alter table public.households add column if not exists wish_at timestamptz not null default now() - interval '1 day';

create or replace function public.wish_reward()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
  last_at timestamptz;
begin
  select household_id into hid from public.members where user_id = auth.uid();
  if hid is null then raise exception 'Kein Haushalt'; end if;
  select wish_at into last_at from public.households where id = hid for update;
  if last_at > now() - interval '10 minutes' then
    return 0;
  end if;
  update public.households set coins = coins + 2, wish_at = now() where id = hid;
  return 2;
end;
$$;

revoke all on function public.wish_reward() from public, anon;
grant execute on function public.wish_reward() to authenticated;
