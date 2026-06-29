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
