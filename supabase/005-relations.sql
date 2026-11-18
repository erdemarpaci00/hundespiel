-- Hundespiel: Freundschaften zwischen Hunden. Nach 004-adopt.sql ausfuehren. Mehrfach ausfuehrbar.
create table if not exists public.dog_relations (
  dog_a uuid not null references public.dogs (id) on delete cascade,
  dog_b uuid not null references public.dogs (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  meetings int not null default 0,
  last_at timestamptz,
  primary key (dog_a, dog_b),
  check (dog_a < dog_b)
);

alter table public.dog_relations enable row level security;
drop policy if exists dog_relations_read on public.dog_relations;
create policy dog_relations_read on public.dog_relations for select to authenticated
  using (public.is_member(household_id));

-- Zaehlt eine Begegnung, hoechstens eine alle 10 Minuten pro Paar.
create or replace function public.record_meeting(p_a uuid, p_b uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  a uuid := least(p_a, p_b);
  b uuid := greatest(p_a, p_b);
  ha uuid;
  hb uuid;
  total int;
begin
  if a = b then
    raise exception 'Ungültiges Paar';
  end if;
  select household_id into ha from public.dogs where id = a;
  select household_id into hb from public.dogs where id = b;
  if ha is null or ha <> hb or not public.is_member(ha) then
    return -1;
  end if;
  insert into public.dog_relations (dog_a, dog_b, household_id, meetings, last_at)
    values (a, b, ha, 1, now())
  on conflict (dog_a, dog_b) do update
    set meetings = case when public.dog_relations.last_at < now() - interval '10 minutes' then public.dog_relations.meetings + 1 else public.dog_relations.meetings end,
        last_at = case when public.dog_relations.last_at < now() - interval '10 minutes' then now() else public.dog_relations.last_at end
  returning meetings into total;
  return total;
end;
$$;

revoke all on function public.record_meeting(uuid, uuid) from public, anon;
grant execute on function public.record_meeting(uuid, uuid) to authenticated;
