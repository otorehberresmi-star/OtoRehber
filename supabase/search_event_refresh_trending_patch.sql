-- Refresh discover trending cache after a real user search is recorded.
-- Run in Supabase Dashboard > SQL Editor.

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

  begin
    perform public.refresh_discover_home_cache();
  exception
    when undefined_function then
      null;
    when others then
      raise notice 'discover cache refresh skipped: %', sqlerrm;
  end;

  return true;
end;
$$;

grant execute on function public.record_vehicle_search_event(text, uuid, uuid)
to authenticated;
