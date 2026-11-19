-- Hundenamen sind pro Haushalt eindeutig (ohne Gross-/Kleinschreibung). Mehrfach ausfuehrbar.
create unique index if not exists dogs_unique_name_per_household
  on public.dogs (household_id, lower(trim(name)));
