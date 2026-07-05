import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { AppState } from "react-native";
import { supabase } from "../supabaseClient";
import { createAuthRedirectUrl } from "../utils/authRedirect";
import {
  authenticateWithBiometrics,
  getBiometricAvailability,
  getBiometricPreference,
  saveBiometricPreference,
} from "../utils/biometricSecurity";
import { validateCleanContent } from "../utils/contentModeration";
import { registerPushTokenForUser } from "../utils/pushNotifications";
import { uploadPublicFile } from "../utils/storageUpload";

WebBrowser.maybeCompleteAuthSession();

interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  providers: string[];
  phoneNumber?: string | null;
}

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  isAuthReady: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  linkGoogleAccount: () => Promise<boolean>;
  loginWithApple: () => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateAvatar: (
    uri: string,
    base64?: string | null,
    mimeType?: string | null,
  ) => Promise<void>;
  garageCarCount: number;
  setGarageCarCount: (count: number) => void;
  biometricAvailable: boolean;
  biometricEnabled: boolean;
  isBiometricLocked: boolean;
  setBiometricEnabled: (enabled: boolean) => Promise<boolean>;
  unlockWithBiometrics: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const userFromAuthMetadata = (sessionUser: any): User | null => {
  if (!sessionUser) return null;

  const name =
    sessionUser.user_metadata?.display_name ||
    sessionUser.user_metadata?.full_name ||
    sessionUser.email?.split("@")[0] ||
    "Sürücü";

  return {
    id: sessionUser.id,
    name,
    email: sessionUser.email || "",
    avatar: getMetadataAvatar(sessionUser),
    providers: normalizeProviders(sessionUser),
    phoneNumber: null,
  };
};

const normalizeProviders = (sessionUser: any): string[] => {
  const providers = sessionUser?.app_metadata?.providers;
  const primaryProvider = sessionUser?.app_metadata?.provider;
  const allProviders = [
    ...(Array.isArray(providers) ? providers : []),
    primaryProvider,
  ].filter(Boolean);

  return Array.from(new Set(allProviders.map((provider) => String(provider))));
};

const getMetadataAvatar = (sessionUser: any) =>
  sessionUser?.user_metadata?.avatar_url ||
  sessionUser?.user_metadata?.picture ||
  sessionUser?.user_metadata?.photo_url ||
  sessionUser?.user_metadata?.photoURL ||
  "";

const extractAuthParams = (url: string) => {
  const [, hash = ""] = url.split("#");
  const query = url.includes("?") ? url.split("?")[1]?.split("#")[0] || "" : "";
  const params = new URLSearchParams(hash || query);

  return {
    code: params.get("code"),
    accessToken: params.get("access_token"),
    refreshToken: params.get("refresh_token"),
    error: params.get("error_description") || params.get("error"),
  };
};

const redirectTo = () =>
  createAuthRedirectUrl(Linking.createURL, "auth/callback");

const completeOAuthSession = async (url?: string | null) => {
  if (!url) return false;

  const { code, accessToken, refreshToken, error } = extractAuthParams(url);
  if (error) throw new Error(error);

  if (code) {
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
    return true;
  }

  if (accessToken && refreshToken) {
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (sessionError) throw sessionError;
    return true;
  }

  return false;
};

const ensureProfileForSessionUser = async (sessionUser: any) => {
  if (!sessionUser?.id) return;

  const fallbackName =
    sessionUser.user_metadata?.display_name ||
    sessionUser.user_metadata?.full_name ||
    sessionUser.email?.split("@")[0] ||
    "Sürücü";

  const profilePayload: Record<string, string> = {
    id: sessionUser.id,
    display_name: fallbackName,
    full_name: fallbackName,
  };
  const metadataAvatar = getMetadataAvatar(sessionUser);

  // Auth metadata'da fotoğraf yoksa mevcut profil fotoğrafını null ile ezme.
  if (metadataAvatar) profilePayload.avatar_url = metadataAvatar;

  await supabase.from("profiles").upsert(profilePayload);
};

const findLegacyAvatar = async (userId: string) => {
  const sources = [
    "reviews",
    "posts",
    "comments",
  ];

  for (const table of sources) {
    const { data, error } = await supabase
      .from(table)
      .select("avatar,created_at")
      .eq("user_id", userId)
      .not("avatar", "is", null)
      .neq("avatar", "")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data?.avatar) return String(data.avatar);
  }

  return "";
};

