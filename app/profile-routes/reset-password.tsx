import Colors from "@/constants/Colors";
import { FontAwesome6 } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "../../contexts/ThemeContext";
import { supabase } from "../../supabaseClient";

const extractResetParams = (url: string) => {
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

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { palette } = useAppTheme();
  const [isPreparing, setIsPreparing] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    let active = true;

    const prepareRecoverySession = async () => {
      setIsPreparing(true);
      setErrorMsg(null);
      try {
        const initialUrl =
          Platform.OS === "web" && typeof window !== "undefined"
            ? window.location.href
            : await Linking.getInitialURL();
        const { code, accessToken, refreshToken, error } = extractResetParams(
          initialUrl || "",
        );

        if (error) throw new Error(error);

        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        } else if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session?.user) {
          throw new Error(
            "Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş.",
          );
        }

        if (active) setIsReady(true);
      } catch (error: any) {
        if (active) {
          setIsReady(false);
          setErrorMsg(
            error?.message ||
              "Şifre sıfırlama oturumu hazırlanırken hata oluştu.",
          );
        }
      } finally {
        if (active) setIsPreparing(false);
      }
    };

    prepareRecoverySession();
    return () => {
      active = false;
    };
  }, []);

  const handleUpdatePassword = async () => {
    setErrorMsg(null);

    if (password.length < 6) {
      setErrorMsg("Yeni şifreniz en az 6 karakter olmalıdır.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Şifreler eşleşmiyor, lütfen kontrol edin.");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      await supabase.auth.signOut();
      Alert.alert(
        "Şifre güncellendi",
        "Yeni şifrenizle tekrar giriş yapabilirsiniz.",
      );
      router.replace("/profile-routes/login" as any);
    } catch (error: any) {
      setErrorMsg(error?.message || "Şifre güncellenemedi.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <TouchableOpacity
            onPress={() => router.replace("/profile-routes/login" as any)}
            style={styles.closeBtn}
          >
            <FontAwesome6 name="xmark" size={20} color={palette.text} />
          </TouchableOpacity>

          <View style={styles.icon}>
            <FontAwesome6 name="key" size={28} color={Colors.white} />
          </View>
          <Text style={[styles.title, { color: palette.text }]}>
            Yeni Şifre Belirle
          </Text>
          <Text style={[styles.description, { color: palette.muted }]}>
            Hesabınız için kullanmak istediğiniz yeni şifreyi girin.
          </Text>

          {isPreparing ? (
            <ActivityIndicator color={Colors.orange} style={{ marginTop: 24 }} />
          ) : (
            <>
              {errorMsg ? (
                <View style={styles.errorBox}>
                  <FontAwesome6
                    name="circle-exclamation"
                    size={14}
                    color="#ef4444"
                  />
                  <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
              ) : null}

              <View
                style={[
                  styles.inputWrapper,
                  { backgroundColor: palette.card, borderColor: palette.border },
                ]}
              >
                <FontAwesome6
                  name="lock"
                  size={16}
                  color={palette.muted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, { color: palette.text }]}
                  placeholder="Yeni şifre"
                  placeholderTextColor={palette.muted}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={password}
                  onChangeText={setPassword}
                  editable={isReady && !isSaving}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((value) => !value)}
                  style={styles.eyeBtn}
                >
                  <FontAwesome6
                    name={showPassword ? "eye-slash" : "eye"}
                    size={16}
                    color={palette.muted}
                  />
                </TouchableOpacity>
              </View>

              <View
                style={[
                  styles.inputWrapper,
                  { backgroundColor: palette.card, borderColor: palette.border },
                ]}
              >
                <FontAwesome6
                  name="lock"
                  size={16}
                  color={palette.muted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, { color: palette.text }]}
                  placeholder="Yeni şifre tekrar"
                  placeholderTextColor={palette.muted}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  editable={isReady && !isSaving}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, !isReady && styles.submitBtnDisabled]}
                onPress={handleUpdatePassword}
                disabled={!isReady || isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.submitBtnText}>Şifreyi Güncelle</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, flexGrow: 1, justifyContent: "center" },
  closeBtn: {
    position: "absolute",
    top: 10,
    right: 0,
    zIndex: 10,
    padding: 10,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.orange,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 18,
  },
  title: { fontSize: 28, fontWeight: "900", textAlign: "center" },
  description: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: { color: "#ef4444", fontSize: 13, flex: 1, fontWeight: "700" },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 16,
    height: 56,
    marginBottom: 14,
  },
  inputIcon: { paddingHorizontal: 16 },
  input: { flex: 1, fontSize: 15, height: "100%" },
  eyeBtn: { padding: 16 },
  submitBtn: {
    backgroundColor: Colors.orange,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  submitBtnDisabled: { backgroundColor: "#94a3b8", opacity: 0.75 },
  submitBtnText: { color: Colors.white, fontSize: 16, fontWeight: "800" },
});
