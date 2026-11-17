-- Hundespiel Stufe B: Muenzen, Taschengeld, Vorrat, Kaufen, Fuettern aus dem Vorrat.
-- Nach schema.sql ausfuehren. Kann mehrfach ausgefuehrt werden.

alter table public.households add column if not exists coins int not null default 40 check (coins >= 0);
alter table public.households add column if not exists allowance_at timestamptz not null default now();

create table if not exists public.household_items (
  household_id uuid not null references public.households (id) on delete cascade,
  item text not null check (item in ('futter', 'leckerli', 'ball', 'buerste')),
  count int not null default 0 check (count >= 0),
  primary key (household_id, item)
);

alter table public.household_items enable row level security;

drop policy if exists household_items_read on public.household_items;
create policy household_items_read on public.household_items for select to authenticated
  using (public.is_member(household_id));

-- Nur Zahlen zwischen 0 und 100, alle drei Schluessel muessen da sein.
create or replace function public.valid_needs(p jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select jsonb_typeof(p) = 'object'
     and jsonb_typeof(p -> 'hunger') = 'number'
     and jsonb_typeof(p -> 'energy') = 'number'
     and jsonb_typeof(p -> 'happiness') = 'number'
     and (p ->> 'hunger')::numeric between 0 and 100
     and (p ->> 'energy')::numeric between 0 and 100
     and (p ->> 'happiness')::numeric between 0 and 100
$$;

create or replace function public.update_needs(p_dog_id uuid, p_expected timestamptz, p_needs jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed int;
begin
  if not public.valid_needs(p_needs) then
    raise exception 'Ungültige Werte';
  end if;
  update public.dogs
     set needs = p_needs, needs_updated_at = now()
   where id = p_dog_id
     and needs_updated_at = p_expected
     and public.is_member(household_id);
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

create or replace function public.item_price(p_item text)
returns int
language sql
immutable
set search_path = public
as $$
  select case p_item when 'futter' then 5 when 'leckerli' then 3 when 'ball' then 12 when 'buerste' then 15 end
$$;

-- Taschengeld: alle 30 Minuten 3 Muenzen, solange man unter 60 hat. Startpaket: 3 Portionen Futter.
create or replace function public.economy_state(p_household uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  h public.households%rowtype;
  periods int;
  new_coins int;
begin
  select * into h from public.households where id = p_household for update;
  insert into public.household_items (household_id, item, count) values (p_household, 'futter', 3) on conflict do nothing;
  insert into public.household_items (household_id, item, count)
    values (p_household, 'leckerli', 0), (p_household, 'ball', 0), (p_household, 'buerste', 0) on conflict do nothing;
  periods := floor(extract(epoch from (now() - h.allowance_at)) / 1800)::int;
  if h.coins >= 60 then
    update public.households set allowance_at = now() where id = p_household;
  elsif periods > 0 then
    new_coins := least(60, h.coins + periods * 3);
    update public.households
       set coins = new_coins,
           allowance_at = case when new_coins >= 60 then now() else h.allowance_at + periods * interval '30 minutes' end
     where id = p_household;
  end if;
  return (
    select jsonb_build_object(
      'coins', (select coins from public.households where id = p_household),
      'items', (select coalesce(jsonb_object_agg(item, count), '{}'::jsonb) from public.household_items where household_id = p_household)
    )
  );
end;
$$;

create or replace function public.my_economy()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
begin
  select household_id into hid from public.members where user_id = auth.uid();
  if hid is null then
    raise exception 'Kein Haushalt';
  end if;
  return public.economy_state(hid);
end;
$$;

create or replace function public.buy_item(p_item text, p_qty int default 1)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
  price int;
  state jsonb;
  have int;
begin
  select household_id into hid from public.members where user_id = auth.uid();
  if hid is null then
    raise exception 'Kein Haushalt';
  end if;
  price := public.item_price(p_item);
  if price is null then
    raise exception 'Unbekannter Gegenstand';
  end if;
  if p_qty is null or p_qty < 1 or p_qty > 10 then
    raise exception 'Ungültige Menge';
  end if;
  state := public.economy_state(hid);
  select count into have from public.household_items where household_id = hid and item = p_item;
  if p_item in ('ball', 'buerste') and (have >= 1 or p_qty > 1) then
    raise exception 'Das habt ihr schon';
  end if;
  if (state ->> 'coins')::int < price * p_qty then
    raise exception 'Zu wenig Münzen';
  end if;
  update public.households set coins = coins - price * p_qty where id = hid;
  update public.household_items set count = count + p_qty where household_id = hid and item = p_item;
  return public.economy_state(hid);
end;
$$;

-- Fuettern aus dem Vorrat in einem Schritt: Vorrat sinkt nur, wenn die Werte auch geschrieben wurden.
create or replace function public.feed_dog(p_dog_id uuid, p_expected timestamptz, p_needs jsonb, p_item text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
  stock int;
  changed int;
begin
  if p_item not in ('futter', 'leckerli') then
    raise exception 'Das kann man nicht füttern';
  end if;
  if not public.valid_needs(p_needs) then
    raise exception 'Ungültige Werte';
  end if;
  select household_id into hid from public.dogs where id = p_dog_id;
  if hid is null or not public.is_member(hid) then
    return false;
  end if;
  perform public.economy_state(hid);
  select count into stock from public.household_items where household_id = hid and item = p_item for update;
  if coalesce(stock, 0) < 1 then
    raise exception 'Kein Futter mehr';
  end if;
  update public.dogs set needs = p_needs, needs_updated_at = now()
   where id = p_dog_id and needs_updated_at = p_expected;
  get diagnostics changed = row_count;
  if changed = 1 then
    update public.household_items set count = count - 1 where household_id = hid and item = p_item;
  end if;
  return changed = 1;
end;
$$;

-- Live-Aktualisierung der Muenzen und des Vorrats.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'household_items') then
    alter publication supabase_realtime add table public.household_items;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'households') then
    alter publication supabase_realtime add table public.households;
  end if;
end $$;

revoke all on function public.valid_needs(jsonb), public.item_price(text), public.economy_state(uuid), public.my_economy(),
  public.buy_item(text, int), public.feed_dog(uuid, timestamptz, jsonb, text) from public, anon;
grant execute on function public.my_economy(), public.buy_item(text, int), public.feed_dog(uuid, timestamptz, jsonb, text),
  public.update_needs(uuid, timestamptz, jsonb) to authenticated;
