-- Hundespiel: Training. Nach 002-economy.sql ausfuehren. Kann mehrfach ausgefuehrt werden.

alter table public.dogs add column if not exists training jsonb not null default '{"tempo":0,"ausdauer":0,"sprungkraft":0,"gehorsam":0}'::jsonb;
alter table public.dogs add column if not exists trained_at timestamptz;

-- Ein Trainingsdurchgang: Bedürfnisse (Energie sinkt) und der geuebte Wert werden zusammen geschrieben,
-- nur wenn niemand dazwischen war. Hoechstens alle 20 Sekunden pro Hund, Gewinn 1 bis 3, Wert hoechstens 100.
create or replace function public.train_dog(p_dog_id uuid, p_expected timestamptz, p_needs jsonb, p_stat text, p_gain int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
  last_at timestamptz;
  cur int;
  changed int;
begin
  if p_stat not in ('tempo', 'ausdauer', 'sprungkraft', 'gehorsam') then
    raise exception 'Unbekannte Übung';
  end if;
  if p_gain is null or p_gain < 1 or p_gain > 3 then
    raise exception 'Ungültiger Gewinn';
  end if;
  if not public.valid_needs(p_needs) then
    raise exception 'Ungültige Werte';
  end if;
  select household_id, trained_at, coalesce((training ->> p_stat)::int, 0) into hid, last_at, cur
    from public.dogs where id = p_dog_id;
  if hid is null or not public.is_member(hid) then
    return false;
  end if;
  if last_at is not null and now() - last_at < interval '3 seconds' then
    raise exception 'Zu schnell hintereinander';
  end if;
  update public.dogs
     set needs = p_needs,
         needs_updated_at = now(),
         trained_at = now(),
         training = jsonb_set(training, array[p_stat], to_jsonb(least(100, cur + p_gain)))
   where id = p_dog_id and needs_updated_at = p_expected;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

revoke all on function public.train_dog(uuid, timestamptz, jsonb, text, int) from public, anon;
grant execute on function public.train_dog(uuid, timestamptz, jsonb, text, int) to authenticated;
