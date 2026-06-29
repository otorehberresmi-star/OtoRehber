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

type PushTokenRow = {
  user_id: string;
  expo_push_token: string;
};

type NotificationPreferenceRow = {
  user_id: string;
  push_enabled: boolean | null;
};

type PreparedPushMessage = {
  notificationId: string;
  payload: {
    to: string;
    title: string;
    body: string;
    sound: "default";
    data: Record<string, unknown>;
  };
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

const chunk = <T>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const isExpoPushToken = (token: string) =>
  token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[");

const normalizeBatchSize = (value?: string | null) => {
  const parsed = Number(value || 500);
  if (!Number.isFinite(parsed)) return 500;
  return Math.max(1, Math.min(Math.floor(parsed), 1000));
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
  const expoAccessToken = Deno.env.get("EXPO_ACCESS_TOKEN");
  const dispatchSecret = Deno.env.get("DISPATCH_PUSH_SECRET");
  const pushBatchSize = normalizeBatchSize(Deno.env.get("PUSH_BATCH_SIZE"));

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Supabase function environment is missing." }, 500);
  }

  if (!dispatchSecret) {
    return json({ error: "DISPATCH_PUSH_SECRET is missing." }, 500);
  }

  if (req.headers.get("x-cron-secret") !== dispatchSecret) {
    return json({ error: "Unauthorized cron request." }, 401);
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
    .is("push_sent_at", null)
    .order("created_at", { ascending: true })
    .limit(pushBatchSize);

  if (notificationsError) {
    return json({ error: notificationsError.message }, 500);
  }

  const loadedNotifications = (notifications || []) as NotificationRow[];
  const loadedUserIds = Array.from(
    new Set(loadedNotifications.map((item) => item.user_id).filter(Boolean)),
  );

  if (loadedNotifications.length === 0 || loadedUserIds.length === 0) {
    return json({ generatedCount, sent: 0, failed: 0 });
  }

  const { data: preferences, error: preferencesError } = await supabase
    .from("notification_preferences")
    .select("user_id, push_enabled")
    .in("user_id", loadedUserIds);

  if (preferencesError) {
    return json({ error: preferencesError.message }, 500);
  }

  const disabledPushUsers = new Set(
    ((preferences || []) as NotificationPreferenceRow[])
      .filter((item) => item.push_enabled === false)
      .map((item) => item.user_id),
  );
  const pendingNotifications = loadedNotifications.filter(
    (item) => !disabledPushUsers.has(item.user_id),
  );
  const disabledNotificationIds = loadedNotifications
    .filter((item) => disabledPushUsers.has(item.user_id))
    .map((item) => item.id);

  if (disabledNotificationIds.length > 0) {
    await supabase
      .from("notifications")
      .update({
        push_sent_at: new Date().toISOString(),
        push_error: "Push disabled by user preference.",
      })
      .in("id", disabledNotificationIds);
  }
  const userIds = Array.from(
    new Set(pendingNotifications.map((item) => item.user_id).filter(Boolean)),
  );

  if (pendingNotifications.length === 0 || userIds.length === 0) {
    return json({ generatedCount, sent: 0, failed: 0, skipped: loadedNotifications.length });
  }

  const { data: tokens, error: tokensError } = await supabase
    .from("push_tokens")
    .select("user_id, expo_push_token")
    .in("user_id", userIds)
    .eq("enabled", true);

  if (tokensError) {
    return json({ error: tokensError.message }, 500);
  }

  const tokensByUser = new Map<string, string[]>();
  ((tokens || []) as PushTokenRow[]).forEach((item) => {
    if (!item.expo_push_token || !isExpoPushToken(item.expo_push_token)) return;
    const existing = tokensByUser.get(item.user_id) || [];
    tokensByUser.set(item.user_id, [...existing, item.expo_push_token]);
  });

  const notificationIdsWithoutTokens: string[] = [];
  const messages = pendingNotifications.flatMap<PreparedPushMessage>((item) => {
    const userTokens = tokensByUser.get(item.user_id) || [];
    if (userTokens.length === 0) {
      notificationIdsWithoutTokens.push(item.id);
      return [];
    }

    return userTokens.map((to) => ({
      notificationId: item.id,
      payload: {
        to,
        title: item.title,
        body: item.quote ? `${item.message}\n${item.quote}` : item.message,
        sound: "default",
        data: {
          notificationId: item.id,
          type: item.type,
          postId: item.post_id,
          reviewId: item.review_id,
          metadata: item.metadata || {},
        },
      },
    }));
  });

  if (notificationIdsWithoutTokens.length > 0) {
    await supabase
      .from("notifications")
      .update({
        push_sent_at: new Date().toISOString(),
        push_error: "No active Expo push token for user.",
      })
      .in("id", notificationIdsWithoutTokens);
  }

  if (messages.length === 0) {
    return json({ generatedCount, sent: 0, failed: pendingNotifications.length });
  }

  let sent = 0;
  let failed = 0;
  let lastError: string | null = null;
  const sentNotificationIds = new Set<string>();
  const failedNotificationErrors = new Map<string, string>();
  const ticketIdsByNotification = new Map<string, string[]>();

  for (const messageChunk of chunk(messages, 100)) {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(expoAccessToken ? { Authorization: `Bearer ${expoAccessToken}` } : {}),
      },
      body: JSON.stringify(messageChunk.map((item) => item.payload)),
    });

    const responseBody = await response.json().catch(() => ({}));

    if (!response.ok) {
      failed += messageChunk.length;
      lastError =
        responseBody?.errors?.[0]?.message ||
        responseBody?.message ||
        "Expo push request failed.";
      messageChunk.forEach((item) =>
        failedNotificationErrors.set(item.notificationId, lastError || "Expo push request failed."),
      );
      continue;
    }

    const tickets = Array.isArray(responseBody?.data) ? responseBody.data : [];
    tickets.forEach((ticket: any, index: number) => {
      const notificationId = messageChunk[index]?.notificationId;
      if (ticket?.status === "ok") {
        sent += 1;
        if (notificationId) sentNotificationIds.add(notificationId);
        if (notificationId && ticket.id) {
          const existing = ticketIdsByNotification.get(notificationId) || [];
          ticketIdsByNotification.set(notificationId, [...existing, ticket.id]);
        }
      } else {
        failed += 1;
        lastError = ticket?.message || "Expo push ticket failed.";
        if (notificationId) {
          failedNotificationErrors.set(notificationId, lastError);
        }
      }
    });
  }

  const sentIds = Array.from(sentNotificationIds);
  if (sentIds.length > 0) {
    for (const sentId of sentIds) {
      await supabase
        .from("notifications")
        .update({
          push_sent_at: new Date().toISOString(),
          push_error: null,
          push_ticket_ids: ticketIdsByNotification.get(sentId) || [],
        })
        .eq("id", sentId);
    }
  }

  const failedIds = Array.from(failedNotificationErrors.keys()).filter(
    (id) => !sentNotificationIds.has(id),
  );
  if (failedIds.length > 0) {
    for (const failedId of failedIds) {
      await supabase
        .from("notifications")
        .update({ push_error: failedNotificationErrors.get(failedId) || lastError })
        .eq("id", failedId);
    }
  }

  return json({ generatedCount, sent, failed, error: lastError });
});
