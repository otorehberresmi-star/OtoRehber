import Colors from "@/constants/Colors";
import { FontAwesome6 } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { useAppTheme } from "../../contexts/ThemeContext";
import { loginRoute } from "../../utils/authRedirect";

type PreferenceKey =
  | "push_enabled"
  | "email_enabled"
  | "maintenance_enabled"
  | "inspection_enabled"
  | "insurance_enabled"
  | "mtv_enabled"
  | "replies_enabled"
  | "likes_enabled"
  | "followed_enabled"
  | "weekly_digest_enabled"
  | "campaigns_enabled";

type Preferences = Record<PreferenceKey, boolean>;

const DEFAULT_PREFERENCES: Preferences = {
  push_enabled: true,
  email_enabled: false,
  maintenance_enabled: true,
  inspection_enabled: true,
  insurance_enabled: true,
  mtv_enabled: true,
  replies_enabled: true,
  likes_enabled: true,
  followed_enabled: true,
  weekly_digest_enabled: false,
  campaigns_enabled: false,
};

const PREFERENCE_KEYS: PreferenceKey[] = [
  "push_enabled",
  "email_enabled",
  "maintenance_enabled",
  "inspection_enabled",
  "insurance_enabled",
  "mtv_enabled",
  "replies_enabled",
  "likes_enabled",
  "followed_enabled",
  "weekly_digest_enabled",
  "campaigns_enabled",
];

const pickPreferences = (source: Partial<Preferences>) =>
  PREFERENCE_KEYS.reduce((acc, key) => {
    acc[key] =
      typeof source[key] === "boolean"
        ? Boolean(source[key])
        : DEFAULT_PREFERENCES[key];
    return acc;
  }, {} as Preferences);

const isSchemaError = (message = "") =>
  message.includes("notification_preferences") ||
  message.includes("vehicle_reminders") ||
  message.includes("generate_vehicle_reminder_notifications") ||
  message.includes("schema cache") ||
  message.includes("Could not find") ||
  message.includes("column") ||
  message.includes("does not exist");

const getAuthUserId = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id || null;
};

type ReminderSummary = {
  garageCars: number;
  activeReminders: number;
};

type GarageCarOption = {
  id: string;
  brand?: string | null;
  model?: string | null;
};

type ReminderType =
  | "maintenance"
  | "inspection"
  | "traffic_insurance"
  | "casco";

const REMINDER_TYPES: { key: ReminderType; label: string }[] = [
  { key: "maintenance", label: "Bakım" },
  { key: "inspection", label: "Muayene" },
  { key: "traffic_insurance", label: "Trafik Sigortası" },
  { key: "casco", label: "Kasko" },
];

