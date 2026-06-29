-- Optional Supabase cron setup for email notification dispatch.
-- This is also a background scheduler for generate_due_notification_jobs(),
-- which creates due vehicle reminder, campaign, and weekly digest notifications.
-- Without this cron, those notification rows are only created by foreground app
-- triggers such as opening the notifications feed.
-- 1) Deploy the Edge Function:
--    supabase functions deploy dispatch-email-notifications --no-verify-jwt
-- 2) Set the Edge Function secrets:
--    supabase secrets set DISPATCH_EMAIL_SECRET=your-long-random-secret
--    supabase secrets set RESEND_API_KEY=re_your_key
--    supabase secrets set EMAIL_FROM="OtoRehber <bildirim@your-domain.com>"
--    supabase secrets set EMAIL_REPLY_TO=otorehberresmi@gmail.com
-- 3) Replace YOUR_DISPATCH_EMAIL_SECRET below with the same value.
-- 4) Run this in Supabase SQL Editor only after RESEND_API_KEY and EMAIL_FROM
--    are configured. Otherwise the scheduled job will run but email dispatch
--    will fail until those secrets exist.
--
-- SMS is intentionally not configured because OtoRehber does not collect phone
-- numbers. Keep provider API keys only in Supabase secrets, never in the app.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
begin
  perform cron.unschedule('dispatch-email-notifications-every-30-min');
exception
  when others then null;
end;
$$;

select cron.schedule(
  'dispatch-email-notifications-every-30-min',
  '*/30 * * * *',
  $$
  select
    net.http_post(
      url := 'https://nmixkbylzczztbylzyde.supabase.co/functions/v1/dispatch-email-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', 'YOUR_DISPATCH_EMAIL_SECRET'
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);