const userFromSession = async (sessionUser: any): Promise<User | null> => {
  if (!sessionUser) return null;

  try {
    await ensureProfileForSessionUser(sessionUser);
  } catch (error) {
    console.warn("Profil kaydı doğrulanamadı.", error);
  }

  const fallbackName =
    sessionUser.user_metadata?.display_name ||
    sessionUser.user_metadata?.full_name ||
    sessionUser.email?.split("@")[0] ||
    "Sürücü";

  let profile: any = null;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("display_name, full_name, avatar_url, phone_number")
      .eq("id", sessionUser.id)
      .maybeSingle();

    if (error && error.message.includes("phone_number")) {
      const { data: fallbackData } = await supabase
        .from("profiles")
        .select("display_name, full_name, avatar_url")
        .eq("id", sessionUser.id)
        .maybeSingle();
      profile = fallbackData;
    } else {
      profile = data;
    }
  } catch (error) {
    console.warn("Profil bilgisi alınamadı, auth metadata kullanılacak.", error);
  }

  const profileName = profile?.display_name || profile?.full_name;
  const name = profileName || fallbackName;

  let avatar = profile?.avatar_url || getMetadataAvatar(sessionUser);

  if (!avatar) {
    try {
      avatar = await findLegacyAvatar(sessionUser.id);
      if (avatar) {
        await supabase
          .from("profiles")
          .update({ avatar_url: avatar })
          .eq("id", sessionUser.id);
      }
    } catch (error) {
      console.warn("Eski profil fotoğrafı geri yüklenemedi.", error);
    }
  }

  return {
    id: sessionUser.id,
    name,
    email: sessionUser.email || "",
    avatar: avatar || "",
    providers: normalizeProviders(sessionUser),
    phoneNumber: profile?.phone_number || null,
  };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [garageCarCount, setGarageCarCount] = useState(0);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [isBiometricLocked, setIsBiometricLocked] = useState(false);
  const isAuthenticatingRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    const syncAutoRefresh = (state: string) => {
      if (state === "active") {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    };

    syncAutoRefresh(AppState.currentState);
    const subscription = AppState.addEventListener("change", syncAutoRefresh);

    return () => {
      subscription.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!isMounted) return;

      const nextUser = await userFromSession(session?.user);
      if (isMounted) setUser(nextUser);
      if (isMounted) setIsAuthReady(true);
    };

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(async () => {
        const nextUser = await userFromSession(session?.user);
        if (isMounted) {
          setUser(nextUser);
          setIsAuthReady(true);
        }
      }, 0);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    registerPushTokenForUser(user).catch((error) => {
      console.warn("Push bildirimi kaydı tamamlanamadı:", error);
    });
  }, [user?.id]);

  const unlockWithBiometrics = useCallback(async () => {
    if (!user?.id || !biometricEnabled || isAuthenticatingRef.current) {
      return !isBiometricLocked;
    }

    isAuthenticatingRef.current = true;
    try {
      const success = await authenticateWithBiometrics(
        "OtoRehber kilidini açın",
      );
      if (success) setIsBiometricLocked(false);
      return success;
    } finally {
      isAuthenticatingRef.current = false;
    }
  }, [biometricEnabled, isBiometricLocked, user?.id]);

  const setBiometricEnabled = useCallback(
    async (enabled: boolean) => {
      if (!user?.id) return false;

      const available = await getBiometricAvailability();
      setBiometricAvailable(available);
      if (!available) return false;

      const verified = await authenticateWithBiometrics(
        enabled
          ? "Biyometrik girişi etkinleştirin"
          : "Biyometrik girişi kapatın",
      );
      if (!verified) return false;

      await saveBiometricPreference(user.id, enabled);
      setBiometricEnabledState(enabled);
      setIsBiometricLocked(false);
      return true;
    },
    [user?.id],
  );

  useEffect(() => {
    let active = true;

    const loadBiometricState = async () => {
      if (!user?.id) {
        setBiometricAvailable(false);
        setBiometricEnabledState(false);
        setIsBiometricLocked(false);
        return;
      }

      try {
        const [available, enabled] = await Promise.all([
          getBiometricAvailability(),
          getBiometricPreference(user.id),
        ]);
        if (!active) return;

        setBiometricAvailable(available);
        setBiometricEnabledState(available && enabled);
        setIsBiometricLocked(available && enabled);
      } catch (error) {
        console.warn("Biyometrik güvenlik ayarı yüklenemedi:", error);
        if (!active) return;
        setBiometricAvailable(false);
        setBiometricEnabledState(false);
        setIsBiometricLocked(false);
      }
    };

    loadBiometricState();
    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (
      isBiometricLocked &&
      biometricEnabled &&
      AppState.currentState === "active"
    ) {
      unlockWithBiometrics();
    }
  }, [biometricEnabled, isBiometricLocked, unlockWithBiometrics]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const wasActive = appStateRef.current === "active";
      appStateRef.current = nextState;

      if (wasActive && nextState !== "active" && biometricEnabled && user?.id) {
        setIsBiometricLocked(true);
      } else if (
        nextState === "active" &&
        biometricEnabled &&
        isBiometricLocked
      ) {
        unlockWithBiometrics();
      }
    });

    return () => subscription.remove();
  }, [
    biometricEnabled,
    isBiometricLocked,
    unlockWithBiometrics,
    user?.id,
  ]);

  const login = async (email: string, password: string): Promise<boolean> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return false;

    setUser(await userFromSession(data.user));
    return true;
  };

  const loginWithGoogle = async (): Promise<boolean> => {
    const callbackUrl = redirectTo();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error || !data?.url) {
      console.warn("Google giriş başlatılamadı:", error);
      return false;
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, callbackUrl);
    if (result.type !== "success") return false;

    const completed = await completeOAuthSession(result.url);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    setUser(await userFromSession(session?.user));
    return completed;
  };

  const linkGoogleAccount = async (): Promise<boolean> => {
    const callbackUrl = redirectTo();
    const { data, error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: {
        redirectTo: callbackUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error || !data?.url) {
      console.warn("Google hesap bağlama başlatılamadı:", error);
      throw error || new Error("Google bağlantı adresi oluşturulamadı.");
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, callbackUrl);
    if (result.type !== "success") {
      throw new Error("Google bağlantı penceresi tamamlanmadan kapandı.");
    }

    const completed = await completeOAuthSession(result.url);
    const {
      data: { user: refreshedUser },
    } = await supabase.auth.getUser();
    const nextUser = await userFromSession(refreshedUser);
    setUser(nextUser);

    if (!completed && !nextUser?.providers.includes("google")) {
      throw new Error("Google bağlantısı doğrulanamadı.");
    }

    return nextUser?.providers.includes("google") ?? completed;
  };

  const loginWithApple = async (): Promise<boolean> => {
    console.warn("Apple login için Supabase OAuth deep link ayarı gerekiyor.");
    return false;
  };

  const register = async (
    name: string,
    email: string,
    password: string,
  ): Promise<boolean> => {
    const moderation = validateCleanContent([
      { label: "Ad Soyad", value: name },
    ]);
    if (!moderation.ok) return false;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: name.trim(),
          full_name: name.trim(),
        },
      },
    });
    if (error) return false;

    if (data.user?.id) {
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: data.user.id,
        display_name: name.trim(),
        full_name: name.trim(),
      });
      if (profileError) return false;
    }

    setUser(await userFromSession(data.user));
    return true;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsBiometricLocked(false);
  };

  const refreshUser = async () => {
    const {
      data: { user: refreshedUser },
    } = await supabase.auth.getUser();
    setUser(await userFromSession(refreshedUser));
  };

  const updateAvatar = async (
    uri: string,
    base64?: string | null,
    mimeType?: string | null,
  ) => {
    if (!user) return;

    const persistAvatar = async (avatarUrl: string) => {
      setUser({ ...user, avatar: avatarUrl });

      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        display_name: user.name,
        full_name: user.name,
        avatar_url: avatarUrl,
      });

      if (error) {
        setUser(user);
        throw error;
      }

      const { error: metadataError } = await supabase.auth.updateUser({
        data: { avatar_url: avatarUrl },
      });
      if (metadataError) {
        console.warn(
          "Profil fotoğrafı auth metadata'ya yazılamadı:",
          metadataError.message,
        );
      }

      const avatarSyncJobs = [
        supabase
          .from("posts")
          .update({ avatar: avatarUrl })
          .eq("user_id", user.id),
        supabase
          .from("reviews")
          .update({ avatar: avatarUrl })
          .eq("user_id", user.id),
        supabase
          .from("comments")
          .update({ avatar: avatarUrl })
          .eq("user_id", user.id),
        supabase
          .from("notifications")
          .update({ actor_avatar: avatarUrl })
          .eq("actor_id", user.id),
      ];

      const avatarSyncResults = await Promise.allSettled(avatarSyncJobs);
      avatarSyncResults.forEach((result) => {
        if (result.status === "fulfilled" && result.value.error) {
          console.warn(
            "Geçmiş avatar verisi güncellenemedi:",
            result.value.error.message,
          );
        } else if (result.status === "rejected") {
          console.warn("Geçmiş avatar verisi güncellenemedi:", result.reason);
        }
      });
    };

    try {
      const uploadedUri = await uploadPublicFile(
        uri,
        user.id,
        "avatars",
        base64,
        mimeType,
      );
      await persistAvatar(uploadedUri);
    } catch (error: any) {
      const canUseInlineFallback =
        base64 && error?.message?.includes("Bucket not found");

      if (!canUseInlineFallback) {
        throw error;
      }

      const cleanBase64 = base64.replace(/\s/g, "");
      const safeMimeType = mimeType?.startsWith("image/")
        ? mimeType
        : "image/jpeg";
      await persistAvatar(`data:${safeMimeType};base64,${cleanBase64}`);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        isAuthReady,
        login,
        loginWithGoogle,
        linkGoogleAccount,
        loginWithApple,
        register,
        logout,
        refreshUser,
        updateAvatar,
        garageCarCount,
        setGarageCarCount,
        biometricAvailable,
        biometricEnabled,
        isBiometricLocked,
        setBiometricEnabled,
        unlockWithBiometrics,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
