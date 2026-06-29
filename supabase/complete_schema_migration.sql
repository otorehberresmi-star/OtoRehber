-- OtoRehber complete Supabase migration.
-- Generated from the smaller schema files in /supabase.
-- Safe to run on the existing project; it intentionally excludes cleanup_mock_data.sql and cron_push_setup.sql.
-- Run cron_push_setup.sql separately after replacing placeholders.

-- ============================================================================
-- Source: supabase/policies.sql
-- ============================================================================
-- OtoRehber production RLS baseline
-- Run this in the Supabase SQL Editor after reviewing table names in public schema.

alter table public.brands enable row level security;
alter table public.models enable row level security;
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.reviews enable row level security;
alter table public.garage_cars enable row level security;
alter table public.saved_cars enable row level security;
alter table public.timeline_entries enable row level security;

alter table public.profiles
add column if not exists phone_number text,
add column if not exists is_private boolean not null default false;

drop policy if exists "Enable read access for all users" on public.brands;
drop policy if exists "Brands are readable by everyone" on public.brands;
create policy "Brands are readable by everyone"
on public.brands for select
to anon, authenticated
using (true);

drop policy if exists "Allow public read access on models" on public.models;
drop policy if exists "Models are readable by everyone" on public.models;
create policy "Models are readable by everyone"
on public.models for select
to anon, authenticated
using (true);

drop policy if exists "Herkes profilleri görebilir" on public.profiles;
drop policy if exists "Kullanıcılar kendi profilini güncelleyebilir" on public.profiles;
drop policy if exists "Profiles are readable by everyone" on public.profiles;
drop policy if exists "Users can read their own profile" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can read their own profile"
on public.profiles for select
to authenticated
using (auth.uid() = id);

create policy "Users can insert their own profile"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create or replace view public.public_profiles as
select
  id,
  case when is_private then 'Gizli Kullanıcı' else display_name end as display_name,
  case when is_private then null else full_name end as full_name,
  case when is_private then null else avatar_url end as avatar_url,
  created_at,
  is_private
from public.profiles;

grant select on public.public_profiles to anon, authenticated;

drop policy if exists "Herkes gönderileri okuyabilir" on public.posts;
drop policy if exists "Kayıtlı kullanıcılar gönderi atabilir" on public.posts;
drop policy if exists "Kayıtlı kullanıcılar kendi adına gönderi atabilir" on public.posts;
drop policy if exists "Kullanıcı kendi gönderisini güncelleyebilir" on public.posts;
drop policy if exists "Posts are readable by everyone" on public.posts;
drop policy if exists "Authenticated users can insert their own posts" on public.posts;
drop policy if exists "Users can update their own posts" on public.posts;
drop policy if exists "Users can delete their own posts" on public.posts;
create policy "Posts are readable by everyone"
on public.posts for select
to anon, authenticated
using (true);

create policy "Authenticated users can insert their own posts"
on public.posts for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own posts"
on public.posts for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own posts"
on public.posts for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Herkes yorumları okuyabilir" on public.comments;
drop policy if exists "Herkes yorum atabilir" on public.comments;
drop policy if exists "Yorumları güncelleyebilir" on public.comments;
drop policy if exists "Kayıtlı kullanıcılar yorum ekleyebilir" on public.comments;
drop policy if exists "Kullanıcı kendi yorumunu güncelleyebilir" on public.comments;
drop policy if exists "Kullanıcı kendi yorumunu silebilir" on public.comments;
drop policy if exists "Comments are readable by everyone" on public.comments;
drop policy if exists "Authenticated users can insert their own comments" on public.comments;
drop policy if exists "Users can update their own comments" on public.comments;
drop policy if exists "Users can delete their own comments" on public.comments;
create policy "Comments are readable by everyone"
on public.comments for select
to anon, authenticated
using (true);

create policy "Authenticated users can insert their own comments"
on public.comments for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own comments"
on public.comments for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own comments"
on public.comments for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Herkes incelemeleri okuyabilir" on public.reviews;
drop policy if exists "Kullanıcılar inceleme ekleyebilir" on public.reviews;
drop policy if exists "Reviews are readable by everyone" on public.reviews;
drop policy if exists "Authenticated users can insert their own reviews" on public.reviews;
drop policy if exists "Users can update their own reviews" on public.reviews;
drop policy if exists "Users can delete their own reviews" on public.reviews;
create policy "Reviews are readable by everyone"
on public.reviews for select
to anon, authenticated
using (true);

create policy "Authenticated users can insert their own reviews"
on public.reviews for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own reviews"
on public.reviews for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own reviews"
on public.reviews for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Kullanıcı kendi garajına ekleme yapabilir" on public.garage_cars;
drop policy if exists "Kullanıcı sadece kendi garajını görebilir" on public.garage_cars;
drop policy if exists "Users can read their own garage cars" on public.garage_cars;
drop policy if exists "Users can insert their own garage cars" on public.garage_cars;
drop policy if exists "Users can update their own garage cars" on public.garage_cars;
drop policy if exists "Users can delete their own garage cars" on public.garage_cars;
create policy "Users can read their own garage cars"
on public.garage_cars for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own garage cars"
on public.garage_cars for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own garage cars"
on public.garage_cars for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own garage cars"
on public.garage_cars for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read their own saved cars" on public.saved_cars;
drop policy if exists "Users can insert their own saved cars" on public.saved_cars;
drop policy if exists "Users can update their own saved cars" on public.saved_cars;
drop policy if exists "Users can delete their own saved cars" on public.saved_cars;
create policy "Users can read their own saved cars"
on public.saved_cars for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own saved cars"
on public.saved_cars for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own saved cars"
on public.saved_cars for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own saved cars"
on public.saved_cars for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Kullanıcı sadece kendi timeline'ını görebilir" on public.timeline_entries;
drop policy if exists "Users can read their own timeline entries" on public.timeline_entries;
drop policy if exists "Users can insert their own timeline entries" on public.timeline_entries;
drop policy if exists "Users can update their own timeline entries" on public.timeline_entries;
drop policy if exists "Users can delete their own timeline entries" on public.timeline_entries;
create policy "Users can read their own timeline entries"
on public.timeline_entries for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own timeline entries"
on public.timeline_entries for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own timeline entries"
on public.timeline_entries for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own timeline entries"
on public.timeline_entries for delete
to authenticated
using (auth.uid() = user_id);

-- If your Supabase Postgres version supports it, make the view respect
-- the RLS policies of the underlying comments/profiles tables.
alter view if exists public.comments_with_profiles set (security_invoker = true);

-- ============================================================================
-- Source: supabase/saved_cars_schema.sql
-- ============================================================================
-- Saved vehicle architecture for OtoRehber.
-- Run this once in Supabase SQL Editor.

alter table public.saved_cars
add column if not exists car_key text,
add column if not exists model_id uuid references public.models(id) on delete cascade,
add column if not exists car_name text,
add column if not exists trim text,
add column if not exists image text,
add column if not exists rating numeric,
add column if not exists recommend_percent integer,
add column if not exists save_intent text default 'interested';

alter table public.saved_cars
alter column review_id drop not null,
alter column save_intent set default 'interested';

update public.saved_cars
set save_intent = 'interested'
where save_intent is null;

alter table public.saved_cars
drop constraint if exists saved_cars_save_intent_check;

alter table public.saved_cars
add constraint saved_cars_save_intent_check
check (save_intent in ('interested', 'considering_purchase', 'compare_later'));

create unique index if not exists saved_cars_user_model_unique
on public.saved_cars(user_id, model_id)
where model_id is not null;

drop index if exists public.saved_cars_user_car_key_unique;

delete from public.saved_cars a
using public.saved_cars b
where a.user_id = b.user_id
  and a.car_key = b.car_key
  and a.car_key is not null
  and a.created_at < b.created_at;

create unique index if not exists saved_cars_user_car_key_unique
on public.saved_cars(user_id, car_key);

alter table public.saved_cars enable row level security;

drop policy if exists "Users can read their own saved cars" on public.saved_cars;
drop policy if exists "Users can insert their own saved cars" on public.saved_cars;
drop policy if exists "Users can update their own saved cars" on public.saved_cars;
drop policy if exists "Users can delete their own saved cars" on public.saved_cars;

create policy "Users can read their own saved cars"
on public.saved_cars for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own saved cars"
on public.saved_cars for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own saved cars"
on public.saved_cars for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own saved cars"
on public.saved_cars for delete
to authenticated
using (auth.uid() = user_id);

-- ============================================================================
-- Source: supabase/review_comments_schema.sql
-- ============================================================================
-- Persist replies under reviews using the existing comments table.
-- Run this in Supabase SQL Editor.

alter table public.comments
add column if not exists review_id uuid references public.reviews(id) on delete cascade;

alter table public.comments
alter column post_id drop not null;

alter table public.comments
drop constraint if exists comments_post_or_review_check;

alter table public.comments
add constraint comments_post_or_review_check
check (post_id is not null or review_id is not null);

create index if not exists comments_review_created_idx
on public.comments(review_id, created_at)
where review_id is not null;

alter table public.comments enable row level security;

drop policy if exists "Comments are readable by everyone" on public.comments;
drop policy if exists "Authenticated users can insert their own comments" on public.comments;
drop policy if exists "Users can update their own comments" on public.comments;
drop policy if exists "Users can delete their own comments" on public.comments;

create policy "Comments are readable by everyone"
on public.comments for select
to anon, authenticated
using (true);

create policy "Authenticated users can insert their own comments"
on public.comments for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own comments"
on public.comments for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own comments"
on public.comments for delete
to authenticated
using (auth.uid() = user_id);

-- ============================================================================
-- Source: supabase/timeline_entries_schema.sql
-- ============================================================================
-- Garage expense/service timeline persistence for OtoRehber.
-- Run this in Supabase SQL Editor.

create table if not exists public.timeline_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  garage_car_id uuid references public.garage_cars(id) on delete cascade,
  type text not null check (type in ('fuel', 'service')),
  title text not null,
  amount numeric,
  detail text,
  tag text,
  icon text,
  km text,
  entry_date timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.timeline_entries
add column if not exists garage_car_id uuid references public.garage_cars(id) on delete cascade,
add column if not exists title text,
add column if not exists amount numeric,
add column if not exists detail text,
add column if not exists tag text,
add column if not exists icon text,
add column if not exists km text,
add column if not exists date timestamptz default now(),
add column if not exists entry_date timestamptz default now(),
add column if not exists metadata jsonb default '{}'::jsonb;

alter table public.timeline_entries
alter column date set default now();

create index if not exists timeline_entries_user_car_date_idx
on public.timeline_entries(user_id, garage_car_id, entry_date desc);

alter table public.timeline_entries enable row level security;

drop policy if exists "Kullanıcı sadece kendi timeline'ını görebilir" on public.timeline_entries;
drop policy if exists "Users can read their own timeline entries" on public.timeline_entries;
drop policy if exists "Users can insert their own timeline entries" on public.timeline_entries;
drop policy if exists "Users can update their own timeline entries" on public.timeline_entries;
drop policy if exists "Users can delete their own timeline entries" on public.timeline_entries;

create policy "Users can read their own timeline entries"
on public.timeline_entries for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own timeline entries"
on public.timeline_entries for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own timeline entries"
on public.timeline_entries for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own timeline entries"
on public.timeline_entries for delete
to authenticated
using (auth.uid() = user_id);

-- ============================================================================
-- Source: supabase/community_memberships_schema.sql
-- ============================================================================
-- Community memberships and per-community settings for OtoRehber.
-- Run this in Supabase SQL Editor.

create table if not exists public.community_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  community_id text not null,
  show_on_profile boolean not null default true,
  use_vehicle_badge boolean not null default true,
  notifications_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists community_memberships_user_community_unique
on public.community_memberships(user_id, community_id);

create index if not exists community_memberships_user_created_idx
on public.community_memberships(user_id, created_at desc);

create or replace function public.touch_community_memberships_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- Source: supabase/catalog_search_optimization_schema.sql
-- ============================================================================
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

drop trigger if exists touch_community_memberships_updated_at_trigger
on public.community_memberships;

create trigger touch_community_memberships_updated_at_trigger
before update on public.community_memberships
for each row execute function public.touch_community_memberships_updated_at();

alter table public.community_memberships enable row level security;

drop policy if exists "Users can read their own community memberships"
on public.community_memberships;
drop policy if exists "Users can insert their own community memberships"
on public.community_memberships;
drop policy if exists "Users can update their own community memberships"
on public.community_memberships;
drop policy if exists "Users can delete their own community memberships"
on public.community_memberships;

