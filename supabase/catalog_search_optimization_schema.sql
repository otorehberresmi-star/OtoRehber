-- Catalog, search and cache-friendly indexes for OtoRehber.
-- This patch keeps Redis out of the critical path by making PostgreSQL search
-- fast enough for catalog, filter and "Sen de Kıyasla" flows.

create extension if not exists pg_trgm;

create or replace function public.normalize_search_text(input text)
returns text
language sql
immutable
parallel safe
as $$
  select btrim(
    regexp_replace(
      lower(
        translate(
          coalesce(input, ''),
          'IİÇĞÖŞÜÂÎÛıçğıöşüâîû',
          'iiCGOSUAIUicgiosuaiu'
        )
      ),
      '\s+',
      ' ',
      'g'
    )
  );
$$;

alter table public.brands
add column if not exists search_text text
generated always as (public.normalize_search_text(name)) stored;

alter table public.models
add column if not exists search_text text
generated always as (public.normalize_search_text(name)) stored;

alter table public.posts
add column if not exists search_text text
generated always as (
  public.normalize_search_text(
    coalesce(car, '') || ' ' || coalesce(title, '') || ' ' || coalesce(content, '')
  )
) stored;

alter table public.reviews
add column if not exists search_text text
generated always as (
  public.normalize_search_text(
    coalesce(brand, '') ||
    ' ' ||
    coalesce(car, '') ||
    ' ' ||
    coalesce(title, '') ||
    ' ' ||
    coalesce(comment, '')
  )
) stored;

alter table public.vehicle_specs
add column if not exists search_text text
generated always as (
  public.normalize_search_text(
    coalesce("trim", '') ||
    ' ' ||
    coalesce(engine, '') ||
    ' ' ||
    coalesce(fuel_type, '') ||
    ' ' ||
    coalesce(transmission, '') ||
    ' ' ||
    coalesce(body_type, '') ||
    ' ' ||
    coalesce(metadata->>'engine_group', '')
  )
) stored;

create index if not exists brands_search_text_trgm_idx
on public.brands using gin(search_text gin_trgm_ops);

create index if not exists models_search_text_trgm_idx
on public.models using gin(search_text gin_trgm_ops);

create index if not exists models_brand_name_idx
on public.models(brand_id, name);

create index if not exists models_brand_search_text_idx
on public.models(brand_id, search_text);

create index if not exists posts_experience_search_text_trgm_idx
on public.posts using gin(search_text gin_trgm_ops)
where community_id is null and user_id is not null;

create index if not exists posts_experience_model_created_idx
on public.posts(model_id, created_at desc)
where community_id is null and user_id is not null;

create index if not exists posts_experience_brand_created_idx
on public.posts(brand_id, created_at desc)
where community_id is null and user_id is not null and brand_id is not null;

create index if not exists reviews_search_text_trgm_idx
on public.reviews using gin(search_text gin_trgm_ops)
where user_id is not null;

create index if not exists reviews_brand_created_idx
on public.reviews(brand_id, created_at desc)
where user_id is not null and brand_id is not null;

create index if not exists reviews_model_created_not_null_idx
on public.reviews(model_id, created_at desc)
where user_id is not null and model_id is not null;

create index if not exists vehicle_specs_search_text_trgm_idx
on public.vehicle_specs using gin(search_text gin_trgm_ops);

create index if not exists vehicle_specs_model_search_text_idx
on public.vehicle_specs(model_id, search_text);

create index if not exists vehicle_specs_brand_model_idx
on public.vehicle_specs(brand_id, model_id);

notify pgrst, 'reload schema';
