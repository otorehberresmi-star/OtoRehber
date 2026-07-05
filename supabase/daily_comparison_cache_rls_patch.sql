-- Fix Supabase advisor warning: rls_disabled_in_public.
-- daily_comparison_cache is an internal cache populated/read through
-- security-definer RPC functions, so clients should not access the table
-- directly through PostgREST.

alter table public.daily_comparison_cache enable row level security;

revoke all on table public.daily_comparison_cache from anon;
revoke all on table public.daily_comparison_cache from authenticated;

revoke all on function public.refresh_daily_comparison_cache(date) from public;
grant execute on function public.refresh_daily_comparison_cache(date)
to postgres, service_role;

grant execute on function public.get_daily_comparison(date)
to anon, authenticated;

notify pgrst, 'reload schema';
