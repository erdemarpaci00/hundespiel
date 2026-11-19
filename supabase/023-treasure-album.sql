-- Hundespiel: Album der Funde. Jeder Schatz von der Schatzsuche wird pro Haushalt gezaehlt.
create table if not exists public.treasure_finds (
  household_id uuid not null references public.households(id) on delete cascade,
  what text not null,
  n int not null default 0,
  primary key (household_id, what)
);
alter table public.treasure_finds enable row level security;
drop policy if exists treasure_finds_read on public.treasure_finds;
create policy treasure_finds_read on public.treasure_finds for select to authenticated using (public.is_member(household_id));

create or replace function public.find_treasure(p_dog_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
  last_at timestamptz;
  amount int;
  names text[] := array['einen Knochen', 'eine alte Münze', 'einen vergrabenen Schatz', 'einen glänzenden Stein'];
  pick text;
begin
  select household_id into hid from public.dogs where id = p_dog_id;
  if hid is null or not public.is_member(hid) then
    return null;
  end if;
  select find_at into last_at from public.households where id = hid for update;
  if last_at > now() - interval '20 minutes' then
    return null;
  end if;
  perform public.economy_state(hid);
  amount := 2 + floor(random() * 4)::int;
  pick := names[1 + floor(random() * 4)::int];
  update public.households set coins = coins + amount, find_at = now() where id = hid;
  insert into public.activity (household_id, dog_id, user_id, kind) values (hid, p_dog_id, auth.uid(), 'play');
  insert into public.treasure_finds (household_id, what, n) values (hid, pick, 1)
    on conflict (household_id, what) do update set n = public.treasure_finds.n + 1;
  return jsonb_build_object('coins', amount, 'what', pick);
end;
$$;
