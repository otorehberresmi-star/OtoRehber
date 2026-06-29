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
