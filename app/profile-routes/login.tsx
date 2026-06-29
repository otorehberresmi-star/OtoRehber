import Colors from "@/constants/Colors";
import { FontAwesome6 } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../supabaseClient";
import { useAppTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { getSafeReturnTo } from "../../utils/authRedirect";
import { getGoogleAuthAvailability } from "../../utils/authProviders";
import {
  LEGAL_DOCUMENT_VERSION,
  LegalDocumentId,
} from "../../data/legalDocuments";
import { secureApi } from "../../utils/secureApi";

type AuthFieldErrorKey =
  | "fullName"
  | "email"
  | "password"
  | "confirmPassword"
  | "terms"
  | "privacy";

type AuthFieldErrors = Partial<Record<AuthFieldErrorKey, string>>;

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const returnTo = getSafeReturnTo(params.returnTo);
  const { palette } = useAppTheme();
  const { loginWithGoogle } = useAuth();

  const [isRegister, setIsRegister] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [marketingConsentAccepted, setMarketingConsentAccepted] =
    useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [googleAuthAvailable, setGoogleAuthAvailable] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [mfaModal, setMfaModal] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [forgotModal, setForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotInfo, setForgotInfo] = useState<string | null>(null);
  const [isSendingReset, setIsSendingReset] = useState(false);

  useEffect(() => {
    let active = true;
    void getGoogleAuthAvailability().then((available) => {
      if (active) setGoogleAuthAvailable(available);
    });
    return () => {
      active = false;
    };
  }, []);

  const toggleMode = () => {
    setIsRegister(!isRegister);
    setErrorMsg(null);
    setFieldErrors({});
    setFullName("");
    setPassword("");
    setConfirmPassword("");
    setTermsAccepted(false);
    setPrivacyAcknowledged(false);
    setMarketingConsentAccepted(false);
    setInfoMsg(null);
  };

  const clearFieldErrors = (...keys: AuthFieldErrorKey[]) => {
    setFieldErrors((current) => {
      if (!keys.some((key) => current[key])) return current;
      const next = { ...current };
      keys.forEach((key) => {
        delete next[key];
      });
      return next;
    });
  };

  const openLegalDocument = (document: LegalDocumentId) => {
    router.push(`/legal/${document}` as any);
  };

  const saveLegalConsents = async (
    userId: string,
    acceptedAt: string,
  ) => {
    try {
      await secureApi<{ ok: true }>("legal-consents/register", {
        body: {
          document_version: LEGAL_DOCUMENT_VERSION,
          accepted_at: acceptedAt,
          marketing_consent_accepted: marketingConsentAccepted,
        },
      });
    } catch (error: any) {
      console.warn(
        "Hukuki onay geçmişi sunucuya kaydedilemedi:",
        error?.message || error,
      );
    }
  };

  const continueAfterMfaCheck = async () => {
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

      const factor = factors?.totp?.[0];
      if (!factor) {
        throw new Error("2FA etkin ancak doğrulama yöntemi bulunamadı.");
      }

      setMfaFactorId(factor.id);
      setMfaCode("");
      setMfaModal(true);
      return false;
    }

    router.replace(returnTo as any);
    return true;
  };

  const handleMfaVerify = async () => {
    if (!mfaFactorId || mfaCode.length !== 6) {
      setErrorMsg("Authenticator uygulamasındaki 6 haneli kodu girin.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: mfaFactorId,
        code: mfaCode,
      });
      if (error) throw error;

      setMfaModal(false);
      router.replace(returnTo as any);
    } catch (error: any) {
      setErrorMsg(error?.message || "Doğrulama kodu geçersiz.");
    } finally {
      setLoading(false);
    }
  };

  const cancelMfaLogin = async () => {
    setMfaModal(false);
    setMfaCode("");
    setMfaFactorId(null);
    await supabase.auth.signOut();
  };

  const openForgotPassword = () => {
    setForgotEmail(email.trim().toLowerCase());
    setForgotError(null);
    setForgotInfo(null);
    setForgotModal(true);
  };

  const handleForgotPassword = async () => {
    const resetEmail = forgotEmail.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail)) {
      setForgotError("Geçerli bir e-posta adresi girin.");
      return;
    }

    setIsSendingReset(true);
    setForgotError(null);
    setForgotInfo(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: Linking.createURL("profile-routes/reset-password"),
      });
      if (error) throw error;

      setForgotInfo(
        "Şifre sıfırlama bağlantısı e-posta adresinize gönderildi. Bağlantıyı açıp yeni şifrenizi belirleyebilirsiniz.",
      );
      setInfoMsg(
        "Şifre sıfırlama bağlantısı gönderildi. E-postanızı kontrol edin.",
      );
    } catch (error: any) {
      setForgotError(
        error?.message || "Şifre sıfırlama bağlantısı gönderilemedi.",
      );
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleAuth = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setFieldErrors({});

    const nextFieldErrors: AuthFieldErrors = {};
    if (isRegister && !fullName.trim()) {
      nextFieldErrors.fullName = "Ad soyad zorunlu.";
    }
    if (!email.trim()) {
      nextFieldErrors.email = "E-posta adresi zorunlu.";
    }
    if (!password) {
      nextFieldErrors.password = "Şifre zorunlu.";
    }
    if (isRegister && !confirmPassword) {
      nextFieldErrors.confirmPassword = "Şifre tekrarı zorunlu.";
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setErrorMsg("Lütfen tüm zorunlu alanları doldurun.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFieldErrors({ email: "Geçerli bir e-posta adresi girin." });
      setErrorMsg("Geçerli bir e-posta adresi girin.");
      return;
    }

    if (password.length < 6) {
      setFieldErrors({ password: "Şifreniz en az 6 karakter olmalıdır." });
      setErrorMsg("Şifreniz en az 6 karakter olmalıdır.");
      return;
    }

    if (isRegister && password !== confirmPassword) {
      setFieldErrors({ confirmPassword: "Şifreler eşleşmiyor." });
      setErrorMsg("Şifreler eşleşmiyor, lütfen kontrol edin.");
      return;
    }

    if (isRegister && (!termsAccepted || !privacyAcknowledged)) {
      const legalErrors: AuthFieldErrors = {};
      if (!termsAccepted) {
        legalErrors.terms = "Kullanım Şartları kabul edilmeli.";
      }
      if (!privacyAcknowledged) {
        legalErrors.privacy = "KVKK ve Gizlilik onayı gerekli.";
      }
      setFieldErrors(legalErrors);
      setErrorMsg(
        "Kayıt olmak için Kullanım Şartları'nı kabul etmeli ve KVKK/Gizlilik metinlerini okuduğunuzu onaylamalısınız.",
      );
      return;
    }

    setLoading(true);
    try {
      if (isRegister) {
        const legalAcceptedAt = new Date().toISOString();
        // 🟢 SADECE AUTH KAYDI YAPILIYOR
        // İsmi metadata içine 'display_name' olarak gömüyoruz.
        // Arkadaki SQL Trigger bunu otomatik yakalayıp profiles tablosuna pürüzsüzce yazacak!
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: fullName.trim(),
              full_name: fullName.trim(),
              legal_consents: {
                version: LEGAL_DOCUMENT_VERSION,
                accepted_at: legalAcceptedAt,
                terms: true,
                kvkk_acknowledged: true,
                privacy_acknowledged: true,
                marketing_consent: marketingConsentAccepted,
              },
            },
          },
        });
        if (error) throw error;

        if (data.user?.id) {
          await supabase.from("profiles").upsert({
            id: data.user.id,
            display_name: fullName.trim(),
            full_name: fullName.trim(),
          });
          await saveLegalConsents(data.user.id, legalAcceptedAt);
        }

        router.replace(returnTo as any);
      } else {
        // 🔵 GİRİŞ YAPMA ALANI
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        await continueAfterMfaCheck();
      }
    } catch (err: any) {
      console.error("Auth hatası:", err);
      if (err.message.includes("Invalid login credentials")) {
        setErrorMsg("E-posta adresiniz veya şifreniz hatalı.");
      } else if (err.message.includes("User already registered")) {
        setErrorMsg("Bu e-posta adresi zaten sistemimizde kayıtlı.");
      } else if (err.message.includes("Password should be at least")) {
        setErrorMsg("Şifreniz en az 6 karakter olmalıdır.");
      } else {
        setErrorMsg(err.message || "Beklenmeyen bir hata oluştu.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const ok = await loginWithGoogle();
      if (ok) {
        await continueAfterMfaCheck();
      } else {
        setErrorMsg("Google ile giriş tamamlanamadı.");
      }
    } catch (err: any) {
      console.error("Google auth hatası:", err);
      setErrorMsg(err.message || "Google ile giriş sırasında hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.closeBtn}
          >
            <FontAwesome6 name="xmark" size={20} color={palette.text} />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.logoIcon}>
              <FontAwesome6
                name="car-side"
                size={28}
                color={Colors.white}
                solid
              />
            </View>
            <Text style={[styles.logoText, { color: palette.text }]}>
              Oto<Text style={styles.logoAccent}>Rehber</Text>
            </Text>
            <Text style={[styles.subtitle, { color: palette.muted }]}>
              {isRegister
                ? "Aramıza katıl, deneyimini paylaş!"
                : "Tekrar hoş geldin, giriş yap."}
            </Text>
          </View>

          {errorMsg && (
            <View style={styles.errorBox}>
              <FontAwesome6
                name="circle-exclamation"
                size={14}
                color="#ef4444"
              />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}
          {infoMsg && (
            <View style={styles.infoBox}>
              <FontAwesome6
                name="circle-check"
                size={14}
                color="#16a34a"
              />
              <Text style={styles.infoText}>{infoMsg}</Text>
            </View>
          )}

          <View style={styles.formContainer}>
            {/* İsim Soyad (Sadece Kayıt Modunda) */}
            {isRegister && (
              <View style={styles.fieldBlock}>
                <View
                  style={[
                    styles.inputWrapper,
                    {
                      backgroundColor: palette.card,
                      borderColor: palette.border,
                    },
                    fieldErrors.fullName && styles.inputWrapperError,
                  ]}
                >
                  <FontAwesome6
                    name="user"
                    size={16}
                    color={fieldErrors.fullName ? "#ef4444" : palette.muted}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[styles.input, { color: palette.text }]}
                    placeholder="İsim Soyad"
                    placeholderTextColor={palette.muted}
                    autoCapitalize="words"
                    value={fullName}
                    onChangeText={(value) => {
                      setFullName(value);
                      clearFieldErrors("fullName");
                    }}
                  />
                </View>
                {fieldErrors.fullName ? (
                  <Text style={styles.fieldErrorText}>
                    {fieldErrors.fullName}
                  </Text>
                ) : null}
              </View>
            )}

            {/* E-posta */}
            <View style={styles.fieldBlock}>
              <View
                style={[
                  styles.inputWrapper,
                  { backgroundColor: palette.card, borderColor: palette.border },
                  fieldErrors.email && styles.inputWrapperError,
                ]}
              >
                <FontAwesome6
                  name="envelope"
                  size={16}
                  color={fieldErrors.email ? "#ef4444" : palette.muted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, { color: palette.text }]}
                  placeholder="E-posta adresi"
                  placeholderTextColor={palette.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    clearFieldErrors("email");
                  }}
                />
              </View>
              {fieldErrors.email ? (
                <Text style={styles.fieldErrorText}>{fieldErrors.email}</Text>
              ) : null}
            </View>

            {/* Şifre */}
            <View style={styles.fieldBlock}>
              <View
                style={[
                  styles.inputWrapper,
                  { backgroundColor: palette.card, borderColor: palette.border },
                  fieldErrors.password && styles.inputWrapperError,
                ]}
              >
                <FontAwesome6
                  name="lock"
                  size={16}
                  color={fieldErrors.password ? "#ef4444" : palette.muted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[
                    styles.input,
                    { color: palette.text, backgroundColor: "transparent" },
                  ]}
                  placeholder="Şifre"
                  placeholderTextColor={palette.muted}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType={isRegister ? "newPassword" : "password"}
                  autoComplete={isRegister ? "new-password" : "password"}
                  selectionColor={Colors.orange}
                  cursorColor={Colors.orange}
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    clearFieldErrors("password");
                  }}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}
                >
                  <FontAwesome6
                    name={showPassword ? "eye-slash" : "eye"}
                    size={16}
                    color={palette.muted}
                  />
                </TouchableOpacity>
              </View>
              {fieldErrors.password ? (
                <Text style={styles.fieldErrorText}>
                  {fieldErrors.password}
                </Text>
              ) : null}
            </View>

            {!isRegister && (
              <TouchableOpacity
                style={styles.forgotButton}
                onPress={openForgotPassword}
                activeOpacity={0.8}
              >
                <Text style={styles.forgotText}>Şifremi unuttum</Text>
              </TouchableOpacity>
            )}

            {/* Şifre Tekrar (Sadece Kayıt Modunda) */}
            {isRegister && (
              <>
                <View style={styles.fieldBlock}>
                  <View
                    style={[
                      styles.inputWrapper,
                      {
                        backgroundColor: palette.card,
                        borderColor: palette.border,
                      },
                      fieldErrors.confirmPassword && styles.inputWrapperError,
                    ]}
                  >
                    <FontAwesome6
                      name="lock"
                      size={16}
                      color={
                        fieldErrors.confirmPassword ? "#ef4444" : palette.muted
                      }
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={[
                        styles.input,
                        { color: palette.text, backgroundColor: "transparent" },
                      ]}
                      placeholder="Şifreyi tekrar girin"
                      placeholderTextColor={palette.muted}
                      secureTextEntry={!showConfirmPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      textContentType="newPassword"
                      autoComplete="new-password"
                      selectionColor={Colors.orange}
                      cursorColor={Colors.orange}
                      value={confirmPassword}
                      onChangeText={(value) => {
                        setConfirmPassword(value);
                        clearFieldErrors("confirmPassword");
                      }}
                    />
                    <TouchableOpacity
                      onPress={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      style={styles.eyeBtn}
                    >
                      <FontAwesome6
                        name={showConfirmPassword ? "eye-slash" : "eye"}
                        size={16}
                        color={palette.muted}
                      />
                    </TouchableOpacity>
                  </View>
                  {fieldErrors.confirmPassword ? (
                    <Text style={styles.fieldErrorText}>
                      {fieldErrors.confirmPassword}
                    </Text>
                  ) : null}
                </View>

                <View
                  style={[
                    styles.legalCard,
                    {
                      backgroundColor: palette.card,
                      borderColor: palette.border,
                    },
                    (fieldErrors.terms || fieldErrors.privacy) &&
                      styles.legalCardError,
                  ]}
                >
                  <Text style={[styles.legalTitle, { color: palette.text }]}>
                    Üyelik onayları
                  </Text>
                  <Text
                    style={[styles.legalDescription, { color: palette.muted }]}
                  >
                    Satıra dokunarak onaylayın, metinleri Oku ile açın.
                  </Text>

                  <TouchableOpacity
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: termsAccepted }}
                    accessibilityLabel="Kullanım Şartları'nı kabul ediyorum"
                    style={[
                      styles.consentRow,
                      fieldErrors.terms && styles.consentRowError,
                    ]}
                    onPress={() => {
                      setTermsAccepted((value) => !value);
                      clearFieldErrors("terms");
                    }}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        { borderColor: palette.border },
                        fieldErrors.terms && styles.checkboxError,
                        termsAccepted && styles.checkboxChecked,
                      ]}
                    >
                      {termsAccepted ? (
                        <FontAwesome6
                          name="check"
                          size={12}
                          color={Colors.white}
                        />
                      ) : null}
                    </View>
                    <View style={styles.consentBody}>
                      <Text
                        style={[styles.consentText, { color: palette.softText }]}
                      >
                        Kullanım Şartları'nı okudum ve kabul ediyorum.
                      </Text>
                      <TouchableOpacity
                        accessibilityRole="link"
                        accessibilityLabel="Kullanım Şartları metnini oku"
                        hitSlop={8}
                        onPress={(event) => {
                          event.stopPropagation();
                          openLegalDocument("terms");
                        }}
                      >
                        <Text style={styles.legalLink}>Oku</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                  {fieldErrors.terms ? (
                    <Text style={styles.legalErrorText}>
                      {fieldErrors.terms}
                    </Text>
                  ) : null}

                  <TouchableOpacity
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: privacyAcknowledged }}
                    accessibilityLabel="KVKK Aydınlatma Metni ve Gizlilik Politikası'nı okudum"
                    style={[
                      styles.consentRow,
                      fieldErrors.privacy && styles.consentRowError,
                    ]}
                    onPress={() => {
                      setPrivacyAcknowledged((value) => !value);
                      clearFieldErrors("privacy");
                    }}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        { borderColor: palette.border },
                        fieldErrors.privacy && styles.checkboxError,
                        privacyAcknowledged && styles.checkboxChecked,
                      ]}
                    >
                      {privacyAcknowledged ? (
                        <FontAwesome6
                          name="check"
                          size={12}
                          color={Colors.white}
                        />
                      ) : null}
                    </View>
                    <View style={styles.consentBody}>
                      <Text
                        style={[styles.consentText, { color: palette.softText }]}
                      >
                        KVKK Aydınlatma Metni ve Gizlilik Politikası'nı okudum
                        ve bilgilendirildim.
                      </Text>
                      <View style={styles.legalActions}>
                        <TouchableOpacity
                          accessibilityRole="link"
                          accessibilityLabel="KVKK Aydınlatma Metni'ni oku"
                          hitSlop={8}
                          onPress={(event) => {
                            event.stopPropagation();
                            openLegalDocument("kvkk");
                          }}
                        >
                          <Text style={styles.legalLink}>KVKK</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          accessibilityRole="link"
                          accessibilityLabel="Gizlilik Politikası'nı oku"
                          hitSlop={8}
                          onPress={(event) => {
                            event.stopPropagation();
                            openLegalDocument("privacy");
                          }}
                        >
                          <Text style={styles.legalLink}>Gizlilik</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                  {fieldErrors.privacy ? (
                    <Text style={styles.legalErrorText}>
                      {fieldErrors.privacy}
                    </Text>
                  ) : null}

                  <TouchableOpacity
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: marketingConsentAccepted }}
                    accessibilityLabel="Pazarlama ve iletişim izni açık rıza beyanını onaylıyorum"
                    style={styles.consentRow}
                    onPress={() =>
                      setMarketingConsentAccepted((value) => !value)
                    }
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        { borderColor: palette.border },
                        marketingConsentAccepted && styles.checkboxChecked,
                      ]}
                    >
                      {marketingConsentAccepted ? (
                        <FontAwesome6
                          name="check"
                          size={12}
                          color={Colors.white}
                        />
                      ) : null}
                    </View>
                    <View style={styles.consentBody}>
                      <Text
                        style={[styles.consentText, { color: palette.softText }]}
                      >
                        Pazarlama ve İletişim İzni Açık Rıza Beyanı'nı isteğe
                        bağlı olarak onaylıyorum.
                      </Text>
                      <TouchableOpacity
                        accessibilityRole="link"
                        accessibilityLabel="Pazarlama ve iletişim izni açık rıza beyanını oku"
                        hitSlop={8}
                        onPress={(event) => {
                          event.stopPropagation();
                          openLegalDocument("marketing-consent");
                        }}
                      >
                        <Text style={styles.legalLink}>Oku</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                </View>
              </>
            )}

            <TouchableOpacity
              style={[
                styles.submitBtn,
                isRegister &&
                  (!termsAccepted || !privacyAcknowledged) &&
                  styles.submitBtnDisabled,
              ]}
              onPress={handleAuth}
              disabled={
                loading ||
                (isRegister && (!termsAccepted || !privacyAcknowledged))
              }
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.submitBtnText}>
                  {isRegister ? "Kayıt Ol" : "Giriş Yap"}
                </Text>
              )}
            </TouchableOpacity>

            {googleAuthAvailable ? (
              <>
                <View style={styles.separatorRow}>
                  <View
                    style={[
                      styles.separatorLine,
                      { backgroundColor: palette.border },
                    ]}
                  />
                  <Text style={[styles.separatorText, { color: palette.muted }]}>
                    veya
                  </Text>
                  <View
                    style={[
                      styles.separatorLine,
                      { backgroundColor: palette.border },
                    ]}
                  />
                </View>

                <TouchableOpacity
                  style={[
                    styles.googleBtn,
                    {
                      backgroundColor: palette.card,
                      borderColor: palette.border,
                    },
                  ]}
                  onPress={handleGoogleAuth}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  <FontAwesome6 name="google" size={17} color={Colors.orange} />
                  <Text style={[styles.googleBtnText, { color: palette.text }]}>
                    Google ile devam et
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}

            <TouchableOpacity style={styles.toggleBtn} onPress={toggleMode}>
              <Text style={[styles.toggleText, { color: palette.muted }]}>
                {isRegister ? "Zaten hesabım var, " : "Hesabın yok mu? "}
                <Text style={styles.toggleAccent}>
                  {isRegister ? "Giriş Yap" : "Kayıt Ol"}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={mfaModal}
        transparent
        animationType="fade"
        onRequestClose={cancelMfaLogin}
      >
        <Pressable style={styles.modalOverlay} onPress={cancelMfaLogin} />
        <View
          style={[
            styles.mfaModal,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <View style={styles.mfaIcon}>
            <FontAwesome6 name="shield-halved" size={24} color={Colors.orange} />
          </View>
          <Text style={[styles.mfaTitle, { color: palette.text }]}>
            İki Adımlı Doğrulama
          </Text>
          <Text style={[styles.mfaDescription, { color: palette.muted }]}>
            Authenticator uygulamanızdaki 6 haneli kodu girin.
          </Text>
          <TextInput
            style={[
              styles.mfaInput,
              {
                color: palette.text,
                backgroundColor: palette.elevated,
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
          {errorMsg && <Text style={styles.mfaError}>{errorMsg}</Text>}
          <View style={styles.mfaActions}>
            <TouchableOpacity
              style={[styles.mfaCancel, { borderColor: palette.border }]}
              onPress={cancelMfaLogin}
              disabled={loading}
            >
              <Text style={[styles.mfaCancelText, { color: palette.muted }]}>
                Vazgeç
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.mfaVerify}
              onPress={handleMfaVerify}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.mfaVerifyText}>Doğrula</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={forgotModal}
        transparent
        animationType="fade"
        onRequestClose={() => setForgotModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setForgotModal(false)}
        />
        <View
          style={[
            styles.mfaModal,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <View style={styles.mfaIcon}>
            <FontAwesome6 name="key" size={22} color={Colors.orange} />
          </View>
          <Text style={[styles.mfaTitle, { color: palette.text }]}>
            Şifremi Unuttum
          </Text>
          <Text style={[styles.mfaDescription, { color: palette.muted }]}>
            Hesabınıza bağlı e-posta adresini girin. Size yeni şifre belirleme
            bağlantısı göndereceğiz.
          </Text>
          <TextInput
            style={[
              styles.resetInput,
              {
                color: palette.text,
                backgroundColor: palette.elevated,
                borderColor: palette.border,
              },
            ]}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="ornek@mail.com"
            placeholderTextColor={palette.muted}
            value={forgotEmail}
            onChangeText={setForgotEmail}
          />
          {forgotError ? (
            <Text style={styles.mfaError}>{forgotError}</Text>
          ) : null}
          {forgotInfo ? (
            <Text style={styles.resetInfo}>{forgotInfo}</Text>
          ) : null}
          <View style={styles.mfaActions}>
            <TouchableOpacity
              style={[styles.mfaCancel, { borderColor: palette.border }]}
              onPress={() => setForgotModal(false)}
              disabled={isSendingReset}
            >
              <Text style={[styles.mfaCancelText, { color: palette.muted }]}>
                Kapat
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.mfaVerify}
              onPress={handleForgotPassword}
              disabled={isSendingReset}
            >
              {isSendingReset ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.mfaVerifyText}>Bağlantı Gönder</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.navyMain },
  scrollContent: { padding: 24, flexGrow: 1, justifyContent: "center" },
  closeBtn: {
    position: "absolute",
    top: 10,
    right: 0,
    zIndex: 10,
    padding: 10,
  },
  header: { alignItems: "center", marginBottom: 40 },
  logoIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.orange,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  logoText: {
    fontSize: 32,
    fontWeight: "900",
    color: Colors.white,
    letterSpacing: -1,
  },
  logoAccent: { color: Colors.orange },
  subtitle: {
    color: Colors.textMuted,
    marginTop: 8,
    fontSize: 14,
    textAlign: "center",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    gap: 8,
  },
  errorText: { color: "#ef4444", fontSize: 13, flex: 1, fontWeight: "600" },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(22, 163, 74, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(22, 163, 74, 0.25)",
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    gap: 8,
  },
  infoText: { color: "#16a34a", fontSize: 13, flex: 1, fontWeight: "700" },
  formContainer: { gap: 16 },
  fieldBlock: { gap: 6 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.navyCard,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    borderRadius: 16,
    height: 56,
  },
  inputWrapperError: {
    borderColor: "#ef4444",
    borderWidth: 1.4,
  },
  fieldErrorText: {
    color: "#ef4444",
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 4,
  },
  inputIcon: { paddingHorizontal: 16 },
  input: { flex: 1, color: Colors.white, fontSize: 15, height: "100%" },
  eyeBtn: { padding: 16 },
  forgotButton: {
    alignSelf: "flex-end",
    paddingVertical: 2,
    paddingHorizontal: 4,
    marginTop: -8,
  },
  forgotText: { color: Colors.orange, fontSize: 13, fontWeight: "800" },
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
  legalCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 5,
  },
  legalCardError: {
    borderColor: "#ef4444",
  },
  legalTitle: { fontSize: 14, fontWeight: "800" },
  legalDescription: { fontSize: 12, lineHeight: 17, marginBottom: 5 },
  consentRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 7,
  },
  consentRowError: {
    borderRadius: 12,
    backgroundColor: "rgba(239, 68, 68, 0.07)",
    paddingHorizontal: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: Colors.orange,
    borderColor: Colors.orange,
  },
  checkboxError: { borderColor: "#ef4444" },
  consentBody: { flex: 1, gap: 6 },
  consentText: { fontSize: 13, lineHeight: 20 },
  legalActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  legalErrorText: {
    color: "#ef4444",
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 40,
    marginTop: -3,
  },
  legalLink: { color: Colors.orange, fontSize: 13, fontWeight: "800" },
  separatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  separatorLine: { flex: 1, height: 1, backgroundColor: Colors.navyBorder },
  separatorText: { color: Colors.textMuted, fontSize: 12, fontWeight: "700" },
  googleBtn: {
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    backgroundColor: Colors.navyCard,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  googleBtnText: { color: Colors.white, fontSize: 15, fontWeight: "800" },
  toggleBtn: { marginTop: 16, alignItems: "center", padding: 10 },
  toggleText: { color: Colors.textMuted, fontSize: 14 },
  toggleAccent: { color: Colors.orange, fontWeight: "700" },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  mfaModal: {
    marginHorizontal: 24,
    marginTop: "auto",
    marginBottom: "auto",
    borderRadius: 20,
    borderWidth: 1,
    padding: 22,
  },
  mfaIcon: {
    alignSelf: "center",
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(249, 115, 22, 0.12)",
    marginBottom: 14,
  },
  mfaTitle: { fontSize: 20, fontWeight: "900", textAlign: "center" },
  mfaDescription: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 7,
    marginBottom: 18,
  },
  mfaInput: {
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 9,
  },
  mfaError: {
    color: "#ef4444",
    fontSize: 12,
    textAlign: "center",
    marginTop: 10,
  },
  resetInput: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: "600",
  },
  resetInfo: {
    color: "#16a34a",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 10,
    fontWeight: "700",
  },
  mfaActions: { flexDirection: "row", gap: 12, marginTop: 18 },
  mfaCancel: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  mfaCancelText: { fontSize: 14, fontWeight: "700" },
  mfaVerify: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  mfaVerifyText: { color: Colors.white, fontSize: 14, fontWeight: "800" },
});
