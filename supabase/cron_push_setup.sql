-- Optional Supabase cron setup for native push dispatch.
-- This is also a background scheduler for generate_due_notification_jobs(),
-- which creates due vehicle reminder, campaign, and weekly digest notifications.
-- Without this cron, those notification rows are only created by foreground app
-- triggers such as opening the notifications feed.
-- 1) Deploy the Edge Function:
--    supabase functions deploy dispatch-push-notifications --no-verify-jwt
-- 2) Set the Edge Function secret:
--    supabase secrets set DISPATCH_PUSH_SECRET=your-long-random-secret
-- 3) Replace YOUR_DISPATCH_PUSH_SECRET below with the same value.
-- 4) Run this in Supabase SQL Editor.
--
-- This cron uses a limited dispatch secret instead of the Supabase service-role
-- key. Never ship this secret in the mobile app.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
begin
  perform cron.unschedule('dispatch-push-notifications-every-15-min');
  perform cron.unschedule('prune-vehicle-search-events-daily');
  perform cron.unschedule('refresh-discover-trending-cache-hourly');
  perform cron.unschedule('refresh-daily-comparison-cache');
exception
  when others then null;
end;
$$;

select cron.schedule(
  'dispatch-push-notifications-every-15-min',
  '*/15 * * * *',
  $$
  select
    net.http_post(
      url := 'https://nmixkbylzczztbylzyde.supabase.co/functions/v1/dispatch-push-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', 'YOUR_DISPATCH_PUSH_SECRET'
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

select cron.schedule(
  'prune-vehicle-search-events-daily',
  '17 3 * * *',
  $$
  select public.prune_vehicle_search_events(180);
  $$
);

select cron.schedule(
  'refresh-discover-trending-cache-hourly',
  '7 * * * *',
  $$
  select public.refresh_discover_home_cache();
  $$
);

select cron.schedule(
  'refresh-daily-comparison-cache',
  '5 0 * * *',
  $$
  select public.refresh_daily_comparison_cache(current_date);
  $$
);
