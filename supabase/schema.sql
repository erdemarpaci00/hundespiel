-- Hundespiel: Tabellen, Zeilen-Sicherheit (RLS) und Funktionen.
-- Im Supabase-Dashboard unter "SQL Editor" einfügen und ausführen.
-- Kann mehrfach ausgeführt werden.

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  invite_code text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 30),
  primary key (household_id, user_id)
);

create table if not exists public.dogs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  picked_by uuid not null references auth.users (id),
  is_starter boolean not null default false,
  name text not null check (char_length(trim(name)) between 1 and 20),
  look jsonb not null,
  personality jsonb not null,
  needs jsonb not null,
  needs_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Jeder wählt höchstens einen Starter-Hund.
create unique index if not exists dogs_one_starter_per_person
  on public.dogs (household_id, picked_by) where is_starter;

create table if not exists public.activity (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  dog_id uuid not null references public.dogs (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  kind text not null check (kind in ('adopt', 'feed', 'pet')),
  created_at timestamptz not null default now()
);

create index if not exists activity_household_time on public.activity (household_id, created_at desc);

-- Gehört der angemeldete Nutzer zu diesem Haushalt?
create or replace function public.is_member(hid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.members m where m.household_id = hid and m.user_id = auth.uid());
$$;

-- Höchstens zwei Mitglieder pro Haushalt.
create or replace function public.limit_members()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.members where household_id = new.household_id) >= 2 then
    raise exception 'Der Haushalt ist voll';
  end if;
  return new;
end;
$$;

drop trigger if exists members_limit on public.members;
create trigger members_limit before insert on public.members
  for each row execute function public.limit_members();

create or replace function public.clean_code(p_code text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[\s-]', '', 'g'));
$$;

create or replace function public.create_household(p_display_name text, p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if exists (select 1 from public.members where user_id = auth.uid()) then
    raise exception 'Du gehörst schon zu einem Haushalt';
  end if;
  insert into public.households (invite_code) values (public.clean_code(p_code)) returning id into hid;
  insert into public.members (household_id, user_id, display_name) values (hid, auth.uid(), trim(p_display_name));
  return hid;
end;
$$;

create or replace function public.join_household(p_display_name text, p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if exists (select 1 from public.members where user_id = auth.uid()) then
    raise exception 'Du gehörst schon zu einem Haushalt';
  end if;
  select id into hid from public.households where invite_code = public.clean_code(p_code) for update;
  if hid is null then raise exception 'Code unbekannt'; end if;
  insert into public.members (household_id, user_id, display_name) values (hid, auth.uid(), trim(p_display_name));
  return hid;
end;
$$;

-- Schreibt die Bedürfnisse nur, wenn niemand dazwischen war (needs_updated_at stimmt noch).
create or replace function public.update_needs(p_dog_id uuid, p_expected timestamptz, p_needs jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed int;
begin
  update public.dogs
     set needs = p_needs, needs_updated_at = now()
   where id = p_dog_id
     and needs_updated_at = p_expected
     and public.is_member(household_id);
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

revoke all on function public.create_household(text, text) from public, anon;
revoke all on function public.join_household(text, text) from public, anon;
revoke all on function public.update_needs(uuid, timestamptz, jsonb) from public, anon;
grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.join_household(text, text) to authenticated;
grant execute on function public.update_needs(uuid, timestamptz, jsonb) to authenticated;

-- Zeilen-Sicherheit: nur Mitglieder sehen und ändern Daten ihres Haushalts.
alter table public.households enable row level security;
alter table public.members enable row level security;
alter table public.dogs enable row level security;
alter table public.activity enable row level security;

drop policy if exists households_read on public.households;
create policy households_read on public.households for select to authenticated
  using (public.is_member(id));

drop policy if exists members_read on public.members;
create policy members_read on public.members for select to authenticated
  using (public.is_member(household_id));

drop policy if exists dogs_read on public.dogs;
create policy dogs_read on public.dogs for select to authenticated
  using (public.is_member(household_id));

drop policy if exists dogs_insert on public.dogs;
create policy dogs_insert on public.dogs for insert to authenticated
  with check (public.is_member(household_id) and picked_by = auth.uid());

drop policy if exists activity_read on public.activity;
create policy activity_read on public.activity for select to authenticated
  using (public.is_member(household_id));

drop policy if exists activity_insert on public.activity;
create policy activity_insert on public.activity for insert to authenticated
  with check (
    public.is_member(household_id)
    and user_id = auth.uid()
    and exists (select 1 from public.dogs d where d.id = dog_id and d.household_id = activity.household_id)
  );

-- Live-Aktualisierung (Realtime beachtet die Zeilen-Sicherheit).
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'dogs') then
    alter publication supabase_realtime add table public.dogs;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'activity') then
    alter publication supabase_realtime add table public.activity;
  end if;
end $$;
