-- Hundespiel: Adoption aus dem Hundeheim. Nach 003-training.sql ausfuehren. Mehrfach ausfuehrbar.

-- Direktes Einfuegen nur noch fuer den Starter-Hund, alle weiteren Hunde nur ueber adopt_dog (kostet Muenzen).
drop policy if exists dogs_insert on public.dogs;
create policy dogs_insert on public.dogs for insert to authenticated
  with check (public.is_member(household_id) and picked_by = auth.uid() and is_starter);

create or replace function public.adopt_dog(p_name text, p_look jsonb, p_personality jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
  state jsonb;
  n int;
  new_id uuid;
  clean text := trim(coalesce(p_name, ''));
begin
  select household_id into hid from public.members where user_id = auth.uid();
  if hid is null then
    raise exception 'Kein Haushalt';
  end if;
  if char_length(clean) < 1 or char_length(clean) > 20 then
    raise exception 'Ungültiger Name';
  end if;
  if jsonb_typeof(p_look) <> 'object' or jsonb_typeof(p_personality) <> 'object' then
    raise exception 'Ungültiger Hund';
  end if;
  perform 1 from public.households where id = hid for update;
  select count(*) into n from public.dogs where household_id = hid;
  if n >= 4 then
    raise exception 'Mehr als vier Hunde passen nicht in die Wohnung';
  end if;
  state := public.economy_state(hid);
  if (state ->> 'coins')::int < 50 then
    raise exception 'Zu wenig Münzen';
  end if;
  update public.households set coins = coins - 50 where id = hid;
  insert into public.dogs (household_id, picked_by, is_starter, name, look, personality, needs)
    values (hid, auth.uid(), false, clean, p_look, p_personality, '{"hunger":100,"energy":100,"happiness":100}'::jsonb)
    returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.adopt_dog(text, jsonb, jsonb) from public, anon;
grant execute on function public.adopt_dog(text, jsonb, jsonb) to authenticated;
