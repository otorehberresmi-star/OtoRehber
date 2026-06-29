-- OtoRehber clean user test reset.
-- This removes all app users and all user-generated data.
-- It keeps catalog/setup data such as brands, models, vehicle_specs,
-- campaigns, storage buckets, functions, policies, and schema objects.
--
-- Run in Supabase Dashboard > SQL Editor.
-- WARNING: This is destructive. Use only on a test/staging project, or when
-- you intentionally want a clean production-like test dataset.

begin;

-- Interaction/vote tables
truncate table
  public.post_votes,
  public.post_downvotes,
  public.comment_votes,
  public.comment_downvotes,
  public.review_helpful_votes,
  public.comparison_votes
restart identity cascade;

-- Notifications, tokens, reminders, and preferences
truncate table
  public.notifications,
  public.push_tokens,
  public.vehicle_reminders,
  public.notification_preferences
restart identity cascade;

-- User content and personal data
truncate table
  public.comments,
  public.posts,
  public.reviews,
  public.timeline_entries,
  public.garage_cars,
  public.saved_cars,
  public.community_memberships,
  public.vehicle_search_events
restart identity cascade;

-- Public profile rows
truncate table public.profiles restart identity cascade;

-- Supabase Auth users. This removes login accounts too.
delete from auth.users;

-- Optional: clear/refresh cached discover widgets so they rebuild from clean data.
delete from public.daily_comparison_cache;
refresh materialized view public.discover_trending_cars_cache;

commit;

-- Quick verification after run:
select 'auth.users' as table_name, count(*) as rows from auth.users
union all select 'profiles', count(*) from public.profiles
union all select 'posts', count(*) from public.posts
union all select 'reviews', count(*) from public.reviews
union all select 'comments', count(*) from public.comments
union all select 'garage_cars', count(*) from public.garage_cars
union all select 'saved_cars', count(*) from public.saved_cars
union all select 'notifications', count(*) from public.notifications
union all select 'vehicle_search_events', count(*) from public.vehicle_search_events;