create policy "Users can read their own community memberships"
on public.community_memberships for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own community memberships"
on public.community_memberships for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own community memberships"
on public.community_memberships for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own community memberships"
on public.community_memberships for delete
to authenticated
using (auth.uid() = user_id);

create or replace function public.get_community_member_count(
  p_community_id text
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.community_memberships
  where community_id = p_community_id;
$$;

grant execute on function public.get_community_member_count(text)
to anon, authenticated;

-- ============================================================================
-- Source: supabase/storage_uploads_schema.sql
-- ============================================================================
-- Storage buckets for public community media and private user media.
-- Public: avatars, reviews, community posts.
-- Private: garage photos, service receipts, personal timeline images.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  (
    'public-content-images',
    'public-content-images',
    true,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  ),
  (
    'private-user-images',
    'private-user-images',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read user uploads" on storage.objects;
drop policy if exists "Users can upload own files" on storage.objects;
drop policy if exists "Users can update own files" on storage.objects;
drop policy if exists "Users can delete own files" on storage.objects;

drop policy if exists "Public can read content images" on storage.objects;
drop policy if exists "Users can upload public content images" on storage.objects;
drop policy if exists "Users can update own public content images" on storage.objects;
drop policy if exists "Users can delete own public content images" on storage.objects;
drop policy if exists "Users can read own private images" on storage.objects;
drop policy if exists "Users can upload own private images" on storage.objects;
drop policy if exists "Users can update own private images" on storage.objects;
drop policy if exists "Users can delete own private images" on storage.objects;

create policy "Public can read content images"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'public-content-images');

create policy "Users can upload public content images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'public-content-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can update own public content images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'public-content-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'public-content-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete own public content images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'public-content-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can read own private images"
on storage.objects for select
to authenticated
using (
  bucket_id = 'private-user-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can upload own private images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'private-user-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can update own private images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'private-user-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'private-user-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete own private images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'private-user-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

alter table public.posts
add column if not exists images jsonb default '[]'::jsonb,
add column if not exists community_id text,
add column if not exists topic_tags text[] not null default '{}'::text[];

create index if not exists posts_topic_tags_idx
on public.posts using gin(topic_tags);

alter table public.reviews
add column if not exists brand_id uuid references public.brands(id) on delete set null,
add column if not exists model_id uuid references public.models(id) on delete set null,
add column if not exists helpful_votes integer not null default 0;

create index if not exists posts_model_created_idx
on public.posts(model_id, created_at desc)
where model_id is not null;

create index if not exists posts_community_created_idx
on public.posts(community_id, created_at desc)
where community_id is not null;

create index if not exists posts_created_idx
on public.posts(created_at desc);

create index if not exists comments_post_created_idx
on public.comments(post_id, created_at)
where post_id is not null;

create table if not exists public.post_votes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.comment_votes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

alter table public.posts
add column if not exists downvotes integer not null default 0;

alter table public.comments
add column if not exists downvotes integer not null default 0;

create table if not exists public.post_downvotes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.comment_downvotes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create table if not exists public.review_helpful_votes (
  review_id uuid not null references public.reviews(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

create index if not exists post_votes_user_created_idx
on public.post_votes(user_id, created_at desc);

create index if not exists comment_votes_user_created_idx
on public.comment_votes(user_id, created_at desc);

create index if not exists post_downvotes_user_created_idx
on public.post_downvotes(user_id, created_at desc);

create index if not exists comment_downvotes_user_created_idx
on public.comment_downvotes(user_id, created_at desc);

create index if not exists review_helpful_votes_user_created_idx
on public.review_helpful_votes(user_id, created_at desc);

alter table public.post_votes enable row level security;
alter table public.comment_votes enable row level security;
alter table public.post_downvotes enable row level security;
alter table public.comment_downvotes enable row level security;
alter table public.review_helpful_votes enable row level security;

drop policy if exists "Users can read own post votes" on public.post_votes;
drop policy if exists "Users can insert own post votes" on public.post_votes;
drop policy if exists "Users can delete own post votes" on public.post_votes;
drop policy if exists "Users can read own comment votes" on public.comment_votes;
drop policy if exists "Users can insert own comment votes" on public.comment_votes;
drop policy if exists "Users can delete own comment votes" on public.comment_votes;
drop policy if exists "Users can read own post downvotes" on public.post_downvotes;
drop policy if exists "Users can insert own post downvotes" on public.post_downvotes;
drop policy if exists "Users can delete own post downvotes" on public.post_downvotes;
drop policy if exists "Users can read own comment downvotes" on public.comment_downvotes;
drop policy if exists "Users can insert own comment downvotes" on public.comment_downvotes;
drop policy if exists "Users can delete own comment downvotes" on public.comment_downvotes;
drop policy if exists "Users can read own review helpful votes" on public.review_helpful_votes;
drop policy if exists "Users can insert own review helpful votes" on public.review_helpful_votes;
drop policy if exists "Users can delete own review helpful votes" on public.review_helpful_votes;

create policy "Users can read own post votes"
on public.post_votes for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own post votes"
on public.post_votes for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can delete own post votes"
on public.post_votes for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can read own comment votes"
on public.comment_votes for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own comment votes"
on public.comment_votes for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can delete own comment votes"
on public.comment_votes for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can read own post downvotes"
on public.post_downvotes for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own post downvotes"
on public.post_downvotes for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can delete own post downvotes"
on public.post_downvotes for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can read own comment downvotes"
on public.comment_downvotes for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own comment downvotes"
on public.comment_downvotes for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can delete own comment downvotes"
on public.comment_downvotes for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can read own review helpful votes"
on public.review_helpful_votes for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own review helpful votes"
on public.review_helpful_votes for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can delete own review helpful votes"
on public.review_helpful_votes for delete
to authenticated
using (auth.uid() = user_id);

drop function if exists public.toggle_post_vote(uuid);
drop function if exists public.toggle_comment_vote(uuid);
drop function if exists public.toggle_post_downvote(uuid);
drop function if exists public.toggle_comment_downvote(uuid);
drop function if exists public.toggle_review_helpful_vote(uuid);

create or replace function public.toggle_post_vote(p_post_id uuid)
returns table(is_voted boolean, upvotes integer, downvotes integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_owner_id uuid;
  v_current_upvotes integer;
  v_current_downvotes integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select user_id, coalesce(posts.upvotes, 0), coalesce(posts.downvotes, 0)
  into v_owner_id, v_current_upvotes, v_current_downvotes
  from public.posts
  where id = p_post_id
  for update;

  if not found then
    raise exception 'Post not found';
  end if;

  if v_owner_id = v_user_id then
    raise exception 'Users cannot vote on their own posts';
  end if;

  if exists (
    select 1 from public.post_votes
    where post_id = p_post_id and user_id = v_user_id
  ) then
    delete from public.post_votes
    where post_id = p_post_id and user_id = v_user_id;

    update public.posts
    set upvotes = greatest(0, v_current_upvotes - 1)
    where id = p_post_id
    returning public.posts.upvotes, public.posts.downvotes
    into upvotes, downvotes;

    is_voted := false;
  else
    if exists (
      select 1 from public.post_downvotes
      where post_id = p_post_id and user_id = v_user_id
    ) then
      delete from public.post_downvotes
      where post_id = p_post_id and user_id = v_user_id;
      v_current_downvotes := greatest(0, v_current_downvotes - 1);
    end if;

    insert into public.post_votes(post_id, user_id)
    values (p_post_id, v_user_id);

    update public.posts
    set upvotes = v_current_upvotes + 1,
        downvotes = v_current_downvotes
    where id = p_post_id
    returning public.posts.upvotes, public.posts.downvotes
    into upvotes, downvotes;

    is_voted := true;
  end if;

  if downvotes is null then
    select coalesce(public.posts.downvotes, 0)
    into downvotes
    from public.posts
    where id = p_post_id;
  end if;

  return next;
end;
$$;

create or replace function public.toggle_comment_vote(p_comment_id uuid)
returns table(is_voted boolean, upvotes integer, downvotes integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_owner_id uuid;
  v_current_upvotes integer;
  v_current_downvotes integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select user_id, coalesce(comments.upvotes, 0), coalesce(comments.downvotes, 0)
  into v_owner_id, v_current_upvotes, v_current_downvotes
  from public.comments
  where id = p_comment_id
  for update;

  if not found then
    raise exception 'Comment not found';
  end if;

  if v_owner_id = v_user_id then
    raise exception 'Users cannot vote on their own comments';
  end if;

  if exists (
    select 1 from public.comment_votes
    where comment_id = p_comment_id and user_id = v_user_id
  ) then
    delete from public.comment_votes
    where comment_id = p_comment_id and user_id = v_user_id;

    update public.comments
    set upvotes = greatest(0, v_current_upvotes - 1)
    where id = p_comment_id
    returning public.comments.upvotes, public.comments.downvotes
    into upvotes, downvotes;

    is_voted := false;
  else
    if exists (
      select 1 from public.comment_downvotes
      where comment_id = p_comment_id and user_id = v_user_id
    ) then
      delete from public.comment_downvotes
      where comment_id = p_comment_id and user_id = v_user_id;
      v_current_downvotes := greatest(0, v_current_downvotes - 1);
    end if;

    insert into public.comment_votes(comment_id, user_id)
    values (p_comment_id, v_user_id);

    update public.comments
    set upvotes = v_current_upvotes + 1,
        downvotes = v_current_downvotes
    where id = p_comment_id
    returning public.comments.upvotes, public.comments.downvotes
    into upvotes, downvotes;

    is_voted := true;
  end if;

  if downvotes is null then
    select coalesce(public.comments.downvotes, 0)
    into downvotes
    from public.comments
    where id = p_comment_id;
  end if;

  return next;
end;
$$;

create or replace function public.toggle_post_downvote(p_post_id uuid)
returns table(is_downvoted boolean, upvotes integer, downvotes integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_owner_id uuid;
  v_current_upvotes integer;
  v_current_downvotes integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select user_id, coalesce(posts.upvotes, 0), coalesce(posts.downvotes, 0)
  into v_owner_id, v_current_upvotes, v_current_downvotes
  from public.posts
  where id = p_post_id
  for update;

  if not found then
    raise exception 'Post not found';
  end if;

  if v_owner_id = v_user_id then
    raise exception 'Users cannot vote on their own posts';
  end if;

  if exists (
    select 1 from public.post_downvotes
    where post_id = p_post_id and user_id = v_user_id
  ) then
    delete from public.post_downvotes
    where post_id = p_post_id and user_id = v_user_id;

    update public.posts
    set downvotes = greatest(0, v_current_downvotes - 1)
    where id = p_post_id
    returning public.posts.upvotes, public.posts.downvotes
    into upvotes, downvotes;

    is_downvoted := false;
  else
    if exists (
      select 1 from public.post_votes
      where post_id = p_post_id and user_id = v_user_id
    ) then
      delete from public.post_votes
      where post_id = p_post_id and user_id = v_user_id;
      v_current_upvotes := greatest(0, v_current_upvotes - 1);
    end if;

    insert into public.post_downvotes(post_id, user_id)
    values (p_post_id, v_user_id);

    update public.posts
    set upvotes = v_current_upvotes,
        downvotes = v_current_downvotes + 1
    where id = p_post_id
    returning public.posts.upvotes, public.posts.downvotes
    into upvotes, downvotes;

    is_downvoted := true;
  end if;

  return next;
end;
$$;

create or replace function public.toggle_comment_downvote(p_comment_id uuid)
returns table(is_downvoted boolean, upvotes integer, downvotes integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_owner_id uuid;
  v_current_upvotes integer;
  v_current_downvotes integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select user_id, coalesce(comments.upvotes, 0), coalesce(comments.downvotes, 0)
  into v_owner_id, v_current_upvotes, v_current_downvotes
  from public.comments
  where id = p_comment_id
  for update;

  if not found then
    raise exception 'Comment not found';
  end if;

  if v_owner_id = v_user_id then
    raise exception 'Users cannot vote on their own comments';
  end if;

  if exists (
    select 1 from public.comment_downvotes
    where comment_id = p_comment_id and user_id = v_user_id
  ) then
    delete from public.comment_downvotes
    where comment_id = p_comment_id and user_id = v_user_id;

    update public.comments
    set downvotes = greatest(0, v_current_downvotes - 1)
    where id = p_comment_id
    returning public.comments.upvotes, public.comments.downvotes
    into upvotes, downvotes;

    is_downvoted := false;
  else
    if exists (
      select 1 from public.comment_votes
      where comment_id = p_comment_id and user_id = v_user_id
    ) then
      delete from public.comment_votes
      where comment_id = p_comment_id and user_id = v_user_id;
      v_current_upvotes := greatest(0, v_current_upvotes - 1);
    end if;

    insert into public.comment_downvotes(comment_id, user_id)
    values (p_comment_id, v_user_id);

    update public.comments
    set upvotes = v_current_upvotes,
        downvotes = v_current_downvotes + 1
    where id = p_comment_id
    returning public.comments.upvotes, public.comments.downvotes
    into upvotes, downvotes;

    is_downvoted := true;
  end if;

  return next;
end;
$$;

grant execute on function public.toggle_post_vote(uuid) to authenticated;
grant execute on function public.toggle_comment_vote(uuid) to authenticated;
grant execute on function public.toggle_post_downvote(uuid) to authenticated;
grant execute on function public.toggle_comment_downvote(uuid) to authenticated;

create or replace function public.toggle_review_helpful_vote(p_review_id uuid)
returns table(is_voted boolean, helpful_votes integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_owner_id uuid;
  v_current_votes integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select user_id, coalesce(reviews.helpful_votes, 0)
  into v_owner_id, v_current_votes
  from public.reviews
  where id = p_review_id
  for update;

  if not found then
    raise exception 'Review not found';
  end if;

  if v_owner_id = v_user_id then
    raise exception 'Users cannot vote on their own reviews';
  end if;

  if exists (
    select 1 from public.review_helpful_votes
    where review_id = p_review_id and user_id = v_user_id
  ) then
    delete from public.review_helpful_votes
    where review_id = p_review_id and user_id = v_user_id;

    update public.reviews
    set helpful_votes = greatest(0, v_current_votes - 1)
    where id = p_review_id
    returning public.reviews.helpful_votes into helpful_votes;

    is_voted := false;
  else
    insert into public.review_helpful_votes(review_id, user_id)
    values (p_review_id, v_user_id);

    update public.reviews
    set helpful_votes = v_current_votes + 1
    where id = p_review_id
    returning public.reviews.helpful_votes into helpful_votes;

    is_voted := true;
  end if;

  return next;
end;
$$;

grant execute on function public.toggle_review_helpful_vote(uuid) to authenticated;

create table if not exists public.comparison_votes (
  comparison_key text not null,
  user_id uuid not null,
  car1_id text not null,
  car2_id text not null,
  choice text not null check (choice in ('car1', 'car2')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (comparison_key, user_id)
);

create index if not exists comparison_votes_key_choice_idx
on public.comparison_votes(comparison_key, choice);

alter table public.comparison_votes enable row level security;

drop policy if exists "Users can read own comparison votes" on public.comparison_votes;
drop policy if exists "Users can insert own comparison votes" on public.comparison_votes;
drop policy if exists "Users can update own comparison votes" on public.comparison_votes;

create policy "Users can read own comparison votes"
on public.comparison_votes for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own comparison votes"
on public.comparison_votes for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own comparison votes"
on public.comparison_votes for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop function if exists public.submit_comparison_vote(text, text, text, text);
drop function if exists public.get_comparison_vote_summary(text);

create or replace function public.submit_comparison_vote(
  p_comparison_key text,
  p_car1_id text,
  p_car2_id text,
  p_choice text
)
returns table(user_choice text, car1_votes integer, car2_votes integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_choice not in ('car1', 'car2') then
    raise exception 'Invalid comparison choice';
  end if;

  insert into public.comparison_votes(
    comparison_key,
    user_id,
    car1_id,
    car2_id,
    choice
  )
  values (
    p_comparison_key,
    v_user_id,
    p_car1_id,
    p_car2_id,
    p_choice
  )
  on conflict (comparison_key, user_id)
  do update set
    choice = excluded.choice,
    car1_id = excluded.car1_id,
    car2_id = excluded.car2_id,
    updated_at = now();

  return query
  select
    p_choice::text as user_choice,
    count(*) filter (where choice = 'car1')::integer as car1_votes,
    count(*) filter (where choice = 'car2')::integer as car2_votes
  from public.comparison_votes
  where comparison_key = p_comparison_key;
end;
$$;

create or replace function public.get_comparison_vote_summary(
  p_comparison_key text
)
returns table(user_choice text, car1_votes integer, car2_votes integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    (
      select choice
      from public.comparison_votes
      where comparison_key = p_comparison_key
        and user_id = auth.uid()
      limit 1
    )::text as user_choice,
    count(*) filter (where choice = 'car1')::integer as car1_votes,
    count(*) filter (where choice = 'car2')::integer as car2_votes
  from public.comparison_votes
  where comparison_key = p_comparison_key;
$$;

grant execute on function public.submit_comparison_vote(text, text, text, text)
to authenticated;

grant execute on function public.get_comparison_vote_summary(text)
to anon, authenticated;

create or replace function public.sync_post_comment_count(p_post_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  select count(*)::integer
  into v_count
  from public.comments
  where post_id = p_post_id;

  update public.posts
  set comments = v_count
  where id = p_post_id;

  return v_count;
end;
$$;

create or replace function public.refresh_post_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.post_id is not null then
      perform public.sync_post_comment_count(old.post_id);
    end if;
    return old;
  end if;

  if new.post_id is not null then
    perform public.sync_post_comment_count(new.post_id);
  end if;

  if tg_op = 'UPDATE' and old.post_id is distinct from new.post_id and old.post_id is not null then
    perform public.sync_post_comment_count(old.post_id);
  end if;

  return new;
end;
$$;

drop trigger if exists refresh_post_comment_count_trigger on public.comments;
create trigger refresh_post_comment_count_trigger
after insert or update of post_id or delete on public.comments
for each row execute function public.refresh_post_comment_count();

create index if not exists reviews_model_created_idx
on public.reviews(model_id, created_at desc)
where model_id is not null;

create index if not exists reviews_created_idx
on public.reviews(created_at desc);

create index if not exists garage_cars_user_created_idx
on public.garage_cars(user_id, created_at desc);

-- Deprecated third-party image cache infrastructure. Vehicle imagery is no longer
-- resolved through a third-party API; app screens use icons/user-uploaded media.
do $$
begin
  if to_regclass('public.model_images') is not null then
    drop policy if exists "Model images are readable by everyone" on public.model_images;
    drop trigger if exists set_model_images_updated_at on public.model_images;
  end if;
end $$;

drop function if exists public.set_model_images_updated_at();
drop table if exists public.model_images;

-- ============================================================================
-- Source: supabase/vehicle_search_events_schema.sql
-- ============================================================================
-- Lightweight search analytics for ranking "En Çok İncelenenler".

create table if not exists public.vehicle_search_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  query text not null,
  brand_id uuid references public.brands(id) on delete set null,
  model_id uuid references public.models(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists vehicle_search_events_model_created_idx
on public.vehicle_search_events(model_id, created_at desc);

create index if not exists vehicle_search_events_query_created_idx
on public.vehicle_search_events(query, created_at desc);

create index if not exists vehicle_search_events_created_idx
on public.vehicle_search_events(created_at desc);

alter table public.vehicle_search_events enable row level security;

drop policy if exists "Authenticated users can insert search events"
on public.vehicle_search_events;
drop policy if exists "Search events are readable by everyone"
on public.vehicle_search_events;


create or replace function public.record_vehicle_search_event(
  p_query text,
  p_brand_id uuid default null,
  p_model_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_query text := nullif(trim(p_query), '');
  current_user_id uuid := auth.uid();
  already_recorded boolean := false;
begin
  if current_user_id is null or clean_query is null then
    return false;
  end if;

  select exists (
    select 1
    from public.vehicle_search_events vse
    where vse.user_id = current_user_id
      and lower(vse.query) = lower(clean_query)
      and coalesce(vse.brand_id::text, '') = coalesce(p_brand_id::text, '')
      and coalesce(vse.model_id::text, '') = coalesce(p_model_id::text, '')
      and vse.created_at >= now() - interval '1 hour'
  )
  into already_recorded;

  if already_recorded then
    return false;
  end if;

  insert into public.vehicle_search_events(user_id, query, brand_id, model_id)
  values (current_user_id, clean_query, p_brand_id, p_model_id);

  begin
    perform public.refresh_discover_home_cache();
  exception
    when undefined_function then
      null;
    when others then
      raise notice 'discover cache refresh skipped: %', sqlerrm;
  end;

  return true;
end;
$$;

grant execute on function public.record_vehicle_search_event(text, uuid, uuid)
to authenticated;

create or replace function public.prune_vehicle_search_events(
  p_retention_days integer default 180
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer := 0;
begin
  delete from public.vehicle_search_events
  where created_at < now() - (greatest(30, least(coalesce(p_retention_days, 180), 730)) || ' days')::interval;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

create or replace function public.get_vehicle_search_trend_metrics(
  p_days integer default 30,
  p_limit integer default 500
)
returns table (
  model_id uuid,
  search_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    vse.model_id,
    count(*)::bigint as search_count
  from public.vehicle_search_events vse
  where vse.model_id is not null
    and vse.created_at >= now() - (greatest(1, least(coalesce(p_days, 30), 365)) || ' days')::interval
  group by vse.model_id
  order by search_count desc
  limit greatest(1, least(coalesce(p_limit, 500), 1000));
$$;

grant execute on function public.get_vehicle_search_trend_metrics(integer, integer)
to anon, authenticated;

create or replace function public.get_discover_trending_cars(
  p_limit integer default 5,
  p_days integer default 30
)
returns table (
  model_id uuid,
  brand text,
  model text,
  posts_count bigint,
  search_count bigint,
  review_count bigint,
  average_rating numeric,
  recommend_percent integer,
  featured_review text,
  trend_score numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with params as (
    select
      greatest(1, least(coalesce(p_limit, 5), 20)) as result_limit,
      now() - (greatest(1, least(coalesce(p_days, 30), 365)) || ' days')::interval as since_at
  ),
  post_metrics as (
    select
      p.model_id,
      count(*)::bigint as posts_count,
      sum(1 + coalesce(p.upvotes, 0) + coalesce(p.comments, 0))::numeric as post_score,
      (array_agg(coalesce(nullif(p.content, ''), nullif(p.title, ''), 'Toplulukta konuşuluyor.')
        order by p.created_at desc))[1] as featured_review
    from public.posts p, params
    where p.model_id is not null
      and p.created_at >= params.since_at
    group by p.model_id
  ),
  search_metrics as (
    select
      vse.model_id,
      count(*)::bigint as search_count
    from public.vehicle_search_events vse, params
    where vse.model_id is not null
      and vse.created_at >= params.since_at
    group by vse.model_id
  ),
  review_source as (
    select
      coalesce(
        r.model_id,
        (
          select m.id
          from public.models m
          left join public.brands b on b.id = m.brand_id
          where r.car is not null
            and (
              lower(r.car) like '%' || lower(m.name) || '%'
              or lower(r.car) like '%' || lower(coalesce(b.name, '') || ' ' || m.name) || '%'
            )
          order by length(m.name) desc
          limit 1
        )
      ) as model_id,
      r.rating,
      r.recommend,
      r.created_at
    from public.reviews r, params
    where r.created_at >= params.since_at
  ),
  review_metrics as (
    select
      rs.model_id,
      count(*) filter (where coalesce(rs.rating, 0) > 0)::bigint as review_count,
      avg(nullif(rs.rating, 0))::numeric as average_rating,
      count(*) filter (where rs.recommend is true)::bigint as recommend_count
    from review_source rs
    where rs.model_id is not null
    group by rs.model_id
  ),
  candidates as (
    select model_id from search_metrics
  )
  select
    m.id as model_id,
    coalesce(b.name, '')::text as brand,
    m.name::text as model,
    coalesce(pm.posts_count, 0)::bigint as posts_count,
    coalesce(sm.search_count, 0)::bigint as search_count,
    coalesce(rm.review_count, 0)::bigint as review_count,
    coalesce(round(rm.average_rating, 1), 0)::numeric as average_rating,
    case
      when coalesce(rm.review_count, 0) > 0 then
        round((coalesce(rm.recommend_count, 0)::numeric / rm.review_count::numeric) * 100)::integer
      else 0
    end as recommend_percent,
    coalesce(pm.featured_review, 'Bu araç son dönemde daha çok aranıyor.')::text as featured_review,
    (
      coalesce(sm.search_count, 0) * 10
      + coalesce(pm.post_score, 0)
      + coalesce(rm.review_count, 0) * 4
    )::numeric as trend_score
  from candidates c
  join public.models m on m.id = c.model_id
  left join public.brands b on b.id = m.brand_id
  left join post_metrics pm on pm.model_id = m.id
  left join search_metrics sm on sm.model_id = m.id
  left join review_metrics rm on rm.model_id = m.id
  order by search_count desc, trend_score desc, posts_count desc, review_count desc, m.name asc
  limit (select result_limit from params);
$$;

grant execute on function public.get_discover_trending_cars(integer, integer)
to anon, authenticated;

create or replace function public.get_daily_comparison(
  p_date date default current_date
)
returns table (
  date_key text,
  slot integer,
  model_id uuid,
  brand text,
  model text,
  posts_count bigint,
  score numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with ranked_models as (
    select
      m.id,
      m.name,
      coalesce(b.name, '') as brand,
      row_number() over (order by md5(p_date::text || ':' || m.id::text)) as slot
    from public.models m
    left join public.brands b on b.id = m.brand_id
  ),
  selected as (
    select *
    from ranked_models
    where slot <= 2
  ),
  post_metrics as (
    select
      p.model_id,
      count(*)::bigint as posts_count,
      sum(1 + coalesce(p.upvotes, 0) + coalesce(p.comments, 0))::numeric as score
    from public.posts p
    join selected s on s.id = p.model_id
    group by p.model_id
  )
  select
    p_date::text as date_key,
    s.slot::integer,
    s.id as model_id,
    s.brand::text,
    s.name::text as model,
    coalesce(pm.posts_count, 0)::bigint as posts_count,
    coalesce(pm.score, 0)::numeric as score
  from selected s
  left join post_metrics pm on pm.model_id = s.id
  order by s.slot asc;
$$;

grant execute on function public.get_daily_comparison(date)
to anon, authenticated;

-- ============================================================================
-- Discover home cache layer
-- ============================================================================
-- Keşfet ilk açılan ekran olduğu için trend ve günün karşılaştırması client'ta
-- veya her istek sırasında ağır join/aggregate ile hesaplanmamalı. Aşağıdaki
-- cache katmanı RPC kontratını korur, uygulama kodunu değiştirmeden yükü azaltır.
-- Kurulumdan sonra ilk dolum için:
--   select public.refresh_discover_home_cache();
--   select public.refresh_daily_comparison_cache(current_date);
-- Periyodik yenileme için supabase/cron_push_setup.sql içindeki cron job'ları çalıştır.

drop materialized view if exists public.discover_trending_cars_cache;

create materialized view public.discover_trending_cars_cache as
with post_metrics as (
  select
    p.model_id,
    count(*)::bigint as posts_count,
    sum(1 + coalesce(p.upvotes, 0) + coalesce(p.comments, 0))::numeric as post_score,
    (array_agg(coalesce(nullif(p.content, ''), nullif(p.title, ''), 'Toplulukta konuşuluyor.')
      order by p.created_at desc))[1] as featured_review
  from public.posts p
  where p.model_id is not null
    and p.created_at >= now() - interval '30 days'
  group by p.model_id
),
search_metrics as (
  select
    vse.model_id,
    count(*)::bigint as search_count
  from public.vehicle_search_events vse
  where vse.model_id is not null
    and vse.created_at >= now() - interval '30 days'
  group by vse.model_id
),
review_source as (
  select
    coalesce(
      r.model_id,
      (
        select m.id
        from public.models m
        left join public.brands b on b.id = m.brand_id
        where r.car is not null
          and (
            lower(r.car) like '%' || lower(m.name) || '%'
            or lower(r.car) like '%' || lower(coalesce(b.name, '') || ' ' || m.name) || '%'
          )
        order by length(m.name) desc
        limit 1
      )
    ) as model_id,
    r.rating,
    r.recommend
  from public.reviews r
  where r.created_at >= now() - interval '30 days'
),
review_metrics as (
  select
    rs.model_id,
    count(*) filter (where coalesce(rs.rating, 0) > 0)::bigint as review_count,
    avg(nullif(rs.rating, 0))::numeric as average_rating,
    count(*) filter (where rs.recommend is true)::bigint as recommend_count
  from review_source rs
  where rs.model_id is not null
  group by rs.model_id
),
candidates as (
  select model_id from search_metrics
)
select
  m.id as model_id,
  coalesce(b.name, '')::text as brand,
  m.name::text as model,
  coalesce(pm.posts_count, 0)::bigint as posts_count,
  coalesce(sm.search_count, 0)::bigint as search_count,
  coalesce(rm.review_count, 0)::bigint as review_count,
  coalesce(round(rm.average_rating, 1), 0)::numeric as average_rating,
  case
    when coalesce(rm.review_count, 0) > 0 then
      round((coalesce(rm.recommend_count, 0)::numeric / rm.review_count::numeric) * 100)::integer
    else 0
  end as recommend_percent,
  coalesce(pm.featured_review, 'Bu araç son dönemde daha çok aranıyor.')::text as featured_review,
  (
    coalesce(sm.search_count, 0) * 10
    + coalesce(pm.post_score, 0)
    + coalesce(rm.review_count, 0) * 4
  )::numeric as trend_score,
  now() as refreshed_at
from candidates c
join public.models m on m.id = c.model_id
left join public.brands b on b.id = m.brand_id
left join post_metrics pm on pm.model_id = m.id
left join search_metrics sm on sm.model_id = m.id
left join review_metrics rm on rm.model_id = m.id;

create unique index if not exists discover_trending_cars_cache_model_idx
on public.discover_trending_cars_cache(model_id);

create index if not exists discover_trending_cars_cache_score_idx
on public.discover_trending_cars_cache(search_count desc, trend_score desc, posts_count desc, review_count desc);

create or replace function public.refresh_discover_home_cache()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view public.discover_trending_cars_cache;
end;
$$;

grant execute on function public.refresh_discover_home_cache()
to service_role;

create or replace function public.get_discover_trending_cars(
  p_limit integer default 5,
  p_days integer default 30
)
returns table (
  model_id uuid,
  brand text,
  model text,
  posts_count bigint,
  search_count bigint,
  review_count bigint,
  average_rating numeric,
  recommend_percent integer,
  featured_review text,
  trend_score numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    cache.model_id,
    cache.brand,
    cache.model,
    cache.posts_count,
    cache.search_count,
    cache.review_count,
    cache.average_rating,
    cache.recommend_percent,
    cache.featured_review,
    cache.trend_score
  from public.discover_trending_cars_cache cache
  where cache.search_count > 0
    and cache.refreshed_at >= now() - (greatest(1, least(coalesce(p_days, 30), 365)) || ' days')::interval
  order by cache.search_count desc, cache.trend_score desc, cache.posts_count desc, cache.review_count desc, cache.model asc
  limit greatest(1, least(coalesce(p_limit, 5), 20));
$$;

grant execute on function public.get_discover_trending_cars(integer, integer)
to anon, authenticated;

create table if not exists public.daily_comparison_cache (
  date_key date not null,
  slot integer not null check (slot in (1, 2)),
  model_id uuid not null references public.models(id) on delete cascade,
  brand text not null default '',
  model text not null,
  posts_count bigint not null default 0,
  score numeric not null default 0,
  refreshed_at timestamptz not null default now(),
  primary key (date_key, slot)
);

create index if not exists daily_comparison_cache_date_idx
on public.daily_comparison_cache(date_key, slot);

create or replace function public.refresh_daily_comparison_cache(
  p_date date default current_date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.daily_comparison_cache
  where date_key = p_date;

  insert into public.daily_comparison_cache(
    date_key,
    slot,
    model_id,
    brand,
    model,
    posts_count,
    score,
    refreshed_at
  )
  with ranked_models as (
    select
      m.id,
      m.name,
      coalesce(b.name, '') as brand,
      row_number() over (order by md5(p_date::text || ':' || m.id::text)) as slot
    from public.models m
    left join public.brands b on b.id = m.brand_id
    where exists (
      select 1
      from public.vehicle_specs vs
      where vs.model_id = m.id
    )
  ),
  selected as (
    select *
    from ranked_models
    where slot <= 2
  ),
  post_metrics as (
    select
      p.model_id,
      count(*)::bigint as posts_count,
      sum(1 + coalesce(p.upvotes, 0) + coalesce(p.comments, 0))::numeric as score
    from public.posts p
    join selected s on s.id = p.model_id
    group by p.model_id
  )
  select
    p_date,
    s.slot::integer,
    s.id,
    s.brand::text,
    s.name::text,
    coalesce(pm.posts_count, 0)::bigint,
    coalesce(pm.score, 0)::numeric,
    now()
  from selected s
  left join post_metrics pm on pm.model_id = s.id
  order by s.slot asc;
end;
$$;

revoke all on function public.refresh_daily_comparison_cache(date) from public;
grant execute on function public.refresh_daily_comparison_cache(date)
to service_role;

create or replace function public.get_daily_comparison(
  p_date date default current_date
)
returns table (
  date_key text,
  slot integer,
  model_id uuid,
  brand text,
  model text,
  posts_count bigint,
  score numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*) <> 2
    from public.daily_comparison_cache cache
    where cache.date_key = p_date
      and exists (
        select 1
        from public.vehicle_specs vs
        where vs.model_id = cache.model_id
      )
  ) then
    perform public.refresh_daily_comparison_cache(p_date);
  end if;

  return query
  select
    cache.date_key::text,
    cache.slot,
    cache.model_id,
    cache.brand,
    cache.model,
    cache.posts_count,
    cache.score
  from public.daily_comparison_cache cache
  where cache.date_key = p_date
  order by cache.slot asc;
end;
$$;

grant execute on function public.get_daily_comparison(date)
to anon, authenticated;

-- ============================================================================
-- Source: supabase/vehicle_specs_schema.sql
-- ============================================================================
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

-- ============================================================================
-- Source: supabase/notification_settings_schema.sql
-- ============================================================================
-- Notification preferences and vehicle reminder infrastructure.
-- Run this after vehicle_interest_notifications.sql.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null default 'system',
  title text not null default 'OtoRehber',
  message text not null,
  quote text,
  actor_id uuid,
  actor_name text,
  actor_avatar text,
  post_id uuid references public.posts(id) on delete cascade,
  review_id uuid references public.reviews(id) on delete cascade,
  car_key text,
  is_read boolean not null default false,
  push_sent_at timestamptz,
  push_error text,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
on public.notifications(user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Users can read their own notifications" on public.notifications;
drop policy if exists "Users can update their own notifications" on public.notifications;

create policy "Users can read their own notifications"
on public.notifications for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can update their own notifications"
on public.notifications for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

alter table public.notifications
add column if not exists reminder_id uuid,
add column if not exists comment_id uuid,
add column if not exists campaign_id uuid,
add column if not exists push_sent_at timestamptz,
add column if not exists push_error text,
add column if not exists push_ticket_ids jsonb not null default '[]'::jsonb,
add column if not exists push_receipt_status text,
add column if not exists push_receipt_error text,
add column if not exists email_sent_at timestamptz,
add column if not exists email_error text,
add column if not exists email_provider_id text,
add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists notifications_pending_push_idx
on public.notifications(user_id, created_at desc)
where push_sent_at is null;

create index if not exists notifications_pending_email_idx
on public.notifications(user_id, created_at desc)
where email_sent_at is null;

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  push_enabled boolean not null default true,
  email_enabled boolean not null default false,
  maintenance_enabled boolean not null default true,
  inspection_enabled boolean not null default true,
  insurance_enabled boolean not null default true,
  mtv_enabled boolean not null default true,
  replies_enabled boolean not null default true,
  likes_enabled boolean not null default true,
  followed_enabled boolean not null default true,
  weekly_digest_enabled boolean not null default false,
  campaigns_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null,
  device_id text,
  platform text,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_tokens
add column if not exists expo_push_token text,
add column if not exists device_id text,
add column if not exists platform text,
add column if not exists enabled boolean not null default true,
add column if not exists last_seen_at timestamptz not null default now(),
add column if not exists created_at timestamptz not null default now(),
add column if not exists updated_at timestamptz not null default now();

alter table public.notification_preferences
add column if not exists push_enabled boolean not null default true,
add column if not exists email_enabled boolean not null default false,
add column if not exists maintenance_enabled boolean not null default true,
add column if not exists inspection_enabled boolean not null default true,
add column if not exists insurance_enabled boolean not null default true,
add column if not exists mtv_enabled boolean not null default true,
add column if not exists replies_enabled boolean not null default true,
add column if not exists likes_enabled boolean not null default true,
add column if not exists followed_enabled boolean not null default true,
add column if not exists weekly_digest_enabled boolean not null default false,
add column if not exists campaigns_enabled boolean not null default false,
add column if not exists created_at timestamptz not null default now(),
add column if not exists updated_at timestamptz not null default now();

create table if not exists public.vehicle_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  garage_car_id uuid references public.garage_cars(id) on delete cascade,
  type text not null check (
    type in ('maintenance', 'inspection', 'traffic_insurance', 'casco', 'mtv')
  ),
  title text not null,
  due_date date,
  due_km integer,
  remind_before_days integer not null default 30,
  remind_before_km integer not null default 1000,
  enabled boolean not null default true,
  last_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicle_reminders_due_check check (due_date is not null or due_km is not null)
);

alter table public.vehicle_reminders
add column if not exists garage_car_id uuid references public.garage_cars(id) on delete cascade,
add column if not exists type text not null default 'maintenance',
add column if not exists title text not null default 'Araç hatırlatıcısı',
add column if not exists due_date date,
add column if not exists due_km integer,
add column if not exists remind_before_days integer not null default 30,
add column if not exists remind_before_km integer not null default 1000,
add column if not exists enabled boolean not null default true,
add column if not exists last_notified_at timestamptz,
add column if not exists created_at timestamptz not null default now(),
add column if not exists updated_at timestamptz not null default now();

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  partner_name text,
  city text,
  brand_id uuid references public.brands(id) on delete set null,
  model_id uuid references public.models(id) on delete set null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicle_search_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  query text not null,
  brand_id uuid references public.brands(id) on delete set null,
  model_id uuid references public.models(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists vehicle_search_events_model_created_idx
on public.vehicle_search_events(model_id, created_at desc);

create index if not exists vehicle_search_events_query_created_idx
on public.vehicle_search_events(query, created_at desc);

create index if not exists vehicle_search_events_created_idx
on public.vehicle_search_events(created_at desc);

create index if not exists campaigns_active_dates_idx
on public.campaigns(is_active, starts_at, ends_at);

create unique index if not exists push_tokens_token_unique
on public.push_tokens(expo_push_token);

create index if not exists push_tokens_user_enabled_idx
on public.push_tokens(user_id, enabled, last_seen_at desc);

alter table public.notifications
drop constraint if exists notifications_reminder_id_fkey;

alter table public.notifications
add constraint notifications_reminder_id_fkey
foreign key (reminder_id) references public.vehicle_reminders(id) on delete cascade;

alter table public.notifications
drop constraint if exists notifications_comment_id_fkey;

alter table public.notifications
add constraint notifications_comment_id_fkey
foreign key (comment_id) references public.comments(id) on delete cascade;

alter table public.notifications
drop constraint if exists notifications_campaign_id_fkey;

alter table public.notifications
add constraint notifications_campaign_id_fkey
foreign key (campaign_id) references public.campaigns(id) on delete cascade;

create index if not exists vehicle_reminders_user_due_idx
on public.vehicle_reminders(user_id, enabled, due_date);

create index if not exists vehicle_reminders_car_idx
on public.vehicle_reminders(garage_car_id);

create unique index if not exists notifications_vehicle_reminder_unique
on public.notifications(user_id, type, reminder_id)
where reminder_id is not null and type = 'vehicle_reminder';

create unique index if not exists notifications_tax_period_unique
on public.notifications(user_id, type, car_key)
where type = 'tax_reminder';

create unique index if not exists notifications_comment_reply_unique
on public.notifications(user_id, type, comment_id)
where comment_id is not null and type = 'comment';

create unique index if not exists notifications_like_post_unique
on public.notifications(user_id, type, post_id)
where post_id is not null and type = 'like';

create unique index if not exists notifications_like_comment_unique
on public.notifications(user_id, type, comment_id)
where comment_id is not null and type = 'like';

create unique index if not exists notifications_campaign_unique
on public.notifications(user_id, type, campaign_id)
where campaign_id is not null and type = 'campaign';

create unique index if not exists notifications_weekly_digest_unique
on public.notifications(user_id, type, car_key)
where type = 'weekly_digest';

create or replace function public.touch_notification_preferences_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_notification_preferences_updated_at_trigger
on public.notification_preferences;

create trigger touch_notification_preferences_updated_at_trigger
before update on public.notification_preferences
for each row execute function public.touch_notification_preferences_updated_at();

create or replace function public.touch_vehicle_reminders_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_vehicle_reminders_updated_at_trigger
on public.vehicle_reminders;

create trigger touch_vehicle_reminders_updated_at_trigger
before update on public.vehicle_reminders
for each row execute function public.touch_vehicle_reminders_updated_at();

create or replace function public.touch_campaigns_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_campaigns_updated_at_trigger
on public.campaigns;

create trigger touch_campaigns_updated_at_trigger
before update on public.campaigns
for each row execute function public.touch_campaigns_updated_at();

create or replace function public.touch_push_tokens_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.last_seen_at = now();
  return new;
end;
$$;

drop trigger if exists touch_push_tokens_updated_at_trigger
on public.push_tokens;

create trigger touch_push_tokens_updated_at_trigger
before update on public.push_tokens
for each row execute function public.touch_push_tokens_updated_at();

alter table public.notification_preferences enable row level security;
alter table public.vehicle_reminders enable row level security;
alter table public.campaigns enable row level security;
alter table public.vehicle_search_events enable row level security;
alter table public.push_tokens enable row level security;

drop policy if exists "Users can read their own notification preferences"
on public.notification_preferences;
drop policy if exists "Users can insert their own notification preferences"
on public.notification_preferences;
drop policy if exists "Users can update their own notification preferences"
on public.notification_preferences;

create policy "Users can read their own notification preferences"
on public.notification_preferences for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own notification preferences"
on public.notification_preferences for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own notification preferences"
on public.notification_preferences for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can read their own vehicle reminders"
on public.vehicle_reminders;
drop policy if exists "Users can insert their own vehicle reminders"
on public.vehicle_reminders;
drop policy if exists "Users can update their own vehicle reminders"
on public.vehicle_reminders;
drop policy if exists "Users can delete their own vehicle reminders"
on public.vehicle_reminders;

create policy "Users can read their own vehicle reminders"
on public.vehicle_reminders for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own vehicle reminders"
on public.vehicle_reminders for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own vehicle reminders"
on public.vehicle_reminders for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own vehicle reminders"
on public.vehicle_reminders for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Active campaigns are readable by everyone"
on public.campaigns;

create policy "Active campaigns are readable by everyone"
on public.campaigns for select
to public
using (is_active = true);

drop policy if exists "Authenticated users can insert search events"
on public.vehicle_search_events;
drop policy if exists "Search events are readable by everyone"
on public.vehicle_search_events;


create or replace function public.get_vehicle_search_trend_metrics(
  p_days integer default 30,
  p_limit integer default 500
)
returns table (
  model_id uuid,
  search_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    vse.model_id,
    count(*)::bigint as search_count
  from public.vehicle_search_events vse
  where vse.model_id is not null
    and vse.created_at >= now() - (greatest(1, least(coalesce(p_days, 30), 365)) || ' days')::interval
  group by vse.model_id
  order by search_count desc
  limit greatest(1, least(coalesce(p_limit, 500), 1000));
$$;

grant execute on function public.get_vehicle_search_trend_metrics(integer, integer)
to anon, authenticated;

drop policy if exists "Users can read their own push tokens"
on public.push_tokens;
drop policy if exists "Users can insert their own push tokens"
on public.push_tokens;
drop policy if exists "Users can update their own push tokens"
on public.push_tokens;
drop policy if exists "Users can delete their own push tokens"
on public.push_tokens;

create policy "Users can read their own push tokens"
on public.push_tokens for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own push tokens"
on public.push_tokens for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own push tokens"
on public.push_tokens for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own push tokens"
on public.push_tokens for delete
to authenticated
using (auth.uid() = user_id);

create or replace function public.current_mtv_period_key()
returns text
language sql
stable
as $$
  select case
    when extract(month from now()) = 1 then extract(year from now())::int || '-01'
    when extract(month from now()) = 7 then extract(year from now())::int || '-07'
    else null
  end;
$$;

create or replace function public.notification_matches_interest(
  interest_name text,
  content_text text
)
returns boolean
language sql
immutable
as $$
  select
    length(trim(coalesce(interest_name, ''))) >= 2
    and lower(coalesce(content_text, '')) like
      '%' || lower(trim(coalesce(interest_name, ''))) || '%';
$$;

create or replace function public.generate_vehicle_reminder_notifications(p_user_id uuid default auth.uid())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
  mtv_inserted_count integer := 0;
  pref public.notification_preferences%rowtype;
  mtv_key text;
begin
  if p_user_id is null then
    return 0;
  end if;

  select *
  into pref
  from public.notification_preferences
  where user_id = p_user_id;

  if not found then
    insert into public.notification_preferences(user_id)
    values (p_user_id)
    on conflict (user_id) do nothing;

    select *
    into pref
    from public.notification_preferences
    where user_id = p_user_id;
  end if;

  if coalesce(pref.push_enabled, true) = false
    and coalesce(pref.email_enabled, false) = false then
    return 0;
  end if;

  insert into public.vehicle_reminders (
    user_id,
    garage_car_id,
    type,
    title,
    due_date,
    due_km,
    remind_before_days,
    remind_before_km
  )
  select
    gc.user_id,
    gc.id,
    'maintenance',
    concat_ws(' ', gc.brand, gc.model) || ' periyodik bakım',
    (coalesce(gc.created_at, now()) + interval '12 months')::date,
    case
      when gc.km is not null and regexp_replace(gc.km, '[^0-9]', '', 'g') <> ''
      then regexp_replace(gc.km, '[^0-9]', '', 'g')::integer + 10000
      else null
    end,
    30,
    1000
  from public.garage_cars gc
  where gc.user_id = p_user_id
    and pref.maintenance_enabled = true
    and not exists (
      select 1
      from public.vehicle_reminders vr
      where vr.user_id = gc.user_id
        and vr.garage_car_id = gc.id
        and vr.type = 'maintenance'
        and vr.enabled = true
    )
    and (
      gc.created_at is not null
      or (gc.km is not null and regexp_replace(gc.km, '[^0-9]', '', 'g') <> '')
    );

  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    quote,
    car_key,
    reminder_id,
    metadata
  )
  select
    vr.user_id,
    'vehicle_reminder',
    vr.title,
    case vr.type
      when 'maintenance' then 'Bakım zamanı yaklaşıyor.'
      when 'inspection' then 'Muayene zamanı yaklaşıyor.'
      when 'traffic_insurance' then 'Trafik sigortası yenileme zamanı yaklaşıyor.'
      when 'casco' then 'Kasko yenileme zamanı yaklaşıyor.'
      else 'Araç hatırlatıcısı yaklaşıyor.'
    end,
    concat_ws(
      ' • ',
      case when vr.due_date is not null then 'Tarih: ' || to_char(vr.due_date, 'DD.MM.YYYY') end,
      case when vr.due_km is not null then 'KM: ' || vr.due_km::text end
    ),
    coalesce(vr.garage_car_id::text, vr.type || ':' || vr.id::text),
    vr.id,
    jsonb_build_object('reminder_type', vr.type, 'due_date', vr.due_date, 'due_km', vr.due_km)
  from public.vehicle_reminders vr
  left join public.garage_cars gc on gc.id = vr.garage_car_id
  where vr.user_id = p_user_id
    and vr.enabled = true
    and (
      (vr.type = 'maintenance' and pref.maintenance_enabled = true)
      or (vr.type = 'inspection' and pref.inspection_enabled = true)
      or (vr.type in ('traffic_insurance', 'casco') and pref.insurance_enabled = true)
      or (vr.type = 'mtv' and pref.mtv_enabled = true)
    )
    and (
      (vr.due_date is not null and vr.due_date <= current_date + vr.remind_before_days)
      or (
        vr.due_km is not null
        and gc.km is not null
        and regexp_replace(gc.km, '[^0-9]', '', 'g') <> ''
        and vr.due_km <= regexp_replace(gc.km, '[^0-9]', '', 'g')::integer + vr.remind_before_km
      )
    )
    and (vr.last_notified_at is null or vr.last_notified_at < now() - interval '7 days')
  on conflict do nothing;

  get diagnostics inserted_count = row_count;

  update public.vehicle_reminders vr
  set last_notified_at = now()
  where vr.user_id = p_user_id
    and exists (
      select 1
      from public.notifications n
      where n.reminder_id = vr.id
        and n.user_id = p_user_id
        and n.type = 'vehicle_reminder'
    );

  mtv_key := public.current_mtv_period_key();

  if pref.mtv_enabled = true and mtv_key is not null then
    insert into public.notifications (
      user_id,
      type,
      title,
      message,
      quote,
      car_key,
      metadata
    )
    values (
      p_user_id,
      'tax_reminder',
      'MTV Dönemi',
      'Motorlu Taşıtlar Vergisi ödeme dönemi başladı.',
      case when right(mtv_key, 2) = '01' then 'Ocak dönemi' else 'Temmuz dönemi' end,
      'mtv:' || p_user_id::text || ':' || mtv_key,
      jsonb_build_object('period', mtv_key)
    )
    on conflict do nothing;

    get diagnostics mtv_inserted_count = row_count;
    inserted_count := inserted_count + mtv_inserted_count;
  end if;

  return inserted_count;
end;
$$;

create or replace function public.generate_campaign_notifications(p_user_id uuid default auth.uid())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
  pref public.notification_preferences%rowtype;
begin
  if p_user_id is null then
    return 0;
  end if;

  select *
  into pref
  from public.notification_preferences
  where user_id = p_user_id;

  if not found then
    insert into public.notification_preferences(user_id)
    values (p_user_id)
    on conflict (user_id) do nothing;

    select *
    into pref
    from public.notification_preferences
    where user_id = p_user_id;
  end if;

  if coalesce(pref.push_enabled, true) = false
    and coalesce(pref.email_enabled, false) = false then
    return 0;
  end if;

  if coalesce(pref.campaigns_enabled, false) = false then
    return 0;
  end if;

  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    quote,
    campaign_id,
    car_key,
    metadata
  )
  select
    p_user_id,
    'campaign',
    c.title,
    c.description,
    concat_ws(' • ', c.partner_name, c.city),
    c.id,
    'campaign:' || c.id::text,
    jsonb_build_object(
      'partner_name', c.partner_name,
      'city', c.city,
      'starts_at', c.starts_at,
      'ends_at', c.ends_at
    )
  from public.campaigns c
  where c.is_active = true
    and c.starts_at <= now()
    and (c.ends_at is null or c.ends_at >= now())
  on conflict do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.generate_weekly_digest_notifications(p_user_id uuid default auth.uid())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  pref public.notification_preferences%rowtype;
  inserted_count integer := 0;
  digest_key text;
  review_count integer := 0;
  post_count integer := 0;
  search_count integer := 0;
  top_review_car text := null;
  top_search_query text := null;
begin
  if p_user_id is null then
    return 0;
  end if;

  select *
  into pref
  from public.notification_preferences
  where user_id = p_user_id;

  if not found then
    insert into public.notification_preferences(user_id)
    values (p_user_id)
    on conflict (user_id) do nothing;

    select *
    into pref
    from public.notification_preferences
    where user_id = p_user_id;
  end if;

  if coalesce(pref.push_enabled, true) = false
    and coalesce(pref.email_enabled, false) = false then
    return 0;
  end if;

  if coalesce(pref.weekly_digest_enabled, false) = false then
    return 0;
  end if;

  digest_key := 'weekly_digest:' || p_user_id::text || ':' || to_char(now(), 'IYYY-IW');

  select count(*)
  into review_count
  from public.reviews
  where created_at >= now() - interval '7 days';

  select count(*)
  into post_count
  from public.posts
  where created_at >= now() - interval '7 days';

  select count(*)
  into search_count
  from public.vehicle_search_events
  where created_at >= now() - interval '7 days';

  select car
  into top_review_car
  from public.reviews
  where created_at >= now() - interval '7 days'
    and car is not null
  group by car
  order by count(*) desc, max(created_at) desc
  limit 1;

  select query
  into top_search_query
  from public.vehicle_search_events
  where created_at >= now() - interval '7 days'
  group by query
  order by count(*) desc, max(created_at) desc
  limit 1;

  if review_count = 0 and post_count = 0 and search_count = 0 then
    return 0;
  end if;

  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    quote,
    car_key,
    metadata
  )
  values (
    p_user_id,
    'weekly_digest',
    'Haftalık Sektör Özeti',
    'Bu hafta toplulukta öne çıkan araç hareketleri hazır.',
    concat_ws(
      ' • ',
      review_count::text || ' deneyim',
      post_count::text || ' topluluk konusu',
      search_count::text || ' arama',
      case when top_review_car is not null then 'Öne çıkan: ' || top_review_car end,
      case when top_search_query is not null then 'En çok aranan: ' || top_search_query end
    ),
    digest_key,
    jsonb_build_object(
      'review_count', review_count,
      'post_count', post_count,
      'search_count', search_count,
      'top_review_car', top_review_car,
      'top_search_query', top_search_query
    )
  )
  on conflict do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.generate_due_notification_jobs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
  inserted_total integer := 0;
  inserted_count integer := 0;
begin
  for target_user_id in
    select user_id
    from public.notification_preferences
    where (push_enabled = true or email_enabled = true)
      and (
        maintenance_enabled = true
        or inspection_enabled = true
        or insurance_enabled = true
        or mtv_enabled = true
        or campaigns_enabled = true
        or weekly_digest_enabled = true
      )
  loop
    inserted_count := public.generate_vehicle_reminder_notifications(target_user_id);
    inserted_total := inserted_total + coalesce(inserted_count, 0);

    inserted_count := public.generate_campaign_notifications(target_user_id);
    inserted_total := inserted_total + coalesce(inserted_count, 0);

    inserted_count := public.generate_weekly_digest_notifications(target_user_id);
    inserted_total := inserted_total + coalesce(inserted_count, 0);
  end loop;

  return inserted_total;
end;
$$;

create or replace function public.notify_saved_vehicle_interest_from_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    quote,
    actor_id,
    actor_name,
    actor_avatar,
    post_id,
    car_key
  )
  select
    sc.user_id,
    'vehicle_interest',
    coalesce(sc.car_name, 'Takip ettiğin araç'),
    coalesce(sc.car_name, 'Takip ettiğin araç') ||
      ' hakkında yeni bir topluluk gönderisi paylaşıldı.',
    left(coalesce(new.title, new.content, ''), 140),
    new.user_id,
    new.user,
    new.avatar,
    new.id,
    sc.car_key
  from public.saved_cars sc
  left join public.notification_preferences np on np.user_id = sc.user_id
  where sc.user_id <> new.user_id
    and coalesce(np.push_enabled, true) = true
    and coalesce(np.followed_enabled, true) = true
    and sc.car_name is not null
    and public.notification_matches_interest(
      sc.car_name,
      concat_ws(' ', new.car, new.title, new.content)
    )
  on conflict do nothing;

  return new;
end;
$$;

create or replace function public.notify_saved_vehicle_interest_from_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    quote,
    actor_id,
    actor_name,
    actor_avatar,
    review_id,
    car_key
  )
  select
    sc.user_id,
    'vehicle_interest',
    coalesce(sc.car_name, 'Takip ettiğin araç'),
    coalesce(sc.car_name, 'Takip ettiğin araç') ||
      ' hakkında yeni bir deneyim yayınlandı.',
    left(coalesce(new.title, new.comment, ''), 140),
    new.user_id,
    new.user,
    new.avatar,
    new.id,
    sc.car_key
  from public.saved_cars sc
  left join public.notification_preferences np on np.user_id = sc.user_id
  where sc.user_id <> new.user_id
    and coalesce(np.push_enabled, true) = true
    and coalesce(np.followed_enabled, true) = true
    and sc.car_name is not null
    and public.notification_matches_interest(
      sc.car_name,
      concat_ws(' ', new.brand, new.car, new.title, new.comment)
    )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists notify_saved_vehicle_interest_from_post_trigger
on public.posts;

create trigger notify_saved_vehicle_interest_from_post_trigger
after insert on public.posts
for each row execute function public.notify_saved_vehicle_interest_from_post();

drop trigger if exists notify_saved_vehicle_interest_from_review_trigger
on public.reviews;

create trigger notify_saved_vehicle_interest_from_review_trigger
after insert on public.reviews
for each row execute function public.notify_saved_vehicle_interest_from_review();

create or replace function public.notify_comment_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    quote,
    actor_id,
    actor_name,
    actor_avatar,
    post_id,
    review_id,
    comment_id
  )
  select
    target_owner.user_id,
    'comment',
    coalesce(new.user, 'Bir kullanıcı'),
    'İçeriğine yeni bir yorum geldi.',
    left(coalesce(new.text, new.content, ''), 140),
    new.user_id,
    new.user,
    new.avatar,
    new.post_id,
    new.review_id,
    new.id
  from (
    select p.user_id
    from public.posts p
    where p.id = new.post_id
    union all
    select r.user_id
    from public.reviews r
    where r.id = new.review_id
  ) target_owner
  left join public.notification_preferences np on np.user_id = target_owner.user_id
  where target_owner.user_id is not null
    and target_owner.user_id <> new.user_id
    and coalesce(np.push_enabled, true) = true
    and coalesce(np.replies_enabled, true) = true
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists notify_comment_reply_trigger on public.comments;
create trigger notify_comment_reply_trigger
after insert on public.comments
for each row execute function public.notify_comment_reply();

create or replace function public.notify_community_post_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  community_label text;
begin
  if new.community_id is null then
    return new;
  end if;

  community_label := initcap(replace(new.community_id, '-', ' '));

  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    quote,
    actor_id,
    actor_name,
    actor_avatar,
    post_id,
    metadata
  )
  select
    cm.user_id,
    'community',
    community_label || ' topluluğunda yeni gönderi',
    coalesce(new.user, 'Bir üye') || ' yeni bir gönderi paylaştı.',
    left(coalesce(new.title, new.content, ''), 140),
    new.user_id,
    new.user,
    new.avatar,
    new.id,
    jsonb_build_object('community_id', new.community_id)
  from public.community_memberships cm
  left join public.notification_preferences np on np.user_id = cm.user_id
  where cm.community_id = new.community_id
    and cm.user_id is not null
    and cm.user_id <> new.user_id
    and coalesce(cm.notifications_enabled, true) = true
    and coalesce(np.push_enabled, true) = true
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists notify_community_post_insert_trigger on public.posts;
create trigger notify_community_post_insert_trigger
after insert on public.posts
for each row execute function public.notify_community_post_insert();

create or replace function public.notify_like_from_post_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.upvotes, 0) <= coalesce(old.upvotes, 0) then
    return new;
  end if;

  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    quote,
    post_id
  )
  select
    new.user_id,
    'like',
    'Gönderin faydalı bulundu',
    'Toplulukta paylaştığın gönderi faydalı oyu aldı.',
    left(coalesce(new.title, new.content, ''), 140),
    new.id
  from public.profiles p
  left join public.notification_preferences np on np.user_id = p.id
  where p.id = new.user_id
    and coalesce(np.push_enabled, true) = true
    and coalesce(np.likes_enabled, true) = true
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists notify_like_from_post_update_trigger on public.posts;
create trigger notify_like_from_post_update_trigger
after update of upvotes on public.posts
for each row execute function public.notify_like_from_post_update();

create or replace function public.notify_like_from_comment_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.upvotes, 0) <= coalesce(old.upvotes, 0) then
    return new;
  end if;

  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    quote,
    post_id,
    review_id,
    comment_id
  )
  select
    new.user_id,
    'like',
    'Yorumun faydalı bulundu',
    'Toplulukta yazdığın yorum faydalı oyu aldı.',
    left(coalesce(new.text, new.content, ''), 140),
    new.post_id,
    new.review_id,
    new.id
  from public.profiles p
  left join public.notification_preferences np on np.user_id = p.id
  where p.id = new.user_id
    and coalesce(np.push_enabled, true) = true
    and coalesce(np.likes_enabled, true) = true
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists notify_like_from_comment_update_trigger on public.comments;
create trigger notify_like_from_comment_update_trigger
after update of upvotes on public.comments
for each row execute function public.notify_like_from_comment_update();

-- ============================================================================
-- Source: supabase/vehicle_catalog_seed.sql
-- ============================================================================
-- Vehicle catalog seed for brands/models used by filters and post/review forms.
-- This does not delete existing rows. It only inserts missing brands/models.

create or replace function public.seed_vehicle_model(p_brand_name text, p_model_name text)
returns void
language plpgsql
as $$
declare
  v_brand_id uuid;
begin
  select id
  into v_brand_id
  from public.brands
  where lower(trim(name)) = lower(trim(p_brand_name))
  limit 1;

  if v_brand_id is null then
    insert into public.brands(name)
    values (trim(p_brand_name))
    returning id into v_brand_id;
  end if;

  if not exists (
    select 1
    from public.models
    where brand_id = v_brand_id
      and lower(trim(name)) = lower(trim(p_model_name))
  ) then
    insert into public.models(brand_id, name)
    values (v_brand_id, trim(p_model_name));
  end if;
end;
$$;

select public.seed_vehicle_model('Abarth', model_name)
from unnest(array['500', '595', '695', 'Punto Evo']) as model_name;

select public.seed_vehicle_model('Alfa Romeo', model_name)
from unnest(array['145', '146', '147', '155', '156', '159', '166', 'Giulia', 'Giulietta', 'GT', 'MiTo', 'Stelvio', 'Tonale']) as model_name;

select public.seed_vehicle_model('Audi', model_name)
from unnest(array['A1', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q2', 'Q3', 'Q4 e-tron', 'Q5', 'Q7', 'Q8', 'R8', 'RS3', 'RS4', 'RS5', 'RS6', 'RS7', 'S3', 'S4', 'S5', 'S6', 'S7', 'TT', 'e-tron', 'e-tron GT']) as model_name;

select public.seed_vehicle_model('BMW', model_name)
from unnest(array['1 Serisi', '2 Serisi', '3 Serisi', '4 Serisi', '5 Serisi', '6 Serisi', '7 Serisi', '8 Serisi', 'i3', 'i4', 'i5', 'i7', 'i8', 'iX', 'iX1', 'iX2', 'iX3', 'M2', 'M3', 'M4', 'M5', 'M8', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'Z3', 'Z4']) as model_name;

select public.seed_vehicle_model('Chery', model_name)
from unnest(array['Arrizo 5', 'Arrizo 8', 'Omoda 5', 'Tiggo 4 Pro', 'Tiggo 7 Pro', 'Tiggo 8 Pro', 'Tiggo 8 Pro Max']) as model_name;

select public.seed_vehicle_model('Citroën', model_name)
from unnest(array['AMI', 'Berlingo', 'C-Elysee', 'C1', 'C2', 'C3', 'C3 Aircross', 'C3 Picasso', 'C4', 'C4 Cactus', 'C4 Picasso', 'C4 X', 'C5', 'C5 Aircross', 'C5 X', 'DS3', 'DS4', 'DS5', 'Jumpy', 'Saxo', 'Xantia', 'Xsara']) as model_name;

select public.seed_vehicle_model('Cupra', model_name)
from unnest(array['Ateca', 'Born', 'Formentor', 'Leon', 'Tavascan', 'Terramar']) as model_name;

select public.seed_vehicle_model('Dacia', model_name)
from unnest(array['Dokker', 'Duster', 'Jogger', 'Lodgy', 'Logan', 'Logan MCV', 'Sandero', 'Sandero Stepway', 'Spring']) as model_name;

select public.seed_vehicle_model('Fiat', model_name)
from unnest(array['124 Spider', '500', '500L', '500X', 'Albea', 'Bravo', 'Brava', 'Doblo', 'Egea', 'Fiorino', 'Freemont', 'Grande Punto', 'Linea', 'Marea', 'Palio', 'Panda', 'Punto', 'Punto Evo', 'Scudo', 'Sedici', 'Siena', 'Stilo', 'Tipo', 'Ulysse']) as model_name;

select public.seed_vehicle_model('Ford', model_name)
from unnest(array['B-Max', 'C-Max', 'Connect', 'Courier', 'EcoSport', 'Edge', 'Escort', 'Explorer', 'Fiesta', 'Focus', 'Fusion', 'Galaxy', 'Kuga', 'Maverick', 'Mondeo', 'Mustang', 'Puma', 'Ranger', 'S-Max', 'Tourneo Connect', 'Tourneo Courier', 'Transit', 'Transit Custom']) as model_name;

select public.seed_vehicle_model('Honda', model_name)
from unnest(array['Accord', 'City', 'Civic', 'CR-V', 'CR-Z', 'e:Ny1', 'HR-V', 'Jazz', 'Legend', 'S2000']) as model_name;

select public.seed_vehicle_model('Hyundai', model_name)
from unnest(array['Accent', 'Accent Blue', 'Atos', 'Bayon', 'Coupe', 'Elantra', 'Getz', 'i10', 'i20', 'i20 Active', 'i30', 'i40', 'Ioniq', 'Ioniq 5', 'Ioniq 6', 'ix20', 'ix35', 'Kona', 'Matrix', 'Santa Fe', 'Sonata', 'Staria', 'Tucson']) as model_name;

select public.seed_vehicle_model('Kia', model_name)
from unnest(array['Carens', 'Carnival', 'Ceed', 'Cerato', 'EV3', 'EV6', 'EV9', 'Niro', 'Optima', 'Picanto', 'ProCeed', 'Rio', 'Sorento', 'Soul', 'Sportage', 'Stonic', 'XCeed']) as model_name;

select public.seed_vehicle_model('Mercedes-Benz', model_name)
from unnest(array[
  'A Serisi', 'AMG GT', 'B Serisi', 'C Serisi', 'CLA', 'CLC', 'CLK', 'CLS',
  'E Serisi', 'EQA', 'EQB', 'EQC', 'EQE', 'EQS', 'EQV', 'G Serisi', 'GL',
  'GLA', 'GLB', 'GLC', 'GLE', 'GLK', 'GLS', 'M Serisi', 'R Serisi',
  'S Serisi', 'SL', 'SLC', 'SLK', 'SLS AMG', 'V Serisi', 'Viano', 'Vito',
  'X Serisi'
]) as model_name;

select public.seed_vehicle_model('MINI', model_name)
from unnest(array['Cabrio', 'Clubman', 'Cooper', 'Cooper 3 Kapı', 'Cooper 5 Kapı', 'Countryman', 'Coupe', 'Paceman', 'Roadster']) as model_name;

select public.seed_vehicle_model('Nissan', model_name)
from unnest(array['Almera', 'Ariya', 'Juke', 'Micra', 'Murano', 'Navara', 'Note', 'Pathfinder', 'Primera', 'Qashqai', 'Qashqai+2', 'Skyline', 'Sunny', 'Terrano', 'X-Trail']) as model_name;

select public.seed_vehicle_model('Opel', model_name)
from unnest(array['Adam', 'Antara', 'Astra', 'Corsa', 'Crossland', 'Frontera', 'Grandland', 'Insignia', 'Karl', 'Meriva', 'Mokka', 'Omega', 'Signum', 'Tigra', 'Vectra', 'Vivaro', 'Zafira']) as model_name;

select public.seed_vehicle_model('Peugeot', model_name)
from unnest(array['106', '107', '108', '2008', '206', '206+', '207', '208', '3008', '301', '306', '307', '308', '4007', '407', '408', '5008', '508', '607', 'Bipper', 'Expert', 'Partner', 'RCZ', 'Rifter']) as model_name;

select public.seed_vehicle_model('Renault', model_name)
from unnest(array['Austral', 'Captur', 'Clio', 'Espace', 'Fluence', 'Kadjar', 'Kangoo', 'Koleos', 'Laguna', 'Latitude', 'Megane', 'Modus', 'Rafale', 'Scenic', 'Symbol', 'Taliant', 'Talisman', 'Trafic', 'Twizy', 'Zoe']) as model_name;

select public.seed_vehicle_model('Seat', model_name)
from unnest(array['Alhambra', 'Altea', 'Arona', 'Ateca', 'Cordoba', 'Exeo', 'Ibiza', 'Leon', 'Mii', 'Tarraco', 'Toledo']) as model_name;

select public.seed_vehicle_model('Skoda', model_name)
from unnest(array['Citigo', 'Fabia', 'Favorit', 'Felicia', 'Kamiq', 'Karoq', 'Kodiaq', 'Octavia', 'Rapid', 'Roomster', 'Scala', 'Superb', 'Yeti']) as model_name;

select public.seed_vehicle_model('Tesla', model_name)
from unnest(array['Model 3', 'Model S', 'Model X', 'Model Y']) as model_name;

select public.seed_vehicle_model('Toyota', model_name)
from unnest(array['Auris', 'Avensis', 'Aygo', 'C-HR', 'Camry', 'Carina', 'Celica', 'Corolla', 'Corolla Cross', 'Hilux', 'Land Cruiser', 'Prius', 'Proace City', 'RAV4', 'Supra', 'Urban Cruiser', 'Verso', 'Yaris', 'Yaris Cross']) as model_name;

select public.seed_vehicle_model('Volkswagen', model_name)
from unnest(array['Amarok', 'Arteon', 'Beetle', 'Bora', 'Caddy', 'California', 'Caravelle', 'CC', 'Crafter', 'Eos', 'Golf', 'ID.3', 'ID.4', 'ID.5', 'ID.7', 'Jetta', 'Multivan', 'Passat', 'Passat Variant', 'Phaeton', 'Polo', 'Scirocco', 'Sharan', 'T-Cross', 'T-Roc', 'Taigo', 'Tiguan', 'Touareg', 'Touran', 'Transporter', 'Up']) as model_name;

select public.seed_vehicle_model('Volvo', model_name)
from unnest(array['C30', 'C40', 'C70', 'EX30', 'EX40', 'EX90', 'S40', 'S60', 'S80', 'S90', 'V40', 'V50', 'V60', 'V70', 'V90', 'XC40', 'XC60', 'XC70', 'XC90']) as model_name;

drop function if exists public.seed_vehicle_model(text, text);

-- ============================================================================
-- Source: supabase/moderation_schema.sql
-- ============================================================================
-- Moderation baseline: reports, roles, user status and soft-hidden content.

alter table public.profiles
add column if not exists role text not null default 'user',
add column if not exists moderation_status text not null default 'active',
add column if not exists suspended_until timestamptz,
add column if not exists moderation_note text;

do $$
begin
  alter table public.profiles
  add constraint profiles_role_check
  check (role in ('user', 'moderator', 'admin'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.profiles
  add constraint profiles_moderation_status_check
  check (moderation_status in ('active', 'warned', 'suspended', 'blocked'));
exception
  when duplicate_object then null;
end $$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()),
    'user'
  );
$$;

create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('moderator', 'admin');
$$;

create or replace function public.current_user_can_post()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and moderation_status <> 'blocked'
      and (
        moderation_status <> 'suspended'
        or suspended_until is null
        or suspended_until < now()
      )
  );
$$;

alter table public.posts
add column if not exists is_hidden boolean not null default false,
add column if not exists hidden_reason text,
add column if not exists hidden_by uuid references public.profiles(id) on delete set null,
add column if not exists hidden_at timestamptz;

alter table public.reviews
add column if not exists is_hidden boolean not null default false,
add column if not exists hidden_reason text,
add column if not exists hidden_by uuid references public.profiles(id) on delete set null,
add column if not exists hidden_at timestamptz;

alter table public.comments
add column if not exists is_hidden boolean not null default false,
add column if not exists hidden_reason text,
add column if not exists hidden_by uuid references public.profiles(id) on delete set null,
add column if not exists hidden_at timestamptz;

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  content_type text not null check (content_type in ('post', 'review', 'comment')),
  content_id uuid not null,
  content_owner_id uuid references public.profiles(id) on delete set null,
  reason text not null default 'Uygunsuz içerik',
  details text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'rejected')),
  moderator_id uuid references public.profiles(id) on delete set null,
  moderator_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reporter_id, content_type, content_id)
);

create index if not exists content_reports_status_created_idx
on public.content_reports(status, created_at desc);

create index if not exists content_reports_content_idx
on public.content_reports(content_type, content_id);

create index if not exists posts_visible_created_idx
on public.posts(created_at desc)
where is_hidden = false;

create index if not exists reviews_visible_created_idx
on public.reviews(created_at desc)
where is_hidden = false;

create index if not exists comments_visible_post_created_idx
on public.comments(post_id, created_at)
where is_hidden = false and post_id is not null;

create index if not exists comments_visible_review_created_idx
on public.comments(review_id, created_at)
where is_hidden = false and review_id is not null;

alter table public.content_reports enable row level security;

drop policy if exists "Users can create content reports" on public.content_reports;
create policy "Users can create content reports"
on public.content_reports for insert
to authenticated
with check (auth.uid() = reporter_id);

drop policy if exists "Users can read own content reports" on public.content_reports;
create policy "Users can read own content reports"
on public.content_reports for select
to authenticated
using (auth.uid() = reporter_id or public.is_moderator());

drop policy if exists "Moderators can read profiles" on public.profiles;
create policy "Moderators can read profiles"
on public.profiles for select
to authenticated
using (public.is_moderator());

drop policy if exists "Moderators can update content reports" on public.content_reports;
create policy "Moderators can update content reports"
on public.content_reports for update
to authenticated
using (public.is_moderator())
with check (public.is_moderator());

drop policy if exists "Posts are readable by everyone" on public.posts;
create policy "Posts are readable by everyone"
on public.posts for select
to anon, authenticated
using (is_hidden = false or public.is_moderator());

drop policy if exists "Authenticated users can insert their own posts" on public.posts;
create policy "Authenticated users can insert their own posts"
on public.posts for insert
to authenticated
with check (auth.uid() = user_id and public.current_user_can_post());

drop policy if exists "Reviews are readable by everyone" on public.reviews;
create policy "Reviews are readable by everyone"
on public.reviews for select
to anon, authenticated
using (is_hidden = false or public.is_moderator());

drop policy if exists "Authenticated users can insert their own reviews" on public.reviews;
create policy "Authenticated users can insert their own reviews"
on public.reviews for insert
to authenticated
with check (auth.uid() = user_id and public.current_user_can_post());

drop policy if exists "Comments are readable by everyone" on public.comments;
create policy "Comments are readable by everyone"
on public.comments for select
to anon, authenticated
using (is_hidden = false or public.is_moderator());

drop policy if exists "Authenticated users can insert their own comments" on public.comments;
create policy "Authenticated users can insert their own comments"
on public.comments for insert
to authenticated
with check (auth.uid() = user_id and public.current_user_can_post());

create or replace function public.moderate_content_report(
  p_report_id uuid,
  p_action text,
  p_note text default null,
  p_hidden_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_report public.content_reports%rowtype;
begin
  if not public.is_moderator() then
    raise exception 'Yetkisiz işlem.';
  end if;

  select *
  into target_report
  from public.content_reports
  where id = p_report_id
  for update;

  if not found then
    raise exception 'Şikayet bulunamadı.';
  end if;

  if p_action = 'reviewing' then
    update public.content_reports
    set status = 'reviewing',
        moderator_id = auth.uid(),
        moderator_note = p_note,
        updated_at = now()
    where id = p_report_id;
  elsif p_action = 'reject' then
    update public.content_reports
    set status = 'rejected',
        moderator_id = auth.uid(),
        moderator_note = p_note,
        resolved_at = now(),
        updated_at = now()
    where id = p_report_id;
  elsif p_action = 'hide_content_resolve' then
    if target_report.content_type = 'post' then
      update public.posts
      set is_hidden = true,
          hidden_reason = coalesce(p_hidden_reason, target_report.reason),
          hidden_by = auth.uid(),
          hidden_at = now()
      where id = target_report.content_id;
    elsif target_report.content_type = 'review' then
      update public.reviews
      set is_hidden = true,
          hidden_reason = coalesce(p_hidden_reason, target_report.reason),
          hidden_by = auth.uid(),
          hidden_at = now()
      where id = target_report.content_id;
    elsif target_report.content_type = 'comment' then
      update public.comments
      set is_hidden = true,
          hidden_reason = coalesce(p_hidden_reason, target_report.reason),
          hidden_by = auth.uid(),
          hidden_at = now()
      where id = target_report.content_id;
    else
      raise exception 'Desteklenmeyen içerik tipi.';
    end if;

    update public.content_reports
    set status = 'resolved',
        moderator_id = auth.uid(),
        moderator_note = p_note,
        resolved_at = now(),
        updated_at = now()
    where id = p_report_id;
  else
    raise exception 'Bilinmeyen moderasyon aksiyonu.';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.set_user_moderation_status(
  p_user_id uuid,
  p_status text,
  p_note text default null,
  p_suspended_until timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'Yetkisiz işlem.';
  end if;

  if p_status not in ('active', 'warned', 'suspended', 'blocked') then
    raise exception 'Geçersiz kullanıcı durumu.';
  end if;

  update public.profiles
  set moderation_status = p_status,
      suspended_until = case
        when p_status = 'suspended' then p_suspended_until
        else null
      end,
      moderation_note = p_note
  where id = p_user_id;

  if not found then
    raise exception 'Kullanıcı profili bulunamadı.';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- ============================================================================
-- Source: supabase/helpful_vote_notifications.sql
-- ============================================================================

drop trigger if exists notify_like_from_post_update_trigger on public.posts;
drop trigger if exists notify_like_from_comment_update_trigger on public.comments;

drop index if exists public.notifications_like_post_unique;
drop index if exists public.notifications_like_comment_unique;

create unique index if not exists notifications_post_vote_actor_unique
on public.notifications(user_id, type, post_id, actor_id)
where post_id is not null and actor_id is not null and type = 'post_vote';

create unique index if not exists notifications_comment_vote_actor_unique
on public.notifications(user_id, type, comment_id, actor_id)
where comment_id is not null and actor_id is not null and type = 'comment_vote';

create unique index if not exists notifications_helpful_vote_actor_unique
on public.notifications(user_id, type, review_id, actor_id)
where review_id is not null and actor_id is not null and type = 'helpful_vote';

create or replace function public.notify_helpful_vote_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_user_id uuid;
  owner_user_id uuid;
  target_post_id uuid;
  target_comment_id uuid;
  target_review_id uuid;
  notification_type text;
  notification_message text;
  notification_quote text;
  actor_display_name text;
  actor_avatar_url text;
begin
  actor_user_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;

  if tg_table_name = 'post_votes' then
    target_post_id := case when tg_op = 'DELETE' then old.post_id else new.post_id end;
    notification_type := 'post_vote';
  elsif tg_table_name = 'comment_votes' then
    target_comment_id := case when tg_op = 'DELETE' then old.comment_id else new.comment_id end;
    notification_type := 'comment_vote';
  elsif tg_table_name = 'review_helpful_votes' then
    target_review_id := case when tg_op = 'DELETE' then old.review_id else new.review_id end;
    notification_type := 'helpful_vote';
  else
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    delete from public.notifications
    where type = notification_type
      and actor_id = actor_user_id
      and (target_post_id is null or post_id = target_post_id)
      and (target_comment_id is null or comment_id = target_comment_id)
      and (target_review_id is null or review_id = target_review_id);
    return old;
  end if;

  if notification_type = 'post_vote' then
    select p.user_id, 'gönderini faydalı buldu.',
           left(concat_ws(' — ', nullif(p.title, ''), nullif(p.content, '')), 180)
    into owner_user_id, notification_message, notification_quote
    from public.posts p
    where p.id = target_post_id;
  elsif notification_type = 'comment_vote' then
    select c.user_id, c.post_id, c.review_id, 'yorumunu faydalı buldu.',
           left(coalesce(c.text, c.content, ''), 140)
    into owner_user_id, target_post_id, target_review_id,
         notification_message, notification_quote
    from public.comments c
    where c.id = target_comment_id;
  else
    select r.user_id, 'deneyimini faydalı buldu.',
           left(concat_ws(' — ', nullif(r.title, ''), nullif(r.comment, '')), 180)
    into owner_user_id, notification_message, notification_quote
    from public.reviews r
    where r.id = target_review_id;
  end if;

  if owner_user_id is null or owner_user_id = actor_user_id then
    return new;
  end if;

  select
    coalesce(nullif(display_name, ''), nullif(full_name, ''), 'Bir kullanıcı'),
    avatar_url
  into actor_display_name, actor_avatar_url
  from public.profiles
  where id = actor_user_id;

  if not exists (
    select 1
    from public.notification_preferences np
    where np.user_id = owner_user_id
      and (
        coalesce(np.push_enabled, true) = false
        or coalesce(np.likes_enabled, true) = false
      )
  ) then
    insert into public.notifications (
      user_id, type, title, message, quote,
      actor_id, actor_name, actor_avatar,
      post_id, review_id, comment_id
    )
    values (
      owner_user_id,
      notification_type,
      coalesce(actor_display_name, 'Bir kullanıcı'),
      notification_message,
      notification_quote,
      actor_user_id,
      coalesce(actor_display_name, 'Bir kullanıcı'),
      actor_avatar_url,
      target_post_id,
      target_review_id,
      target_comment_id
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists notify_post_vote_change_trigger on public.post_votes;
create trigger notify_post_vote_change_trigger
after insert or delete on public.post_votes
for each row execute function public.notify_helpful_vote_change();

drop trigger if exists notify_comment_vote_change_trigger on public.comment_votes;
create trigger notify_comment_vote_change_trigger
after insert or delete on public.comment_votes
for each row execute function public.notify_helpful_vote_change();

drop trigger if exists notify_review_helpful_vote_change_trigger
on public.review_helpful_votes;
create trigger notify_review_helpful_vote_change_trigger
after insert or delete on public.review_helpful_votes
for each row execute function public.notify_helpful_vote_change();

-- ============================================================================
-- Source: supabase/user_follows_schema.sql
-- ============================================================================

create table if not exists public.user_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint user_follows_not_self check (follower_id <> following_id)
);

create index if not exists user_follows_following_created_idx
on public.user_follows(following_id, created_at desc);

alter table public.user_follows enable row level security;

drop policy if exists "Authenticated users can read follows" on public.user_follows;
drop policy if exists "Users can follow from their own account" on public.user_follows;
drop policy if exists "Users can unfollow from their own account" on public.user_follows;

create policy "Authenticated users can read follows"
on public.user_follows for select
to authenticated
using (true);

create policy "Users can follow from their own account"
on public.user_follows for insert
to authenticated
with check (auth.uid() = follower_id and follower_id <> following_id);

create policy "Users can unfollow from their own account"
on public.user_follows for delete
to authenticated
using (auth.uid() = follower_id);

-- ============================================================================
-- Source: supabase/follow_notifications.sql
-- ============================================================================

create unique index if not exists notifications_follow_actor_unique
on public.notifications(user_id, type, actor_id)
where actor_id is not null and type = 'follow';

create or replace function public.notify_user_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  actor_display_name text;
  actor_avatar_url text;
begin
  select
    coalesce(nullif(display_name, ''), nullif(full_name, ''), 'Bir kullanıcı'),
    avatar_url
  into actor_display_name, actor_avatar_url
  from public.profiles
  where id = new.follower_id;

  insert into public.notifications (
    user_id, type, title, message,
    actor_id, actor_name, actor_avatar, metadata
  )
  values (
    new.following_id,
    'follow',
    coalesce(actor_display_name, 'Bir kullanıcı'),
    'seni takip etmeye başladı.',
    new.follower_id,
    coalesce(actor_display_name, 'Bir kullanıcı'),
    actor_avatar_url,
    jsonb_build_object('follower_id', new.follower_id)
  )
  on conflict do nothing;

  return new;
end;
$function$;

create or replace function public.remove_user_follow_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  delete from public.notifications
  where user_id = old.following_id
    and type = 'follow'
    and actor_id = old.follower_id;
  return old;
end;
$function$;

drop trigger if exists notify_user_follow_trigger on public.user_follows;
create trigger notify_user_follow_trigger
after insert on public.user_follows
for each row execute function public.notify_user_follow();

drop trigger if exists remove_user_follow_notification_trigger
on public.user_follows;
create trigger remove_user_follow_notification_trigger
after delete on public.user_follows
for each row execute function public.remove_user_follow_notification();

-- ============================================================================
-- Source: supabase/legal_consents_schema.sql
-- ============================================================================

create table if not exists public.legal_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_type text not null,
  document_version text not null,
  accepted_at timestamptz not null default now(),
  source text not null default 'registration',
  metadata jsonb not null default '{}'::jsonb,
  constraint legal_consents_document_type_check
    check (document_type in ('terms', 'kvkk', 'privacy', 'marketing_consent')),
  constraint legal_consents_source_check
    check (source in ('registration', 'settings', 'migration'))
);

create unique index if not exists legal_consents_user_document_version_unique
on public.legal_consents(user_id, document_type, document_version);

create index if not exists legal_consents_user_accepted_idx
on public.legal_consents(user_id, accepted_at desc);

alter table public.legal_consents enable row level security;

drop policy if exists "Users can read their own legal consents"
on public.legal_consents;
drop policy if exists "Users can record their own legal consents"
on public.legal_consents;

create policy "Users can read their own legal consents"
on public.legal_consents for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can record their own legal consents"
on public.legal_consents for insert
to authenticated
with check (auth.uid() = user_id);

do $$
begin
  alter table public.legal_consents
    drop constraint if exists legal_consents_document_type_check;

  alter table public.legal_consents
    add constraint legal_consents_document_type_check
    check (document_type in ('terms', 'kvkk', 'privacy', 'marketing_consent'));
end;
$$;