const formatStorageDate = (date: Date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

const parseStorageDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);

  return year && month && day ? new Date(year, month - 1, day) : new Date();
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { user, isLoggedIn, isAuthReady } = useAuth();
  const { palette } = useAppTheme();
  const [preferences, setPreferences] =
    useState<Preferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<PreferenceKey | null>(null);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [summary, setSummary] = useState<ReminderSummary>({
    garageCars: 0,
    activeReminders: 0,
  });
  const [garageCars, setGarageCars] = useState<GarageCarOption[]>([]);
  const [reminderModal, setReminderModal] = useState(false);
  const [reminderType, setReminderType] =
    useState<ReminderType>("maintenance");
  const [reminderDate, setReminderDate] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [reminderKm, setReminderKm] = useState("");

  useEffect(() => {
    let isMounted = true;

    const fetchSettings = async () => {
      if (!isAuthReady) return;
      if (!isLoggedIn || !user?.id) {
        setLoading(false);
        router.replace(loginRoute("/profile-routes/notifications") as any);
        return;
      }

      const authUserId = await getAuthUserId();
      if (!authUserId) {
        setLoading(false);
        router.push(loginRoute("/profile-routes/notifications") as any);
        return;
      }

      setLoading(true);
      const [preferencesResult, garageResult, remindersResult] =
        await Promise.all([
          supabase
            .from("notification_preferences")
            .select(
              "user_id,push_enabled,email_enabled,maintenance_enabled,inspection_enabled,insurance_enabled,mtv_enabled,replies_enabled,likes_enabled,followed_enabled,weekly_digest_enabled,campaigns_enabled",
            )
            .eq("user_id", authUserId)
            .maybeSingle(),
          supabase
            .from("garage_cars")
            .select("id, brand, model")
            .eq("user_id", authUserId),
          supabase
            .from("vehicle_reminders")
            .select("id")
            .eq("user_id", authUserId)
            .eq("enabled", true),
        ]);

      if (!isMounted) return;

      if (preferencesResult.error) {
        const missing = isSchemaError(preferencesResult.error.message);

        setSchemaMissing(missing);
        if (!missing) {
          console.error(
            "Bildirim tercihleri alınamadı:",
            preferencesResult.error.message,
          );
        }
      } else {
        setSchemaMissing(false);
        if (preferencesResult.data) {
          setPreferences(pickPreferences(preferencesResult.data));
        } else {
          await supabase.from("profiles").upsert({
            id: authUserId,
            display_name: user.name,
            full_name: user.name,
            avatar_url: user.avatar || null,
          });

          const { error: insertPreferenceError } = await supabase
            .from("notification_preferences")
            .insert({
            user_id: authUserId,
            ...DEFAULT_PREFERENCES,
            });

          if (insertPreferenceError) {
            setSchemaMissing(isSchemaError(insertPreferenceError.message));
            console.error(
              "Varsayılan bildirim tercihleri oluşturulamadı:",
              insertPreferenceError.message,
            );
          }
        }
      }

      setSummary({
        garageCars: garageResult.error ? 0 : garageResult.data?.length || 0,
        activeReminders: remindersResult.error
          ? 0
          : remindersResult.data?.length || 0,
      });
      setGarageCars((garageResult.data || []) as GarageCarOption[]);
      setLoading(false);
    };

    fetchSettings();

    return () => {
      isMounted = false;
    };
  }, [isAuthReady, isLoggedIn, user?.id]);

  const updatePreference = async (key: PreferenceKey, value: boolean) => {
    if (!isLoggedIn || !user?.id) {
      router.push(loginRoute("/profile-routes/notifications") as any);
      return;
    }

    const authUserId = await getAuthUserId();
    if (!authUserId) {
      router.push(loginRoute("/profile-routes/notifications") as any);
      return;
    }

    setPreferences((prev) => ({ ...prev, [key]: value }));
    setSavingKey(key);
    const nextPreferences = pickPreferences({ ...preferences, [key]: value });

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: authUserId,
      display_name: user.name,
      full_name: user.name,
      avatar_url: user.avatar || null,
    });

    if (profileError) {
      setSavingKey(null);
      setPreferences((prev) => ({ ...prev, [key]: !value }));
      Alert.alert("Hata", "Profil kaydı hazırlanamadı: " + profileError.message);
      return;
    }

    const { error } = await supabase.from("notification_preferences").upsert(
      {
        user_id: authUserId,
        ...nextPreferences,
      },
      { onConflict: "user_id" },
    );

    setSavingKey(null);

    if (error) {
      setPreferences((prev) => ({ ...prev, [key]: !value }));
      const missing = isSchemaError(error.message);

      if (missing) {
        setSchemaMissing(true);
        Alert.alert(
          "Bildirim ayarları kullanılamıyor",
          "Tercihin şu anda kaydedilemiyor. Lütfen daha sonra tekrar dene.",
        );
        return;
      }

      Alert.alert("Hata", "Bildirim ayarı kaydedilemedi: " + error.message);
    }
  };

  const generateDueNotifications = async () => {
    const authUserId = await getAuthUserId();
    if (!authUserId) {
      router.push(loginRoute("/profile-routes/notifications") as any);
      return;
    }

    const { error } = await supabase.rpc(
      "generate_vehicle_reminder_notifications",
      { p_user_id: authUserId },
    );

    if (error) {
      if (isSchemaError(error.message)) {
        Alert.alert(
          "Hatırlatıcılar kullanılamıyor",
          "Yaklaşan hatırlatıcılar şu anda kontrol edilemiyor. Lütfen daha sonra tekrar dene.",
        );
      } else {
        Alert.alert("Hata", "Hatırlatıcılar kontrol edilemedi: " + error.message);
      }
      return;
    }

    Alert.alert(
      "Kontrol edildi",
      "Yaklaşan araç hatırlatıcıları bildirim listesine işlendi.",
    );
  };

  const resetReminderForm = () => {
    setReminderType("maintenance");
    setReminderDate("");
    setShowDatePicker(false);
    setReminderKm("");
  };

  const handleReminderDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }

    if (event.type === "set" && selectedDate) {
      setReminderDate(formatStorageDate(selectedDate));
    }
  };

  const saveReminder = async () => {
    if (!user?.id) {
      router.push(loginRoute("/profile-routes/notifications") as any);
      return;
    }

    const authUserId = await getAuthUserId();
    if (!authUserId) {
      router.push(loginRoute("/profile-routes/notifications") as any);
      return;
    }

    if (garageCars.length === 0) {
      Alert.alert(
        "Garaj gerekli",
        "Araç hatırlatıcısı oluşturmak için önce garajına araç eklemelisin.",
      );
      return;
    }

    const dueDate = reminderDate.trim();
    const dueKmText = reminderKm.replace(/[^0-9]/g, "");

    if (!dueDate && !dueKmText) {
      Alert.alert("Eksik bilgi", "Tarih veya kilometre bilgisinden en az biri gerekli.");
      return;
    }

    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      Alert.alert("Geçersiz tarih", "Geçerli bir hatırlatıcı tarihi seçmelisin.");
      return;
    }

    const selectedCar = garageCars[0];
    const typeLabel =
      REMINDER_TYPES.find((item) => item.key === reminderType)?.label ||
      "Hatırlatıcı";
    const carName = `${selectedCar.brand || ""} ${selectedCar.model || ""}`.trim();

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: authUserId,
      display_name: user.name,
      full_name: user.name,
      avatar_url: user.avatar || null,
    });

    if (profileError) {
      Alert.alert("Hata", "Profil kaydı hazırlanamadı: " + profileError.message);
      return;
    }

    const { error } = await supabase.from("vehicle_reminders").insert({
      user_id: authUserId,
      garage_car_id: selectedCar.id,
      type: reminderType,
      title: `${carName || "Aracım"} ${typeLabel}`,
      due_date: dueDate || null,
      due_km: dueKmText ? Number(dueKmText) : null,
      remind_before_days: 30,
      remind_before_km: 1000,
      enabled: true,
    });

    if (error) {
      if (isSchemaError(error.message)) {
        setSchemaMissing(true);
        Alert.alert(
          "Hatırlatıcı kaydedilemedi",
          "Araç hatırlatıcın şu anda oluşturulamıyor. Lütfen daha sonra tekrar dene.",
        );
      } else {
        Alert.alert("Hata", "Hatırlatıcı kaydedilemedi: " + error.message);
      }
      return;
    }

    setSummary((prev) => ({
      ...prev,
      activeReminders: prev.activeReminders + 1,
    }));
    setReminderModal(false);
    resetReminderForm();
  };

  const renderToggle = (
    key: PreferenceKey,
    title: string,
    description: string,
    isLast: boolean = false,
  ) => (
    <View>
      <View style={styles.row}>
        <View style={{ flex: 1, paddingRight: 16 }}>
          <Text style={[styles.value, { color: palette.text }]}>{title}</Text>
          <Text style={[styles.subLabel, { color: palette.muted }]}>
            {description}
          </Text>
        </View>
        {savingKey === key ? (
          <ActivityIndicator size="small" color={Colors.orange} />
        ) : (
          <Switch
            value={preferences[key]}
            onValueChange={(value) => updatePreference(key, value)}
            trackColor={{ false: palette.border, true: Colors.orange }}
            thumbColor={Colors.white}
            disabled={schemaMissing}
          />
        )}
      </View>
      {!isLast && (
        <View style={[styles.divider, { backgroundColor: palette.border }]} />
      )}
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: palette.background }]}
      edges={["top"]}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome6 name="arrow-left" size={20} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: palette.text }]}>
          Bildirim Ayarları
        </Text>
        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => router.push("/notifications-feed")}
        >
          <FontAwesome6 name="bell" size={16} color={palette.muted} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={Colors.orange} />
          </View>
        ) : null}

        {schemaMissing ? (
          <View style={styles.warningBox}>
            <FontAwesome6
              name="triangle-exclamation"
              size={18}
              color={Colors.orange}
            />
            <Text style={[styles.warningText, { color: palette.softText }]}>
              Bildirim tercihleri şu anda kullanılamıyor. Lütfen daha sonra
              tekrar dene.
            </Text>
          </View>
        ) : null}

        <Text style={[styles.sectionTitle, { color: palette.muted }]}>
          BİLDİRİM KANALLARI
        </Text>
        <View
          style={[
            styles.sectionBox,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          {renderToggle(
            "push_enabled",
            "Anlık Bildirimler",
            "Yeni etkileşimler ve önemli güncellemeler bildirim akışında gösterilsin.",
          )}
          {renderToggle(
            "email_enabled",
            "E-posta Bildirimleri",
            "Haftalık özetler ve kritik araç uyarıları e-posta ile gelsin.",
            true,
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: palette.muted }]}>
          ARAÇ VE HATIRLATICILAR
        </Text>
        <View
          style={[
            styles.sectionBox,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          {renderToggle(
            "maintenance_enabled",
            "Periyodik Bakım",
            "Bakım hatırlatıcısındaki tarih veya kilometre yaklaşınca haber ver.",
          )}
          {renderToggle(
            "inspection_enabled",
            "Muayene",
            "Muayene tarihinden önce bildirim oluştur.",
          )}
          {renderToggle(
            "insurance_enabled",
            "Sigorta ve Kasko",
            "Trafik sigortası veya kasko yenileme tarihinden önce hatırlat.",
          )}
          {renderToggle(
            "mtv_enabled",
            "MTV Dönemleri",
            "Ocak ve Temmuz ödeme dönemlerinde bildirim oluştur.",
            true,
          )}
        </View>

        <View
          style={[
            styles.reminderInfoCard,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <View style={styles.reminderInfoIcon}>
            <FontAwesome6 name="calendar-check" size={18} color={Colors.orange} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.reminderInfoTitle, { color: palette.text }]}>
              Hatırlatıcı altyapısı
            </Text>
            <Text style={[styles.reminderInfoText, { color: palette.muted }]}>
              Garajında {summary.garageCars} araç var. Aktif araç hatırlatıcısı:{" "}
              {summary.activeReminders}.
            </Text>
            <Text style={[styles.reminderInfoText, { color: palette.muted }]}>
              Bakım için tarih veya kilometre, muayene/sigorta için tarih,
              MTV için dönem takvimi kullanılır.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.checkBtn}
          activeOpacity={0.85}
          onPress={generateDueNotifications}
          disabled={schemaMissing}
        >
          <FontAwesome6 name="rotate" size={14} color={Colors.white} />
          <Text style={styles.checkBtnText}>Yaklaşanları Kontrol Et</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          activeOpacity={0.85}
          onPress={() => setReminderModal(true)}
          disabled={schemaMissing}
        >
          <FontAwesome6 name="plus" size={14} color={Colors.orange} />
          <Text style={styles.secondaryBtnText}>Araç Hatırlatıcısı Ekle</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { color: palette.muted }]}>
          TOPLULUK VE ETKİLEŞİM
        </Text>
        <View
          style={[
            styles.sectionBox,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          {renderToggle(
            "replies_enabled",
            "Yorumuma Gelen Yanıtlar",
            "Deneyimlerine veya yorumlarına biri cevap verdiğinde haber ver.",
          )}
          {renderToggle(
            "likes_enabled",
            "Faydalı Oylar",
            "Deneyimine, gönderine veya yorumuna kimin faydalı oy verdiğini bildir.",
          )}
          {renderToggle(
            "followed_enabled",
            "Takip Edilen Araçlar/Topluluklar",
            "Kaydettiğin araçlara veya takip ettiğin aramalara yeni içerik gelince haber ver.",
            true,
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: palette.muted }]}>
          SİSTEM VE KAMPANYALAR
        </Text>
        <View
          style={[
            styles.sectionBox,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          {renderToggle(
            "weekly_digest_enabled",
            "Haftalık Sektör Özeti",
            "Akaryakıt fiyat değişimleri ve haftanın popüler karşılaştırmaları.",
          )}
          {renderToggle(
            "campaigns_enabled",
            "Özel Kampanyalar",
            "Anlaşmalı servis ve istasyonlardaki indirim fırsatları.",
            true,
          )}
        </View>
      </ScrollView>

      <Modal visible={reminderModal} animationType="slide" transparent>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setReminderModal(false)}
        />
        <KeyboardAvoidingView
          style={styles.modalKeyboardAvoiding}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
          pointerEvents="box-none"
        >
        <View
          style={[
            styles.modalSheet,
            { backgroundColor: palette.background, borderTopColor: palette.border },
          ]}
        >
          <View style={[styles.modalHandle, { backgroundColor: palette.border }]} />
          <Text style={[styles.modalTitle, { color: palette.text }]}>
            Araç Hatırlatıcısı
          </Text>
          <Text style={[styles.modalSubtitle, { color: palette.muted }]}>
            Tarih veya kilometre yaklaşınca bildirim oluşturulur.
          </Text>

          <View style={styles.typeGrid}>
            {REMINDER_TYPES.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.typeChip,
                  { backgroundColor: palette.card, borderColor: palette.border },
                  reminderType === item.key && styles.typeChipActive,
                ]}
                onPress={() => setReminderType(item.key)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.typeChipText,
                    { color: palette.softText },
                    reminderType === item.key && styles.typeChipTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.inputLabel, { color: palette.text }]}>Tarih</Text>
          {Platform.OS === "web" ? (
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: palette.card,
                  borderColor: palette.border,
                  color: palette.text,
                },
              ]}
              placeholder="YYYY-AA-GG"
              placeholderTextColor={palette.muted}
              value={reminderDate}
              onChangeText={setReminderDate}
            />
          ) : (
            <View
              style={[
                styles.dateField,
                {
                  backgroundColor: palette.card,
                  borderColor: palette.border,
                },
              ]}
            >
              <TouchableOpacity
                style={styles.dateFieldButton}
                onPress={() => setShowDatePicker((current) => !current)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Hatırlatıcı tarihini seç"
              >
                <FontAwesome6
                  name="calendar-days"
                  size={16}
                  color={Colors.orange}
                />
                <Text
                  style={[
                    styles.dateFieldText,
                    { color: reminderDate ? palette.text : palette.muted },
                  ]}
                >
                  {reminderDate
                    ? parseStorageDate(reminderDate).toLocaleDateString(
                        "tr-TR",
                        {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        },
                      )
                    : "Tarih seç"}
                </Text>
              </TouchableOpacity>
              {reminderDate ? (
                <TouchableOpacity
                  style={styles.dateClearButton}
                  onPress={() => {
                    setReminderDate("");
                    setShowDatePicker(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Seçilen tarihi temizle"
                >
                  <FontAwesome6 name="xmark" size={16} color={palette.muted} />
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          {showDatePicker && Platform.OS !== "web" ? (
            <DateTimePicker
              value={parseStorageDate(reminderDate)}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              minimumDate={new Date()}
              locale="tr-TR"
              onChange={handleReminderDateChange}
            />
          ) : null}

          <Text style={[styles.inputLabel, { color: palette.text }]}>
            Kilometre
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: palette.card,
                borderColor: palette.border,
                color: palette.text,
              },
            ]}
            placeholder="örn: 90000"
            placeholderTextColor={palette.muted}
            value={reminderKm}
            onChangeText={setReminderKm}
            keyboardType="number-pad"
          />

          <TouchableOpacity
            style={styles.modalPrimaryBtn}
            activeOpacity={0.85}
            onPress={saveReminder}
          >
            <Text style={styles.modalPrimaryBtnText}>Kaydet</Text>
          </TouchableOpacity>
        </View>
        </KeyboardAvoidingView>
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
  headerAction: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: Colors.white },
  content: { padding: 20, paddingBottom: 60 },
  loadingBox: { paddingVertical: 12 },
  warningBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,101,0,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,101,0,0.32)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
  },
  warningText: { color: Colors.gray300, fontSize: 12, lineHeight: 17, flex: 1 },
  sectionTitle: {
    fontSize: 12,
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
    marginBottom: 24,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
  },
  divider: { height: 1, backgroundColor: Colors.navyBorder },
  value: { fontSize: 14, color: Colors.white, fontWeight: "600" },
  subLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
    lineHeight: 16,
  },
  reminderInfoCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: Colors.navyCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    padding: 16,
    marginTop: -8,
    marginBottom: 12,
  },
  reminderInfoIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,101,0,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  reminderInfoTitle: { color: Colors.white, fontSize: 14, fontWeight: "800" },
  reminderInfoText: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  checkBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.orange,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 24,
  },
  checkBtnText: { color: Colors.white, fontSize: 14, fontWeight: "800" },
  secondaryBtn: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,101,0,0.35)",
    backgroundColor: "rgba(255,101,0,0.08)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: -12,
    marginBottom: 24,
  },
  secondaryBtnText: { color: Colors.orange, fontSize: 14, fontWeight: "800" },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  modalKeyboardAvoiding: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalSheet: {
    width: "100%",
    backgroundColor: Colors.navyMain,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: Colors.navyBorder,
    padding: 22,
    paddingBottom: 36,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.navyBorder,
    alignSelf: "center",
    marginBottom: 18,
  },
  modalTitle: { color: Colors.white, fontSize: 20, fontWeight: "900" },
  modalSubtitle: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 18,
  },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  typeChip: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    backgroundColor: Colors.navyCard,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  typeChipActive: {
    borderColor: Colors.orange,
    backgroundColor: "rgba(255,101,0,0.14)",
  },
  typeChipText: { color: Colors.gray300, fontSize: 12, fontWeight: "700" },
  typeChipTextActive: { color: Colors.orange },
  inputLabel: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 10,
    marginBottom: 7,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    backgroundColor: Colors.navyCard,
    color: Colors.white,
    paddingHorizontal: 14,
  },
  dateField: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    backgroundColor: Colors.navyCard,
    flexDirection: "row",
    alignItems: "center",
  },
  dateFieldButton: {
    minHeight: 46,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
  },
  dateFieldText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
  dateClearButton: {
    width: 44,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  modalPrimaryBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.orange,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  modalPrimaryBtnText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: "900",
  },
});
