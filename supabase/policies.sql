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

create or replace view public.public_profiles as
select
  id,
  display_name,
  full_name,
  avatar_url,
  created_at
from public.profiles;

grant select on public.public_profiles to anon, authenticated;

create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

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
