-- Keep the daily comparison limited to models that have technical data.
-- This guarantees that the comparison detail can render both spec columns.

create or replace function public.refresh_daily_comparison_cache(
  p_date date default current_date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.daily_comparison_cache
  where date_key = p_date;

  insert into public.daily_comparison_cache(
    date_key,
    slot,
    model_id,
    brand,
    model,
    posts_count,
    score,
    refreshed_at
  )
  with ranked_models as (
    select
      m.id,
      m.name,
      coalesce(b.name, '') as brand,
      row_number() over (order by md5(p_date::text || ':' || m.id::text)) as slot
    from public.models m
    left join public.brands b on b.id = m.brand_id
    where exists (
      select 1
      from public.vehicle_specs vs
      where vs.model_id = m.id
    )
  ),
  selected as (
    select *
    from ranked_models
    where slot <= 2
  ),
  post_metrics as (
    select
      p.model_id,
      count(*)::bigint as posts_count,
      sum(1 + coalesce(p.upvotes, 0) + coalesce(p.comments, 0))::numeric as score
    from public.posts p
    join selected s on s.id = p.model_id
    group by p.model_id
  )
  select
    p_date,
    s.slot::integer,
    s.id,
    s.brand::text,
    s.name::text,
    coalesce(pm.posts_count, 0)::bigint,
    coalesce(pm.score, 0)::numeric,
    now()
  from selected s
  left join post_metrics pm on pm.model_id = s.id
  order by s.slot asc;
end;
$$;

revoke all on function public.refresh_daily_comparison_cache(date) from public;
grant execute on function public.refresh_daily_comparison_cache(date)
to service_role;

create or replace function public.get_daily_comparison(
  p_date date default current_date
)
returns table (
  date_key text,
  slot integer,
  model_id uuid,
  brand text,
  model text,
  posts_count bigint,
  score numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*) <> 2
    from public.daily_comparison_cache cache
    where cache.date_key = p_date
      and exists (
        select 1
        from public.vehicle_specs vs
        where vs.model_id = cache.model_id
      )
  ) then
    perform public.refresh_daily_comparison_cache(p_date);
  end if;

  return query
  select
    cache.date_key::text,
    cache.slot,
    cache.model_id,
    cache.brand,
    cache.model,
    cache.posts_count,
    cache.score
  from public.daily_comparison_cache cache
  where cache.date_key = p_date
  order by cache.slot asc;
end;
$$;

grant execute on function public.get_daily_comparison(date)
to anon, authenticated;

-- Refresh today's already-generated pair after applying this patch.
select public.refresh_daily_comparison_cache(current_date);
