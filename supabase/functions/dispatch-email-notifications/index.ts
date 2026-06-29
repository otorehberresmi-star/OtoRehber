import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.1";

type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  quote?: string | null;
  post_id?: string | null;
  review_id?: string | null;
  metadata?: Record<string, unknown> | null;
};

type NotificationPreferenceRow = {
  user_id: string;
  email_enabled: boolean | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const normalizeBatchSize = (value?: string | null) => {
  const parsed = Number(value || 100);
  if (!Number.isFinite(parsed)) return 100;
  return Math.max(1, Math.min(Math.floor(parsed), 500));
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const buildEmailHtml = (notification: NotificationRow) => {
  const quote = notification.quote
    ? `<p style="margin:16px 0 0;padding:12px 14px;border-left:3px solid #f97316;background:#fff7ed;color:#7c2d12;">${escapeHtml(notification.quote)}</p>`
    : "";

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827;">
      <h1 style="font-size:20px;margin:0 0 12px;">${escapeHtml(notification.title)}</h1>
      <p style="margin:0;color:#374151;">${escapeHtml(notification.message)}</p>
      ${quote}
      <p style="margin:24px 0 0;color:#6b7280;font-size:12px;">
        Bu e-posta OtoRehber bildirim tercihlerine göre gönderildi.
      </p>
    </div>
  `;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const dispatchSecret = Deno.env.get("DISPATCH_EMAIL_SECRET");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const emailFrom = Deno.env.get("EMAIL_FROM");
  const emailReplyTo = Deno.env.get("EMAIL_REPLY_TO");
  const emailBatchSize = normalizeBatchSize(Deno.env.get("EMAIL_BATCH_SIZE"));

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Supabase function environment is missing." }, 500);
  }

  if (!dispatchSecret) {
    return json({ error: "DISPATCH_EMAIL_SECRET is missing." }, 500);
  }

  if (req.headers.get("x-cron-secret") !== dispatchSecret) {
    return json({ error: "Unauthorized cron request." }, 401);
  }

  if (!resendApiKey || !emailFrom) {
    return json({ error: "RESEND_API_KEY or EMAIL_FROM is missing." }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: generatedCount, error: generationError } = await supabase.rpc(
    "generate_due_notification_jobs",
  );

  if (generationError) {
    return json({ error: generationError.message }, 500);
  }

  const { data: notifications, error: notificationsError } = await supabase
    .from("notifications")
    .select("id, user_id, type, title, message, quote, post_id, review_id, metadata")
    .is("email_sent_at", null)
    .order("created_at", { ascending: true })
    .limit(emailBatchSize);

  if (notificationsError) {
    return json({ error: notificationsError.message }, 500);
  }

  const loadedNotifications = (notifications || []) as NotificationRow[];
  const userIds = Array.from(
    new Set(loadedNotifications.map((item) => item.user_id).filter(Boolean)),
  );

  if (loadedNotifications.length === 0 || userIds.length === 0) {
    return json({ generatedCount, sent: 0, failed: 0 });
  }

  const { data: preferences, error: preferencesError } = await supabase
    .from("notification_preferences")
    .select("user_id, email_enabled")
    .in("user_id", userIds);

  if (preferencesError) {
    return json({ error: preferencesError.message }, 500);
  }

  const emailEnabledUsers = new Set(
    ((preferences || []) as NotificationPreferenceRow[])
      .filter((item) => item.email_enabled === true)
      .map((item) => item.user_id),
  );
  const disabledNotificationIds = loadedNotifications
    .filter((item) => !emailEnabledUsers.has(item.user_id))
    .map((item) => item.id);
  const pendingNotifications = loadedNotifications.filter((item) =>
    emailEnabledUsers.has(item.user_id),
  );

  if (disabledNotificationIds.length > 0) {
    await supabase
      .from("notifications")
      .update({
        email_sent_at: new Date().toISOString(),
        email_error: "Email disabled by user preference.",
      })
      .in("id", disabledNotificationIds);
  }

  let sent = 0;
  let failed = 0;
  let lastError: string | null = null;

  for (const notification of pendingNotifications) {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.admin.getUserById(notification.user_id);

    if (userError || !user?.email) {
      failed += 1;
      lastError = userError?.message || "User email address is missing.";
      await supabase
        .from("notifications")
        .update({ email_error: lastError })
        .eq("id", notification.id);
      continue;
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [user.email],
        ...(emailReplyTo ? { reply_to: emailReplyTo } : {}),
        subject: notification.title,
        html: buildEmailHtml(notification),
        text: [notification.message, notification.quote].filter(Boolean).join("\n\n"),
        tags: [
          { name: "notification_id", value: notification.id },
          { name: "notification_type", value: notification.type },
        ],
      }),
    });

    const responseBody = await response.json().catch(() => ({}));

    if (!response.ok) {
      failed += 1;
      lastError =
        responseBody?.message ||
        responseBody?.error ||
        "Resend email request failed.";
      await supabase
        .from("notifications")
        .update({ email_error: lastError })
        .eq("id", notification.id);
      continue;
    }

    sent += 1;
    await supabase
      .from("notifications")
      .update({
        email_sent_at: new Date().toISOString(),
        email_error: null,
        email_provider_id: responseBody?.id || null,
      })
      .eq("id", notification.id);
  }

  return json({ generatedCount, sent, failed, error: lastError });
});
