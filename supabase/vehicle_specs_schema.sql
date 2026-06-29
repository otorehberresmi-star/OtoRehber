-- Real technical vehicle specifications used by comparison detail screens.
-- This table is intentionally read-only for client users. Populate it with
-- trusted imports, admin SQL, or a service-role backend job.

create table if not exists public.vehicle_specs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.brands(id) on delete set null,
  model_id uuid not null references public.models(id) on delete cascade,
  year text,
  trim text,
  engine text,
  fuel_type text,
  transmission text,
  body_type text,
  power_hp integer,
  torque_nm integer,
  fuel_consumption_l_100km numeric(5,2),
  boot_space_l integer,
  length_mm integer,
  width_mm integer,
  height_mm integer,
  source text not null default 'manual',
  source_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists vehicle_specs_model_variant_source_unique
on public.vehicle_specs (
  model_id,
  coalesce(nullif(btrim(year), ''), 'any'),
  coalesce(nullif(btrim("trim"), ''), 'standard'),
  source
);

create index if not exists vehicle_specs_model_id_idx
on public.vehicle_specs(model_id);

create index if not exists vehicle_specs_brand_id_idx
on public.vehicle_specs(brand_id);

alter table public.vehicle_specs enable row level security;

create or replace function public.set_vehicle_specs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_vehicle_specs_updated_at on public.vehicle_specs;
create trigger set_vehicle_specs_updated_at
before update on public.vehicle_specs
for each row execute function public.set_vehicle_specs_updated_at();

drop policy if exists "Vehicle specs are readable by everyone"
on public.vehicle_specs;

create policy "Vehicle specs are readable by everyone"
on public.vehicle_specs for select
to public
using (true);

-- No insert/update/delete policy is added on purpose.
-- Client apps can read specs, but only SQL admin/service role can write them.
