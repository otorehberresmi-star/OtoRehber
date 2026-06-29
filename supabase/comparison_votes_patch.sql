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
