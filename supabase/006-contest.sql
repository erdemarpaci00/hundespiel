-- Hundespiel: Wettkaempfe und Preisgeld. Nach 005-relations.sql ausfuehren. Mehrfach ausfuehrbar.
alter table public.dogs add column if not exists contest_at timestamptz;
alter table public.dogs add column if not exists trophies jsonb not null default '{}'::jsonb;

-- Ein Wettkampf: Energie sinkt (p_needs), Preisgeld geht aufs Haushaltskonto, ein Sieg zaehlt als Pokal.
-- Hoechstens ein Wettkampf pro Hund alle 10 Minuten; das Preisgeld ist pro Liga nach oben begrenzt.
-- Das Ergebnis wird im Client gewuerfelt, das Spiel ist privat, die Obergrenze schuetzt nur vor Tippfehlern.
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
  max_win := case p_league when 'bronze' then 20 when 'silber' then 45 when 'gold' then 90 when 'olympia' then 220 end;
  max_lose := case p_league when 'bronze' then 4 when 'silber' then 8 when 'gold' then 14 when 'olympia' then 30 end;
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

revoke all on function public.enter_contest(uuid, timestamptz, jsonb, text, boolean, int) from public, anon;
grant execute on function public.enter_contest(uuid, timestamptz, jsonb, text, boolean, int) to authenticated;
