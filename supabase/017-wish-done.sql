-- Erfuellte Wuensche gelten fuer den ganzen Haushalt (beide Handys) und bleiben nach Szenenwechsel erhalten.
create table if not exists public.wish_done (
  dog_id uuid not null references public.dogs(id) on delete cascade,
  block bigint not null,
  household_id uuid not null references public.households(id) on delete cascade,
  primary key (dog_id, block)
);
alter table public.wish_done enable row level security;
drop policy if exists wish_done_select on public.wish_done;
create policy wish_done_select on public.wish_done for select using (public.is_member(household_id));
revoke all on public.wish_done from anon;
revoke insert, update, delete on public.wish_done from authenticated;

drop function if exists public.wish_reward();

-- Merkt den erfuellten Wunsch und zahlt +2 Muenzen (hoechstens alle 10 Minuten pro Haushalt).
-- Liefert die gezahlten Muenzen, 0 wenn der Wunsch schon erfuellt war oder die Pause laeuft.
create or replace function public.wish_reward(p_dog uuid, p_block bigint)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
  last_at timestamptz;
  added int;
begin
  select household_id into hid from public.dogs where id = p_dog;
  if hid is null or not public.is_member(hid) then raise exception 'Kein Zugriff'; end if;
  insert into public.wish_done (dog_id, block, household_id) values (p_dog, p_block, hid) on conflict do nothing;
  get diagnostics added = row_count;
  if added = 0 then return 0; end if;
  select wish_at into last_at from public.households where id = hid for update;
  if last_at > now() - interval '10 minutes' then return 0; end if;
  update public.households set coins = coins + 2, wish_at = now() where id = hid;
  return 2;
end;
$$;

revoke all on function public.wish_reward(uuid, bigint) from public, anon;
grant execute on function public.wish_reward(uuid, bigint) to authenticated;
