-- Halsbaender: dauerhafte Ausgabe fuer Muenzen. Ein Halsband pro Hund, jederzeit austauschbar.
alter table public.dogs add column if not exists collar text;

create or replace function public.buy_collar(p_dog uuid, p_color text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
  have int;
begin
  if p_color not in ('rot', 'blau', 'gruen', 'gelb', 'pink', 'lila') then raise exception 'Unbekanntes Halsband'; end if;
  select household_id into hid from public.dogs where id = p_dog;
  if hid is null or not public.is_member(hid) then raise exception 'Kein Zugriff'; end if;
  select coins into have from public.households where id = hid for update;
  if have < 25 then raise exception 'Nicht genug Münzen'; end if;
  update public.households set coins = coins - 25 where id = hid;
  update public.dogs set collar = p_color where id = p_dog;
  return have - 25;
end;
$$;

revoke all on function public.buy_collar(uuid, text) from public, anon;
grant execute on function public.buy_collar(uuid, text) to authenticated;
