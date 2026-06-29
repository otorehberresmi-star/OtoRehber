-- Lightweight search analytics for ranking "En Çok İncelenenler".

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

alter table public.vehicle_search_events enable row level security;

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
