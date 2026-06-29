-- Vehicle/search interest notifications for OtoRehber.
-- Run after saved_cars_schema.sql.

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
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
on public.notifications(user_id, created_at desc);

create unique index if not exists notifications_vehicle_interest_post_unique
on public.notifications(user_id, type, post_id, car_key)
where post_id is not null and type = 'vehicle_interest';

create unique index if not exists notifications_vehicle_interest_review_unique
on public.notifications(user_id, type, review_id, car_key)
where review_id is not null and type = 'vehicle_interest';

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
  where sc.user_id <> new.user_id
    and sc.car_name is not null
    and (
      public.notification_matches_interest(
        sc.car_name,
        concat_ws(' ', new.car, new.title, new.content)
      )
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
  where sc.user_id <> new.user_id
    and sc.car_name is not null
    and public.notification_matches_interest(
      sc.car_name,
      concat_ws(' ', new.brand, new.car, new.title, new.comment)
    )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists notify_saved_vehicle_interest_from_review_trigger
on public.reviews;

create trigger notify_saved_vehicle_interest_from_review_trigger
after insert on public.reviews
for each row execute function public.notify_saved_vehicle_interest_from_review();
