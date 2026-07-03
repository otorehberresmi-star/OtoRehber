import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import "react-native-reanimated";

import { ConnectionStatusBanner } from "../components/ConnectionStatusBanner";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { ReviewProvider } from "../contexts/ReviewContext";
import { AppThemeProvider, useAppTheme } from "../contexts/ThemeContext";
import { supabase } from "../supabaseClient";
import {
  initErrorReporting,
  reportError,
  withErrorReporting,
} from "../utils/errorReporting";
import { configureProductionConsole } from "../utils/productionConsole";

initErrorReporting();
configureProductionConsole();

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary
} from "expo-router";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync().catch(() => {});

function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) {
      reportError(error, { area: "font-loading" });
      throw error;
    }
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  return (
    <AppThemeProvider>
      <RootLayoutProviders />
    </AppThemeProvider>
  );
}

function RootLayoutProviders() {
  const { effectiveTheme, palette } = useAppTheme();
  const navigationTheme = {
    ...(effectiveTheme === "dark" ? DarkTheme : DefaultTheme),
    colors: {
      ...(effectiveTheme === "dark" ? DarkTheme.colors : DefaultTheme.colors),
      background: palette.background,
      card: palette.card,
      border: palette.border,
      text: palette.text,
      primary: "#f97316",
    },
  };

  return (
    <AuthProvider>
      <ProtectedApplication navigationTheme={navigationTheme} />
    </AuthProvider>
  );
}

function ProtectedApplication({ navigationTheme }: { navigationTheme: any }) {
  const {
    isAuthReady,
    user,
    isBiometricLocked,
    unlockWithBiometrics,
    logout,
  } = useAuth();
  const { palette } = useAppTheme();
  const pathname = usePathname();
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaError, setMfaError] = useState("");
  const [isCheckingMfa, setIsCheckingMfa] = useState(false);
  const [isVerifyingMfa, setIsVerifyingMfa] = useState(false);

  useEffect(() => {
    let active = true;

    const checkMfa = async () => {
      if (!user?.id) {
        setMfaFactorId(null);
        return;
      }

      setIsCheckingMfa(true);
      try {
        const { data: assurance, error: assuranceError } =
          await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (assuranceError) throw assuranceError;

        if (
          assurance?.nextLevel === "aal2" &&
          assurance.currentLevel !== "aal2"
        ) {
          const { data: factors, error: factorsError } =
            await supabase.auth.mfa.listFactors();
          if (factorsError) throw factorsError;
          if (active) setMfaFactorId(factors?.totp?.[0]?.id || null);
        } else if (active) {
          setMfaFactorId(null);
        }
      } catch (error: any) {
        if (active) setMfaError(error?.message || "2FA durumu doğrulanamadı.");
      } finally {
        if (active) setIsCheckingMfa(false);
      }
    };

    checkMfa();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const verifyMfa = async () => {
    if (!mfaFactorId || mfaCode.length !== 6) {
      setMfaError("Authenticator uygulamasındaki 6 haneli kodu girin.");
      return;
    }

    setIsVerifyingMfa(true);
    setMfaError("");
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: mfaFactorId,
        code: mfaCode,
      });
      if (error) throw error;
      setMfaFactorId(null);
      setMfaCode("");
    } catch (error: any) {
      setMfaError(error?.message || "Kod doğrulanamadı.");
    } finally {
      setIsVerifyingMfa(false);
    }
  };

  const isLoginRoute = pathname.startsWith("/profile-routes/login");

  if (!isAuthReady || (isCheckingMfa && !isLoginRoute)) {
    return (
      <View style={[styles.lockScreen, { backgroundColor: palette.background }]}>
        <ActivityIndicator color="#f97316" />
      </View>
    );
  }

  if (
    mfaFactorId &&
    !isLoginRoute
  ) {
    return (
      <View style={[styles.lockScreen, { backgroundColor: palette.background }]}>
        <FontAwesome name="shield" size={38} color="#f97316" />
        <Text style={[styles.lockTitle, { color: palette.text }]}>
          İki Adımlı Doğrulama
        </Text>
        <Text style={[styles.lockDescription, { color: palette.muted }]}>
          Authenticator uygulamanızdaki güncel kodu girin.
        </Text>
        <TextInput
          style={[
            styles.mfaInput,
            {
              color: palette.text,
              backgroundColor: palette.card,
              borderColor: palette.border,
            },
          ]}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          placeholder="000000"
          placeholderTextColor={palette.muted}
          value={mfaCode}
          onChangeText={(value) => setMfaCode(value.replace(/\D/g, ""))}
        />
        {mfaError ? <Text style={styles.mfaError}>{mfaError}</Text> : null}
        <TouchableOpacity
          style={styles.unlockButton}
          onPress={verifyMfa}
          disabled={isVerifyingMfa}
        >
          {isVerifyingMfa ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.unlockButtonText}>Doğrula</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={logout} style={styles.logoutButton}>
          <Text style={[styles.logoutText, { color: palette.muted }]}>
            Oturumu kapat
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isBiometricLocked) {
    return (
      <View style={[styles.lockScreen, { backgroundColor: palette.background }]}>
        <FontAwesome name="lock" size={38} color="#f97316" />
        <Text style={[styles.lockTitle, { color: palette.text }]}>
          OtoRehber Kilitli
        </Text>
        <Text style={[styles.lockDescription, { color: palette.muted }]}>
          Devam etmek için cihazınızla kimliğinizi doğrulayın.
        </Text>
        <TouchableOpacity
          style={styles.unlockButton}
          onPress={unlockWithBiometrics}
        >
          <Text style={styles.unlockButtonText}>Kilidi Aç</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={logout} style={styles.logoutButton}>
          <Text style={[styles.logoutText, { color: palette.muted }]}>
            Başka hesapla giriş yap
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ReviewProvider>
      <ThemeProvider value={navigationTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="post/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="community/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="review/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="user/[id]" options={{ headerShown: false }} />
          <Stack.Screen
            name="comparison/[id]"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="admin/moderation"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="profile-routes/login"
            options={{ presentation: "modal", headerShown: false }}
          />
          <Stack.Screen
            name="profile-routes/reset-password"
            options={{ presentation: "modal", headerShown: false }}
          />
          <Stack.Screen
            name="legal/[document]"
            options={{ presentation: "modal", headerShown: false }}
          />
          <Stack.Screen
            name="profile-routes/following"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="profile-routes/saved-cars"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="profile-routes/my-reviews"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="profile-routes/security"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="profile-routes/notifications"
            options={{ headerShown: false }}
          />
        </Stack>
        <ConnectionStatusBanner />
      </ThemeProvider>
    </ReviewProvider>
  );
}

export default withErrorReporting(RootLayout);

const styles = StyleSheet.create({
  lockScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  lockTitle: { fontSize: 24, fontWeight: "900", marginTop: 20 },
  lockDescription: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  unlockButton: {
    minWidth: 180,
    alignItems: "center",
    backgroundColor: "#f97316",
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  unlockButtonText: { color: "#ffffff", fontSize: 15, fontWeight: "800" },
  logoutButton: { padding: 16, marginTop: 4 },
  logoutText: { fontSize: 13, fontWeight: "700" },
  mfaInput: {
    width: 220,
    height: 58,
    borderRadius: 14,
    borderWidth: 1,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 9,
    marginBottom: 12,
  },
  mfaError: {
    color: "#ef4444",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 12,
  },
});
