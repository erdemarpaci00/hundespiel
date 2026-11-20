-- Handy-Mitteilungen: Anmeldungen der Geraete und ein Ausloeser, der bei neuer Aktivitaet die Funktion "notify" anstoesst.
-- Das gemeinsame Geheimnis (push_secret) liegt im Vault und wird nicht in dieser Datei gespeichert.
create extension if not exists pg_net;

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  last_sent timestamptz not null default 'epoch'
);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
begin
  select household_id into hid from public.members where user_id = auth.uid();
  if hid is null then raise exception 'Kein Haushalt'; end if;
  if coalesce(p_endpoint, '') !~ '^https://' or char_length(p_endpoint) > 1000 or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'Ungültige Anmeldung';
  end if;
  insert into public.push_subscriptions (endpoint, user_id, household_id, p256dh, auth)
    values (p_endpoint, auth.uid(), hid, p_p256dh, p_auth)
    on conflict (endpoint) do update set user_id = auth.uid(), household_id = hid, p256dh = p_p256dh, auth = p_auth;
end;
$$;

create or replace function public.remove_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

revoke all on function public.save_push_subscription(text, text, text), public.remove_push_subscription(text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text), public.remove_push_subscription(text) to authenticated;

-- Ausloeser: nur Aktivitaeten, die der Partner sehen soll. Fehler hier duerfen das Speichern nie verhindern.
create or replace function public.notify_activity()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  secret text;
begin
  if new.kind not in ('feed', 'pet', 'play', 'groom', 'treat', 'contest_win') then return new; end if;
  if not exists (select 1 from public.push_subscriptions where household_id = new.household_id and user_id <> new.user_id) then return new; end if;
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'push_secret';
  if secret is null then return new; end if;
  perform net.http_post(
    url := 'https://arxtcreuxfxjouwkfqdy.supabase.co/functions/v1/notify',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', secret),
    body := jsonb_build_object('activity_id', new.id)
  );
  return new;
exception when others then
  return new;
end;
$$;
revoke all on function public.notify_activity() from public, anon, authenticated;

drop trigger if exists activity_notify on public.activity;
create trigger activity_notify after insert on public.activity for each row execute function public.notify_activity();
