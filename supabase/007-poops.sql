-- Hundespiel: gemeinsame Haeufchen im Garten. Nach 006-contest.sql ausfuehren. Mehrfach ausfuehrbar.
create table if not exists public.poops (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  x int not null check (x between 0 and 640),
  y int not null check (y between 0 and 360),
  created_at timestamptz not null default now()
);
alter table public.poops enable row level security;
drop policy if exists poops_read on public.poops;
create policy poops_read on public.poops for select to authenticated using (public.is_member(household_id));

-- Neuer Haufen: hoechstens 6 pro Haushalt, sonst stillschweigend nichts.
create or replace function public.drop_poop(p_x int, p_y int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
begin
  select household_id into hid from public.members where user_id = auth.uid() limit 1;
  if hid is null then
    return false;
  end if;
  if (select count(*) from public.poops where household_id = hid) >= 6 then
    return false;
  end if;
  insert into public.poops (household_id, x, y) values (hid, greatest(0, least(640, p_x)), greatest(0, least(360, p_y)));
  return true;
end;
$$;

-- Aufraeumen: der Haufen verschwindet; war er laenger als 5 Minuten da, gibt es 1 Muenze Belohnung.
create or replace function public.clean_poop(p_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
  born timestamptz;
  reward int := 0;
begin
  select household_id, created_at into hid, born from public.poops where id = p_id;
  if hid is null or not public.is_member(hid) then
    return -1;
  end if;
  delete from public.poops where id = p_id;
  if born < now() - interval '5 minutes' then
    update public.households set coins = coins + 1 where id = hid;
    reward := 1;
  end if;
  return reward;
end;
$$;

revoke all on function public.drop_poop(int, int), public.clean_poop(uuid) from public, anon;
grant execute on function public.drop_poop(int, int), public.clean_poop(uuid) to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'poops') then
    alter publication supabase_realtime add table public.poops;
  end if;
end $$;
