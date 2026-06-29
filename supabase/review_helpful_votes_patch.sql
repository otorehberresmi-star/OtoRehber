create table if not exists public.review_helpful_votes (
  review_id uuid not null references public.reviews(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

create index if not exists review_helpful_votes_user_created_idx
on public.review_helpful_votes(user_id, created_at desc);

alter table public.review_helpful_votes enable row level security;

drop policy if exists "Users can read own review helpful votes" on public.review_helpful_votes;
drop policy if exists "Users can insert own review helpful votes" on public.review_helpful_votes;
drop policy if exists "Users can delete own review helpful votes" on public.review_helpful_votes;

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

drop function if exists public.toggle_review_helpful_vote(uuid);

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
