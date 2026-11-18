-- Startgeschenk: ein Ball im Startpaket neuer Haushalte (bestehende bleiben unveraendert).
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
    values (p_household, 'leckerli', 0), (p_household, 'buerste', 0) on conflict do nothing;
  insert into public.household_items (household_id, item, count) values (p_household, 'ball', 1) on conflict do nothing;
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
