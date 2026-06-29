import Colors from "@/constants/Colors";
import { FontAwesome6 } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import { useAuth } from "../../contexts/AuthContext";
import { useAppTheme } from "../../contexts/ThemeContext";
import { supabase } from "../../supabaseClient";
import { loginRoute } from "../../utils/authRedirect";
import { getGoogleAuthAvailability } from "../../utils/authProviders";
import { secureApi } from "../../utils/secureApi";

export default function SecurityScreen() {
  const router = useRouter();
  const {
    user,
    linkGoogleAccount,
    refreshUser,
    biometricAvailable,
    biometricEnabled,
    setBiometricEnabled,
    isAuthReady,
    logout,
  } = useAuth();
  const { palette } = useAppTheme();
  const isGoogleLinked = user?.providers?.includes("google") ?? false;

  // Toggles
  const [twoFactor, setTwoFactor] = useState(false);
  const [privateProfile, setPrivateProfile] = useState(false);
  const [verifiedFactorId, setVerifiedFactorId] = useState<string | null>(null);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaSecret, setMfaSecret] = useState("");
  const [mfaUri, setMfaUri] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaMode, setMfaMode] = useState<"enroll" | "disable">("enroll");
  const [mfaModal, setMfaModal] = useState(false);
  const [isLoadingSecurity, setIsLoadingSecurity] = useState(true);
  const [isSavingMfa, setIsSavingMfa] = useState(false);
  const [isSavingBiometric, setIsSavingBiometric] = useState(false);
  const [isSavingPrivacy, setIsSavingPrivacy] = useState(false);

  // Modals
  const [emailModal, setEmailModal] = useState(false);
  const [passModal, setPassModal] = useState(false);
  const [newEmail, setNewEmail] = useState(user?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [googleAuthAvailable, setGoogleAuthAvailable] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const describeGoogleLinkError = (message?: string) => {
    const lowerMessage = (message || "").toLocaleLowerCase("tr-TR");

    if (
      lowerMessage.includes("provider") ||
      lowerMessage.includes("unsupported") ||
      lowerMessage.includes("not enabled")
    ) {
      return "Google ile bağlantı şu anda kullanılamıyor.";
    }

    if (
      lowerMessage.includes("redirect") ||
      lowerMessage.includes("callback") ||
      lowerMessage.includes("url")
    ) {
      return "Google bağlantısı şu anda tamamlanamıyor. Lütfen daha sonra tekrar dene.";
    }

    if (
      lowerMessage.includes("penceresi") ||
      lowerMessage.includes("dismiss") ||
      lowerMessage.includes("cancel")
    ) {
      return "Google bağlantı ekranı tamamlanmadan kapandı. Tekrar deneyin.";
    }

    return message || "Google hesabı bağlanırken bir hata oluştu.";
  };

  useEffect(() => {
    setNewEmail(user?.email || "");
  }, [user?.email]);

  useEffect(() => {
    let active = true;
    void getGoogleAuthAvailability().then((available) => {
      if (active) setGoogleAuthAvailable(available);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (isAuthReady && !user?.id) {
      router.replace(loginRoute("/profile-routes/security") as any);
    }
  }, [isAuthReady, router, user?.id]);

  useEffect(() => {
    let active = true;

    const loadSecuritySettings = async () => {
      if (!user?.id) {
        setIsLoadingSecurity(false);
        return;
      }

      try {
        const [{ data: factors, error: factorError }, { data: profile, error: profileError }] =
          await Promise.all([
            supabase.auth.mfa.listFactors(),
            supabase
              .from("profiles")
              .select("is_private")
              .eq("id", user.id)
              .maybeSingle(),
          ]);

        if (factorError) throw factorError;
        if (profileError) throw profileError;
        if (!active) return;

        const verified = factors?.totp?.[0];
        setVerifiedFactorId(verified?.id || null);
        setTwoFactor(Boolean(verified));
        setPrivateProfile(Boolean(profile?.is_private));
      } catch (error: any) {
        if (active) {
          Alert.alert(
            "Güvenlik ayarları alınamadı",
            error?.message || "Ayarlar yüklenirken bir hata oluştu.",
          );
        }
      } finally {
        if (active) setIsLoadingSecurity(false);
      }
    };

    loadSecuritySettings();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const resetMfaModal = () => {
    setMfaModal(false);
    setMfaCode("");
    setMfaFactorId(null);
    setMfaSecret("");
    setMfaUri("");
  };

  const handleMfaToggle = async (enabled: boolean) => {
    if (isSavingMfa) return;

    if (enabled) {
      setIsSavingMfa(true);
      try {
        const { data, error } = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "OtoRehber Authenticator",
        });
        if (error) throw error;

        setMfaMode("enroll");
        setMfaFactorId(data.id);
        setMfaSecret(data.totp.secret);
        setMfaUri(data.totp.uri);
        setMfaModal(true);
      } catch (error: any) {
        Alert.alert(
          "2FA başlatılamadı",
          error?.message || "Authenticator kurulumu başlatılamadı.",
        );
      } finally {
        setIsSavingMfa(false);
      }
      return;
    }

    if (!verifiedFactorId) return;

    Alert.alert(
      "İki adımlı doğrulamayı kapat",
      "Devam etmek için Authenticator uygulamanızdaki güncel kodu doğrulamanız gerekir.",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Devam Et",
          style: "destructive",
          onPress: () => {
            setMfaMode("disable");
            setMfaFactorId(verifiedFactorId);
            setMfaCode("");
            setMfaModal(true);
          },
        },
      ],
    );
  };

  const handleMfaModalClose = async () => {
    const pendingFactor = mfaMode === "enroll" ? mfaFactorId : null;
    resetMfaModal();
    if (pendingFactor) {
      await supabase.auth.mfa.unenroll({ factorId: pendingFactor });
    }
  };

  const handleVerifyMfa = async () => {
    if (!mfaFactorId || mfaCode.trim().length !== 6) {
      Alert.alert("Kod eksik", "Authenticator uygulamasındaki 6 haneli kodu girin.");
      return;
    }

    setIsSavingMfa(true);
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: mfaFactorId,
        code: mfaCode.trim(),
      });
      if (verifyError) throw verifyError;

      if (mfaMode === "disable") {
        const { error: unenrollError } = await supabase.auth.mfa.unenroll({
          factorId: mfaFactorId,
        });
        if (unenrollError) throw unenrollError;
        setTwoFactor(false);
        setVerifiedFactorId(null);
        Alert.alert("2FA kapatıldı", "İki adımlı doğrulama devre dışı bırakıldı.");
      } else {
        setTwoFactor(true);
        setVerifiedFactorId(mfaFactorId);
        Alert.alert("2FA etkin", "Hesabınız artık Authenticator koduyla korunuyor.");
      }

      resetMfaModal();
    } catch (error: any) {
      Alert.alert(
        "Kod doğrulanamadı",
        error?.message || "Kod geçersiz veya süresi dolmuş olabilir.",
      );
    } finally {
      setIsSavingMfa(false);
    }
  };

  const handleBiometricToggle = async (enabled: boolean) => {
    setIsSavingBiometric(true);
    try {
      const success = await setBiometricEnabled(enabled);
      if (!success) {
        Alert.alert(
          "Biyometri kullanılamıyor",
          "Cihazınızda Face ID, Touch ID veya parmak izi tanımlı olduğundan emin olun.",
        );
      }
    } catch (error: any) {
      Alert.alert(
        "Biyometrik ayar kaydedilemedi",
        error?.message || "Lütfen tekrar deneyin.",
      );
    } finally {
      setIsSavingBiometric(false);
    }
  };

  const handlePrivacyToggle = async (enabled: boolean) => {
    if (!user?.id) return;

    const previous = privateProfile;
    setPrivateProfile(enabled);
    setIsSavingPrivacy(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_private: enabled })
        .eq("id", user.id);
      if (error) throw error;
    } catch (error: any) {
      setPrivateProfile(previous);
      Alert.alert(
        "Gizlilik ayarı kaydedilemedi",
        error?.message || "Veritabanı güncellenemedi.",
      );
    } finally {
      setIsSavingPrivacy(false);
    }
  };

  const handleChangeEmail = async () => {
    const email = newEmail.trim().toLowerCase();

    if (!email || !email.includes("@")) {
      Alert.alert("Hata", "Geçerli bir e-posta adresi girin.");
      return;
    }

    if (email === user?.email?.toLowerCase()) {
      setEmailModal(false);
      return;
    }

    setIsSavingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;

      await refreshUser();
      setEmailModal(false);
      Alert.alert(
        "E-posta güncellemesi başlatıldı",
        "Supabase e-posta onayı açıksa yeni adresinize gelen bağlantıyı onaylamanız gerekir.",
      );
    } catch (error: any) {
      Alert.alert(
        "E-posta değiştirilemedi",
        error?.message || "E-posta değiştirilirken bir hata oluştu.",
      );
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user?.email) {
      Alert.alert("Şifre değiştirilemedi", "Hesap e-posta bilgisi bulunamadı.");
      return;
    }
    if (currentPassword.length < 6) {
      Alert.alert("Mevcut şifre", "Mevcut şifreni doğru şekilde girmelisin.");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Yeni şifre", "Yeni şifren en az 6 karakter olmalı.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Şifreler eşleşmiyor", "Yeni şifre alanlarını kontrol et.");
      return;
    }

    setIsSavingPassword(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (signInError) {
        Alert.alert("Mevcut şifre yanlış", "Mevcut şifreni kontrol et.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPassModal(false);
      Alert.alert("Şifre güncellendi", "Yeni şifren artık kullanılabilir.");
    } catch (error: any) {
      Alert.alert(
        "Şifre değiştirilemedi",
        error?.message || "Şifre değiştirilirken bir hata oluştu.",
      );
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim().toLocaleUpperCase("tr-TR") !== "SİL") {
      Alert.alert("Onay gerekli", "Hesabını silmek için SİL yazmalısın.");
      return;
    }

    setIsDeletingAccount(true);
    try {
      await secureApi<{ ok: true }>("account/delete");
      setDeleteModal(false);
      setDeleteConfirmText("");
      await logout();
      router.replace(loginRoute("/profile-routes/security") as any);
      Alert.alert(
        "Hesap silindi",
        "Hesabın ve ilişkili kişisel verilerin silme işlemi başlatıldı.",
      );
    } catch (error: any) {
      Alert.alert(
        "Hesap silinemedi",
        error?.message || "Lütfen daha sonra tekrar deneyin.",
      );
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleLinkGoogle = async () => {
    setIsLinkingGoogle(true);
    try {
      const ok = await linkGoogleAccount();
      if (!ok) {
        Alert.alert("Tamamlanmadı", "Google bağlantısı tamamlanamadı.");
        return;
      }

      Alert.alert("Başarılı", "Google hesabınız bağlandı.");
    } catch (error: any) {
      Alert.alert(
        "Google bağlanamadı",
        describeGoogleLinkError(error?.message),
      );
    } finally {
      setIsLinkingGoogle(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: palette.background }]}
      edges={["top"]}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome6 name="arrow-left" size={20} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: palette.text }]}>
          Hesap ve Güvenlik
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* 1. Hesap Bilgileri */}
        <Text style={[styles.sectionTitle, { color: palette.muted }]}>
          1. Hesap Bilgileri
        </Text>
        <View
          style={[
            styles.sectionBox,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: palette.muted }]}>
                E-posta Adresi
              </Text>
              <Text style={[styles.value, { color: palette.text }]}>
                {user?.email || "ornek@mail.com"}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setEmailModal(true)}
            >
              <Text style={styles.actionText}>Değiştir</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.divider, { backgroundColor: palette.border }]} />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: palette.muted }]}>
                Bağlı Hesaplar
              </Text>
              <View style={styles.socialRow}>
                <FontAwesome6 name="google" size={14} color={Colors.orange} />
                <Text
                  style={[
                    isGoogleLinked ? styles.value : styles.valueEmpty,
                    { color: isGoogleLinked ? palette.text : palette.softText },
                  ]}
                >
                  {isGoogleLinked ? "Google ile bağlı" : "Google bağlı değil"}
                </Text>
              </View>
            </View>
            {!isGoogleLinked && googleAuthAvailable && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleLinkGoogle}
                disabled={isLinkingGoogle}
              >
                <Text style={styles.actionText}>
                  {isLinkingGoogle ? "Bağlanıyor" : "Bağla"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 2. Kimlik Doğrulama ve Şifre */}
        <Text style={[styles.sectionTitle, { color: palette.muted }]}>
          2. Kimlik Doğrulama ve Şifre
        </Text>
        <View
          style={[
            styles.sectionBox,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <TouchableOpacity
            style={[styles.row, { paddingVertical: 4 }]}
            onPress={() => setPassModal(true)}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.value, { color: palette.text }]}>
                Şifre Değiştirme
              </Text>
              <Text style={[styles.subLabel, { color: palette.muted }]}>
                Hesabınızın şifresini güncelleyin
              </Text>
            </View>
            <FontAwesome6
              name="chevron-right"
              size={14}
              color={palette.muted}
            />
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: palette.border }]} />
          <View style={styles.row}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              <Text style={[styles.value, { color: palette.text }]}>
                İki Adımlı Doğrulama (2FA)
              </Text>
              <Text style={[styles.subLabel, { color: palette.muted }]}>
                Girişte Authenticator uygulamasından ek kod ister
              </Text>
            </View>
            <Switch
              value={twoFactor}
              onValueChange={handleMfaToggle}
              disabled={isLoadingSecurity || isSavingMfa}
              trackColor={{ false: palette.border, true: Colors.orange }}
              thumbColor={Colors.white}
            />
          </View>
          <View style={[styles.divider, { backgroundColor: palette.border }]} />
          <View style={styles.row}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              <Text style={[styles.value, { color: palette.text }]}>
                Biyometrik Giriş
              </Text>
              <Text style={[styles.subLabel, { color: palette.muted }]}>
                Uygulamayı Face ID, Touch ID veya parmak iziyle kilitleyin
              </Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={handleBiometricToggle}
              disabled={!biometricAvailable || isSavingBiometric}
              trackColor={{ false: palette.border, true: Colors.orange }}
              thumbColor={Colors.white}
            />
          </View>
        </View>

        {/* 3. Gizlilik ve Veri Yönetimi */}
        <Text style={[styles.sectionTitle, { color: palette.muted }]}>
          3. Gizlilik ve Veri Yönetimi
        </Text>
        <View
          style={[
            styles.sectionBox,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <View style={styles.row}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              <Text style={[styles.value, { color: palette.text }]}>
                Profil Gizliliği
              </Text>
              <Text style={[styles.subLabel, { color: palette.muted }]}>
                Herkese açık profilde adımı ve profil fotoğrafımı gizle
              </Text>
            </View>
            <Switch
              value={privateProfile}
              onValueChange={handlePrivacyToggle}
              disabled={isLoadingSecurity || isSavingPrivacy}
              trackColor={{ false: palette.border, true: Colors.orange }}
              thumbColor={Colors.white}
            />
          </View>
        </View>

        {/* Danger Zone */}
        <TouchableOpacity
          style={styles.deleteBtn}
          activeOpacity={0.8}
          onPress={() => setDeleteModal(true)}
        >
          <FontAwesome6 name="triangle-exclamation" size={16} color="#ef4444" />
          <Text style={styles.deleteBtnText}>Hesabımı Sil</Text>
        </TouchableOpacity>
        <Text style={[styles.deleteDesc, { color: palette.muted }]}>
          Bu işlem hesabını, profilini ve hesabına bağlı kişisel kayıtları kalıcı
          olarak siler. Geri alınamaz.
        </Text>
      </ScrollView>

      <Modal
        visible={mfaModal}
        animationType="fade"
        transparent
        onRequestClose={handleMfaModalClose}
      >
        <Pressable style={styles.modalOverlay} onPress={handleMfaModalClose} />
        <View
          style={[
            styles.modalContent,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <Text style={[styles.modalTitle, { color: palette.text }]}>
            {mfaMode === "enroll" ? "Authenticator Kurulumu" : "2FA Doğrulaması"}
          </Text>
          {mfaMode === "enroll" && mfaUri ? (
            <>
              <Text style={[styles.mfaDescription, { color: palette.softText }]}>
                QR kodu Google Authenticator, Microsoft Authenticator veya benzeri bir uygulamayla tarayın.
              </Text>
              <View style={styles.qrContainer}>
                <QRCode value={mfaUri} size={180} backgroundColor="#ffffff" />
              </View>
              <Text style={[styles.manualCodeLabel, { color: palette.muted }]}>
                Manuel kurulum kodu
              </Text>
              <Text selectable style={[styles.manualCode, { color: palette.text }]}>
                {mfaSecret}
              </Text>
            </>
          ) : (
            <Text style={[styles.mfaDescription, { color: palette.softText }]}>
              Authenticator uygulamanızda görünen güncel kodu girin.
            </Text>
          )}
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: palette.elevated,
                borderColor: palette.border,
                color: palette.text,
                textAlign: "center",
                fontSize: 20,
                letterSpacing: 8,
              },
            ]}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="000000"
            placeholderTextColor={palette.muted}
            value={mfaCode}
            onChangeText={(value) => setMfaCode(value.replace(/\D/g, ""))}
          />
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[
                styles.modalCancelBtn,
                { backgroundColor: palette.elevated, borderColor: palette.border },
              ]}
              onPress={handleMfaModalClose}
              disabled={isSavingMfa}
            >
              <Text style={[styles.modalCancelText, { color: palette.softText }]}>
                Vazgeç
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalSaveBtn}
              onPress={handleVerifyMfa}
              disabled={isSavingMfa}
            >
              {isSavingMfa ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.modalSaveText}>
                  {mfaMode === "enroll" ? "Etkinleştir" : "Doğrula ve Kapat"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* E-posta Değiştirme Modalı */}
      <Modal
        visible={emailModal}
        animationType="fade"
        transparent
        onRequestClose={() => setEmailModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setEmailModal(false)}
        />
        <View
          style={[
            styles.modalContent,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <Text style={[styles.modalTitle, { color: palette.text }]}>
            E-posta Adresini Değiştir
          </Text>
          <Text style={[styles.modalLabel, { color: palette.muted }]}>
            Yeni E-posta
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: palette.elevated,
                borderColor: palette.border,
                color: palette.text,
              },
            ]}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="ornek@mail.com"
            placeholderTextColor={palette.muted}
            value={newEmail}
            onChangeText={setNewEmail}
          />

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[
                styles.modalCancelBtn,
                {
                  backgroundColor: palette.elevated,
                  borderColor: palette.border,
                },
              ]}
              onPress={() => setEmailModal(false)}
            >
              <Text style={[styles.modalCancelText, { color: palette.softText }]}>
                İptal
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalSaveBtn}
              onPress={handleChangeEmail}
              disabled={isSavingEmail}
            >
              {isSavingEmail ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.modalSaveText}>Güncelle</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Şifre Değiştirme Modalı */}
      <Modal
        visible={passModal}
        animationType="fade"
        transparent
        onRequestClose={() => setPassModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setPassModal(false)}
        />
        <View
          style={[
            styles.modalContent,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <Text style={[styles.modalTitle, { color: palette.text }]}>
            Şifre Değiştir
          </Text>
          <Text style={[styles.modalLabel, { color: palette.muted }]}>
            Mevcut Şifre
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: palette.elevated,
                borderColor: palette.border,
                color: palette.text,
              },
            ]}
            secureTextEntry
            placeholder="••••••"
            placeholderTextColor={palette.muted}
            value={currentPassword}
            onChangeText={setCurrentPassword}
          />
          <Text style={[styles.modalLabel, { color: palette.muted }]}>
            Yeni Şifre
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: palette.elevated,
                borderColor: palette.border,
                color: palette.text,
              },
            ]}
            secureTextEntry
            placeholder="••••••"
            placeholderTextColor={palette.muted}
            value={newPassword}
            onChangeText={setNewPassword}
          />
          <Text style={[styles.modalLabel, { color: palette.muted }]}>
            Yeni Şifre (Tekrar)
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: palette.elevated,
                borderColor: palette.border,
                color: palette.text,
              },
            ]}
            secureTextEntry
            placeholder="••••••"
            placeholderTextColor={palette.muted}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[
                styles.modalCancelBtn,
                {
                  backgroundColor: palette.elevated,
                  borderColor: palette.border,
                },
              ]}
              onPress={() => setPassModal(false)}
            >
              <Text style={[styles.modalCancelText, { color: palette.softText }]}>
                İptal
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalSaveBtn}
              onPress={handleChangePassword}
              disabled={isSavingPassword}
            >
              {isSavingPassword ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.modalSaveText}>Güncelle</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Hesap Silme Modalı */}
      <Modal
        visible={deleteModal}
        animationType="fade"
        transparent
        onRequestClose={() => setDeleteModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            if (!isDeletingAccount) setDeleteModal(false);
          }}
        />
        <View
          style={[
            styles.modalContent,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <View style={styles.deleteIconBox}>
            <FontAwesome6 name="triangle-exclamation" size={24} color="#ef4444" />
          </View>
          <Text style={[styles.modalTitle, { color: palette.text }]}>
            Hesabını Sil
          </Text>
          <Text style={[styles.deleteModalDesc, { color: palette.softText }]}>
            Bu işlem hesabını ve hesabına bağlı kişisel verileri kalıcı olarak
            siler. Devam etmek için aşağıya SİL yaz.
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: palette.elevated,
                borderColor: palette.border,
                color: palette.text,
                textAlign: "center",
                fontWeight: "800",
              },
            ]}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="SİL"
            placeholderTextColor={palette.muted}
            value={deleteConfirmText}
            onChangeText={setDeleteConfirmText}
            editable={!isDeletingAccount}
          />

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[
                styles.modalCancelBtn,
                {
                  backgroundColor: palette.elevated,
                  borderColor: palette.border,
                },
              ]}
              onPress={() => setDeleteModal(false)}
              disabled={isDeletingAccount}
            >
              <Text style={[styles.modalCancelText, { color: palette.softText }]}>
                Vazgeç
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modalSaveBtn,
                styles.modalDeleteBtn,
                deleteConfirmText.trim().toLocaleUpperCase("tr-TR") !== "SİL" &&
                  styles.modalDisabledBtn,
              ]}
              onPress={handleDeleteAccount}
              disabled={
                isDeletingAccount ||
                deleteConfirmText.trim().toLocaleUpperCase("tr-TR") !== "SİL"
              }
            >
              {isDeletingAccount ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.modalSaveText}>Kalıcı Olarak Sil</Text>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.navyBorder,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: Colors.white },
  content: { padding: 20, paddingBottom: 60 },

  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.textMuted,
    marginBottom: 12,
    marginTop: 8,
    letterSpacing: 0.5,
  },
  sectionBox: {
    backgroundColor: Colors.navyCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 24,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  divider: { height: 1, backgroundColor: Colors.navyBorder },

  label: { fontSize: 11, color: Colors.textMuted, marginBottom: 4 },
  value: { fontSize: 14, color: Colors.white, fontWeight: "600" },
  valueEmpty: { fontSize: 14, color: Colors.gray300, fontStyle: "italic" },
  subLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
    lineHeight: 16,
  },
  actionBtn: {
    backgroundColor: "rgba(255, 101, 0, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionText: { color: Colors.orange, fontSize: 12, fontWeight: "700" },
  socialRow: { flexDirection: "row", alignItems: "center", gap: 8 },

  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 12,
  },
  deleteBtnText: { color: "#ef4444", fontSize: 15, fontWeight: "700" },
  deleteDesc: {
    color: Colors.textMuted,
    fontSize: 11,
    textAlign: "center",
    marginTop: 12,
    paddingHorizontal: 20,
    lineHeight: 16,
  },

  // Modal Styles
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  modalContent: {
    backgroundColor: Colors.navyCard,
    marginHorizontal: 20,
    marginTop: "auto",
    marginBottom: "auto",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.white,
    marginBottom: 16,
    textAlign: "center",
  },
  modalLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: Colors.navyMain,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.white,
    fontSize: 14,
    marginBottom: 8,
  },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 20 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.navyMain,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  modalCancelText: { color: Colors.gray300, fontSize: 14, fontWeight: "600" },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.orange,
    alignItems: "center",
  },
  modalDeleteBtn: { backgroundColor: "#ef4444" },
  modalDisabledBtn: { opacity: 0.5 },
  modalSaveText: { color: Colors.white, fontSize: 14, fontWeight: "800" },

  deleteIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  deleteModalDesc: {
    color: Colors.gray300,
    fontSize: 13,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  mfaDescription: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginBottom: 16,
  },
  qrContainer: {
    alignSelf: "center",
    backgroundColor: "#ffffff",
    padding: 12,
    borderRadius: 14,
    marginBottom: 14,
  },
  manualCodeLabel: { fontSize: 11, textAlign: "center", marginBottom: 5 },
  manualCode: {
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 14,
  },
});
