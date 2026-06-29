import { supabase } from "../supabaseClient";

type SecureApiOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");
const trimSlashes = (value: string) => value.replace(/^\/+|\/+$/g, "");

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

const getSecureApiBaseUrl = () => {
  if (configuredApiBaseUrl) return trimTrailingSlash(configuredApiBaseUrl);

  if (!supabaseUrl) {
    throw new Error(
      "Güvenli API adresi bulunamadı. EXPO_PUBLIC_API_BASE_URL veya EXPO_PUBLIC_SUPABASE_URL tanımlanmalı.",
    );
  }

  return `${trimTrailingSlash(supabaseUrl)}/functions/v1/otorehber-api`;
};

export async function secureApi<TResponse>(
  path: string,
  options: SecureApiOptions = {},
): Promise<TResponse> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) throw sessionError;
  if (!session?.access_token) {
    throw new Error("Bu işlem için giriş yapmalısın.");
  }

  const response = await fetch(
    `${getSecureApiBaseUrl()}/${trimSlashes(path)}`,
    {
      method: options.method || "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    },
  );

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(
      payload?.error ||
        payload?.message ||
        `Güvenli API isteği başarısız oldu. (${response.status})`,
    );
  }

  return payload as TResponse;
}
