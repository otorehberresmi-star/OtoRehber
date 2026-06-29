-- Adds downvotes to vehicle reviews so review detail can use the same
-- up/down interaction pattern as posts and comments.

alter table public.reviews
add column if not exists downvotes integer not null default 0;

create table if not exists public.review_downvotes (
  review_id uuid not null references public.reviews(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

alter table public.review_downvotes enable row level security;

drop policy if exists "Users can read own review downvotes"
on public.review_downvotes;
drop policy if exists "Users can insert own review downvotes"
on public.review_downvotes;
drop policy if exists "Users can delete own review downvotes"
on public.review_downvotes;

create policy "Users can read own review downvotes"
on public.review_downvotes for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own review downvotes"
on public.review_downvotes for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can delete own review downvotes"
on public.review_downvotes for delete
to authenticated
using (auth.uid() = user_id);

create or replace function public.toggle_review_downvote(p_review_id uuid)
returns table(is_downvoted boolean, helpful_votes integer, downvotes integer)
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid();
  owner_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select user_id into owner_id
  from public.reviews
  where id = p_review_id
  for update;

  if not found then raise exception 'Review not found'; end if;
  if owner_id = current_user_id then
    raise exception 'Users cannot vote on their own reviews';
  end if;

  if exists (
    select 1 from public.review_downvotes
    where review_id = p_review_id and user_id = current_user_id
  ) then
    delete from public.review_downvotes
    where review_id = p_review_id and user_id = current_user_id;

    update public.reviews
    set downvotes = greatest(0, reviews.downvotes - 1)
    where id = p_review_id;
    is_downvoted := false;
  else
    if exists (
      select 1 from public.review_helpful_votes
      where review_id = p_review_id and user_id = current_user_id
    ) then
      delete from public.review_helpful_votes
      where review_id = p_review_id and user_id = current_user_id;
      update public.reviews
      set helpful_votes = greatest(0, reviews.helpful_votes - 1)
      where id = p_review_id;
    end if;

    insert into public.review_downvotes(review_id, user_id)
    values (p_review_id, current_user_id);
    update public.reviews
    set downvotes = reviews.downvotes + 1
    where id = p_review_id;
    is_downvoted := true;
  end if;

  select r.helpful_votes, r.downvotes
  into helpful_votes, downvotes
  from public.reviews r
  where r.id = p_review_id;

  return next;
end;
$function$;

grant execute on function public.toggle_review_downvote(uuid) to authenticated;
