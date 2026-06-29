import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.1";

type AuthedRequest = {
  userId: string;
  serviceClient: ReturnType<typeof createClient>;
  body: Record<string, unknown>;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const parseBody = async (req: Request) => {
  if (req.method === "GET") return {};
  const text = await req.text();
  if (!text) return {};

  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    throw new Error("Geçersiz JSON gövdesi.");
  }
};

const asString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const asStringOrNull = (value: unknown) => {
  const normalized = asString(value);
  return normalized || null;
};

const asBoolean = (value: unknown) => value === true;

const requireAuth = async (req: Request): Promise<AuthedRequest> => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase function ortam değişkenleri eksik.");
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    const error = new Error("Oturum bulunamadı.");
    error.name = "Unauthorized";
    throw error;
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const {
    data: { user },
    error,
  } = await serviceClient.auth.getUser(token);

  if (error || !user) {
    const authError = new Error("Oturum doğrulanamadı.");
    authError.name = "Unauthorized";
    throw authError;
  }

  return {
    userId: user.id,
    serviceClient,
    body: await parseBody(req),
  };
};

const registerPushToken = async ({
  userId,
  serviceClient,
  body,
}: AuthedRequest) => {
  const expoPushToken = asString(body.expo_push_token);
  const platform = asString(body.platform) || "unknown";

  if (!expoPushToken) {
    return json({ error: "Expo push token eksik." }, 400);
  }

  const displayName =
    asStringOrNull(body.display_name) ||
    asStringOrNull(body.full_name) ||
    "Sürücü";
  const avatarUrl = asStringOrNull(body.avatar_url);

  const { error: profileError } = await serviceClient.from("profiles").upsert({
    id: userId,
    display_name: displayName,
    full_name: displayName,
    avatar_url: avatarUrl,
  });

  if (profileError) return json({ error: profileError.message }, 500);

  const { error } = await serviceClient.from("push_tokens").upsert(
    {
      user_id: userId,
      expo_push_token: expoPushToken,
      platform,
      enabled: true,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "expo_push_token" },
  );

  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
};

const saveLegalConsents = async ({
  userId,
  serviceClient,
  body,
}: AuthedRequest) => {
  const documentVersion = asString(body.document_version);
  const acceptedAt = asString(body.accepted_at) || new Date().toISOString();
  const marketingConsentAccepted = asBoolean(body.marketing_consent_accepted);

  if (!documentVersion) {
    return json({ error: "Hukuki belge versiyonu eksik." }, 400);
  }

  const rows = ["terms", "kvkk", "privacy"].map((documentType) => ({
    user_id: userId,
    document_type: documentType,
    document_version: documentVersion,
    accepted_at: acceptedAt,
    source: "registration",
  }));

  const { error } = await serviceClient
    .from("legal_consents")
    .upsert(rows, { onConflict: "user_id,document_type,document_version" });

  if (error) return json({ error: error.message }, 500);

  let marketingConsentSaved = false;
  let marketingConsentError: string | null = null;

  if (marketingConsentAccepted) {
    const { error: optionalConsentError } = await serviceClient
      .from("legal_consents")
      .upsert(
        {
          user_id: userId,
          document_type: "marketing_consent",
          document_version: documentVersion,
          accepted_at: acceptedAt,
          source: "registration",
          metadata: { optional: true },
        },
        { onConflict: "user_id,document_type,document_version" },
      );

    marketingConsentSaved = !optionalConsentError;
    marketingConsentError = optionalConsentError?.message || null;
  }

  return json({
    ok: true,
    marketingConsentAccepted,
    marketingConsentSaved,
    marketingConsentError,
  });
};

const createPrivateSignedUrl = async ({
  userId,
  serviceClient,
  body,
}: AuthedRequest) => {
  const rawUri = asString(body.uri);
  const bucket = asString(body.bucket);
  const path = asString(body.path);
  const expiresInInput = Number(body.expires_in || 60 * 30);
  const expiresIn = Number.isFinite(expiresInInput)
    ? Math.max(60, Math.min(Math.floor(expiresInInput), 60 * 60))
    : 60 * 30;

  let resolvedBucket = bucket;
  let resolvedPath = path;

  if (rawUri.startsWith("private://")) {
    const withoutScheme = rawUri.replace("private://", "");
    const [uriBucket, ...pathParts] = withoutScheme.split("/");
    resolvedBucket = uriBucket;
    resolvedPath = pathParts.join("/");
  }

  if (!resolvedBucket || !resolvedPath) {
    return json({ error: "Dosya yolu eksik." }, 400);
  }

  if (resolvedBucket !== "private-user-images") {
    return json({ error: "Bu bucket için imzalı URL üretilemez." }, 403);
  }

  if (!resolvedPath.startsWith(`${userId}/`)) {
    return json({ error: "Bu dosyaya erişim yetkin yok." }, 403);
  }

  const { data, error } = await serviceClient.storage
    .from(resolvedBucket)
    .createSignedUrl(resolvedPath, expiresIn);

  if (error) return json({ error: error.message }, 500);
  return json({ signedUrl: data.signedUrl });
};

const removeUserStoragePrefix = async (
  serviceClient: ReturnType<typeof createClient>,
  bucket: string,
  prefix: string,
) => {
  const { data } = await serviceClient.storage.from(bucket).list(prefix, {
    limit: 1000,
  });

  const paths = (data || [])
    .filter((item) => item.name)
    .map((item) => `${prefix}/${item.name}`);

  if (paths.length > 0) {
    await serviceClient.storage.from(bucket).remove(paths);
  }
};

const deleteAccount = async ({ userId, serviceClient }: AuthedRequest) => {
  await Promise.allSettled([
    removeUserStoragePrefix(serviceClient, "user-uploads", userId),
    removeUserStoragePrefix(serviceClient, "content-images", userId),
    removeUserStoragePrefix(serviceClient, "private-user-images", userId),
  ]);

  const { error: profileError } = await serviceClient
    .from("profiles")
    .delete()
    .eq("id", userId);

  if (profileError) return json({ error: profileError.message }, 500);

  const { error: authError } = await serviceClient.auth.admin.deleteUser(userId);
  if (authError) return json({ error: authError.message }, 500);

  return json({ ok: true });
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const url = new URL(req.url);
    const route = url.pathname
      .replace(/^\/?otorehber-api\/?/, "")
      .replace(/^\/+|\/+$/g, "");
    const authedRequest = await requireAuth(req);

    if (route === "push-tokens/register") {
      return await registerPushToken(authedRequest);
    }

    if (route === "legal-consents/register") {
      return await saveLegalConsents(authedRequest);
    }

    if (route === "storage/private-signed-url") {
      return await createPrivateSignedUrl(authedRequest);
    }

    if (route === "account/delete") {
      return await deleteAccount(authedRequest);
    }

    return json({ error: "Endpoint bulunamadı." }, 404);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu.";
    const status = error instanceof Error && error.name === "Unauthorized"
      ? 401
      : 500;
    return json({ error: message }, status);
  }
});
