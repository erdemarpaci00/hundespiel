-- Schatzfund darf Ersparnisse nicht kappen: Muenzen einfach addieren (vorher least(100, ...)).
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
  update public.households set coins = coins + amount, find_at = now() where id = hid;
  return jsonb_build_object('coins', amount, 'what', names[1 + floor(random() * 4)::int]);
end;
$$;

