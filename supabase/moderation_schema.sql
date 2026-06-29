-- OtoRehber moderation baseline.
-- Run in Supabase SQL Editor after complete_schema_migration.sql.

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
