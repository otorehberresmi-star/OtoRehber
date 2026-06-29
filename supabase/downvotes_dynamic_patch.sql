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

create index if not exists post_downvotes_user_created_idx
on public.post_downvotes(user_id, created_at desc);

create index if not exists comment_downvotes_user_created_idx
on public.comment_downvotes(user_id, created_at desc);

alter table public.post_downvotes enable row level security;
alter table public.comment_downvotes enable row level security;

drop policy if exists "Users can read own post downvotes" on public.post_downvotes;
drop policy if exists "Users can insert own post downvotes" on public.post_downvotes;
drop policy if exists "Users can delete own post downvotes" on public.post_downvotes;
drop policy if exists "Users can read own comment downvotes" on public.comment_downvotes;
drop policy if exists "Users can insert own comment downvotes" on public.comment_downvotes;
drop policy if exists "Users can delete own comment downvotes" on public.comment_downvotes;

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

drop function if exists public.toggle_post_vote(uuid);
drop function if exists public.toggle_comment_vote(uuid);
drop function if exists public.toggle_post_downvote(uuid);
drop function if exists public.toggle_comment_downvote(uuid);

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

  return next;
end;
$$;

grant execute on function public.toggle_post_vote(uuid) to authenticated;
grant execute on function public.toggle_comment_vote(uuid) to authenticated;
grant execute on function public.toggle_post_downvote(uuid) to authenticated;
grant execute on function public.toggle_comment_downvote(uuid) to authenticated;
