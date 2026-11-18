-- Preisgeld gesenkt (Silber 30, Gold 60, Olympia 120), damit Muenzen ihren Wert behalten.
create or replace function public.enter_contest(p_dog_id uuid, p_expected timestamptz, p_needs jsonb, p_league text, p_won boolean, p_prize int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
  last_at timestamptz;
  max_win int;
  max_lose int;
  changed int;
begin
  max_win := case p_league when 'bronze' then 15 when 'silber' then 30 when 'gold' then 60 when 'olympia' then 120 end;
  max_lose := case p_league when 'bronze' then 5 when 'silber' then 8 when 'gold' then 12 when 'olympia' then 20 end;
  if max_win is null then
    raise exception 'Unbekannte Liga';
  end if;
  if p_prize is null or p_prize < 0 or p_prize > (case when p_won then max_win else max_lose end) then
    raise exception 'Ungültiges Preisgeld';
  end if;
  if not public.valid_needs(p_needs) then
    raise exception 'Ungültige Werte';
  end if;
  select household_id, contest_at into hid, last_at from public.dogs where id = p_dog_id;
  if hid is null or not public.is_member(hid) then
    return false;
  end if;
  if last_at is not null and now() - last_at < interval '10 minutes' then
    raise exception 'Zu schnell hintereinander';
  end if;
  update public.dogs
     set needs = p_needs,
         needs_updated_at = now(),
         contest_at = now(),
         trophies = case when p_won
           then jsonb_set(trophies, array[p_league], to_jsonb(coalesce((trophies ->> p_league)::int, 0) + 1))
           else trophies end
   where id = p_dog_id and needs_updated_at = p_expected;
  get diagnostics changed = row_count;
  if changed = 1 then
    update public.households set coins = coins + p_prize where id = hid;
  end if;
  return changed = 1;
end;
$$;
