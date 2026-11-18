-- Verlauf unterscheidet Turniersieg und Niederlage. Kann mehrfach ausgefuehrt werden.
alter table public.activity drop constraint if exists activity_kind_check;
alter table public.activity add constraint activity_kind_check
  check (kind in ('adopt', 'feed', 'pet', 'train', 'play', 'groom', 'contest', 'treat', 'contest_win', 'contest_lose'));
