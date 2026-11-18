-- Zuhause ausbauen: Stufe 0 bis 3, bezahlt mit Muenzen. Kann mehrfach ausgefuehrt werden. Nach 002-economy.sql.
alter table public.households add column if not exists home_level int not null default 0 check (home_level between 0 and 3);

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
      'home', (select home_level from public.households where id = p_household),
      'items', (select coalesce(jsonb_object_agg(item, count), '{}'::jsonb) from public.household_items where household_id = p_household)
    )
  );
end;
$$;

create or replace function public.upgrade_home()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
  lvl int;
  price int;
  state jsonb;
begin
  select household_id into hid from public.members where user_id = auth.uid();
  if hid is null then
    raise exception 'Kein Haushalt';
  end if;
  state := public.economy_state(hid);
  lvl := (state ->> 'home')::int;
  if lvl >= 3 then
    raise exception 'Das Zuhause ist schon ganz ausgebaut';
  end if;
  price := case lvl when 0 then 80 when 1 then 200 else 500 end;
  if (state ->> 'coins')::int < price then
    raise exception 'Zu wenig Münzen';
  end if;
  update public.households set coins = coins - price, home_level = lvl + 1 where id = hid;
  return public.economy_state(hid);
end;
$$;

revoke all on function public.economy_state(uuid), public.upgrade_home() from public, anon;
grant execute on function public.upgrade_home() to authenticated;
