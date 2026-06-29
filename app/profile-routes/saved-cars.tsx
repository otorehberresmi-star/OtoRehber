// app/saved-cars.tsx
// Kaydedilen Araçlar — Profil > Kaydedilen Araçlar menüsünden açılır
// Kalp/bookmark ile kaydedilen araçları listeler, filtreler, detaya gider

import Colors from "@/constants/Colors";
import { FontAwesome6 } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { useAppTheme } from "../../contexts/ThemeContext";
import { loginRoute } from "../../utils/authRedirect";

interface SavedCar {
  id: string;
  carKey?: string | null;
  modelId?: string | null;
  name: string;
  trim?: string | null;
  rating: number;
  recommendPercent: number;
  createdAt?: string;
  isSearchInterest?: boolean;
}

const titleCaseSearch = (value: string) =>
  value
    .replace(/^search:/i, "")
    .replace(/[-_]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((part) =>
      part.length <= 3
        ? part.toLocaleUpperCase("tr-TR")
        : `${part.charAt(0).toLocaleUpperCase("tr-TR")}${part.slice(1)}`,
    )
    .join(" ");

const isGenericTrim = (value?: string | null) => {
  const normalized = (value || "").trim().toLocaleLowerCase("tr-TR");
  return (
    !normalized ||
    normalized === "detayları gör" ||
    normalized.includes("yeni deneyim") ||
    normalized.includes("bildir")
  );
};

const normalizeSavedCar = (item: any): SavedCar => {
  const carKey = item.car_key || "";
  const isSearchInterest = carKey.startsWith("search:");
  const cleanSearchName = isSearchInterest ? titleCaseSearch(carKey) : "";
  const rawName = item.car_name || cleanSearchName || "Araç";
  const rawTrim = item.trim || null;

  if (isSearchInterest) {
    const candidates = [rawName, rawTrim, cleanSearchName]
      .filter((value) => value && !isGenericTrim(value))
      .map((value) => String(value).trim());
    const bestName =
      candidates.sort((a, b) => b.length - a.length)[0] || cleanSearchName || rawName;

    return {
      id: item.id,
      carKey: item.car_key,
      modelId: item.model_id,
      name: bestName,
      trim: null,
      rating: item.rating ? Number(item.rating) : 0,
      recommendPercent: item.recommend_percent ?? 0,
      createdAt: item.created_at,
      isSearchInterest,
    };
  }

  return {
    id: item.id,
    carKey: item.car_key,
    modelId: item.model_id,
    name: rawName,
    trim:
      isGenericTrim(rawTrim) ||
      String(rawTrim).trim().toLocaleLowerCase("tr-TR") ===
        String(rawName).trim().toLocaleLowerCase("tr-TR")
        ? null
        : rawTrim,
    rating: item.rating ? Number(item.rating) : 0,
    recommendPercent: item.recommend_percent ?? 0,
    createdAt: item.created_at,
    isSearchInterest,
  };
};

// ─── Araç Kartı ───────────────────────────────────────────────────────────────
function SavedCarCard({
  car,
  onPress,
  onRemove,
}: {
  car: SavedCar;
  onPress: () => void;
  onRemove: () => void;
}) {
  const { palette } = useAppTheme();
  const isGood = car.recommendPercent >= 80;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: palette.card, borderColor: palette.border },
      ]}
    >
      <View style={styles.cardContent}>
        <View style={styles.cardTop}>
          <TouchableOpacity
            onPress={onPress}
            style={[
              styles.cardIcon,
              { backgroundColor: palette.elevated, borderColor: palette.border },
            ]}
            activeOpacity={0.85}
          >
            <FontAwesome6 name="car-side" size={18} color={Colors.orange} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onPress} style={{ flex: 1 }}>
            <Text style={[styles.carName, { color: palette.text }]}>
              {car.name}
            </Text>
            {car.trim ? (
              <Text style={[styles.carTrim, { color: palette.muted }]}>
                {car.trim}
              </Text>
            ) : null}
            {car.rating > 0 ? (
              <View style={styles.ratingInline}>
                <FontAwesome6 name="star" size={9} color={Colors.orange} solid />
                <Text style={[styles.ratingText, { color: palette.softText }]}>
                  {car.rating}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>

          {/* Kaydetme butonu (dolu = kaydedildi) */}
          <TouchableOpacity onPress={onRemove} style={styles.bookmarkBtn}>
            <FontAwesome6
              name="bookmark"
              size={16}
              color={Colors.orange}
              solid
            />
          </TouchableOpacity>
        </View>

        {car.recommendPercent > 0 ? (
          <View style={styles.tagRow}>
            <View
              style={[
                isGood
                  ? styles.tagGreen
                  : [
                      styles.tagNeutral,
                      {
                        backgroundColor: palette.elevated,
                        borderColor: palette.border,
                      },
                    ],
              ]}
            >
              <Text
                style={
                  isGood
                    ? styles.tagGreenText
                    : [styles.tagNeutralText, { color: palette.muted }]
                }
              >
                %{car.recommendPercent} Tavsiye
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ─── Ana Ekran ────────────────────────────────────────────────────────────────
export default function SavedCarsScreen() {
  const router = useRouter();
  const { user, isAuthReady } = useAuth();
  const { palette } = useAppTheme();
  const [saved, setSaved] = useState<SavedCar[]>([]);
  const [loading, setLoading] = useState(true);
  const [schemaMissing, setSchemaMissing] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchSavedCars = async () => {
      if (!isAuthReady) return;
      if (!user?.id) {
        setSaved([]);
        setLoading(false);
        setSchemaMissing(false);
        router.replace(loginRoute("/profile-routes/saved-cars") as any);
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from("saved_cars")
        .select(
          "id, car_key, model_id, car_name, trim, rating, recommend_percent, save_intent, created_at",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        const isMissingSavedCarsColumn =
          error.message.includes("saved_cars.car_key") ||
          error.message.includes("saved_cars.save_intent") ||
          error.message.includes("saved_cars.car_name");

        if (isMissingSavedCarsColumn) {
          setSaved([]);
          setSchemaMissing(true);
        } else {
          console.error("Kaydedilen araçlar alınamadı:", error.message);
        }
      } else if (isMounted) {
        setSchemaMissing(false);
        setSaved((data || []).map(normalizeSavedCar));
      }

      if (isMounted) setLoading(false);
    };

    fetchSavedCars();

    return () => {
      isMounted = false;
    };
  }, [isAuthReady, user?.id]);

  const remove = async (id: string) => {
    const { error } = await supabase.from("saved_cars").delete().eq("id", id);
    if (error) {
      console.error("Kaydedilen araç silinemedi:", error.message);
      return;
    }
    setSaved((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: palette.background }]}
      edges={["top"]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[
            styles.backBtn,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <FontAwesome6 name="chevron-left" size={14} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: palette.text }]}>
          Kaydedilen Araçlar
        </Text>
        <View
          style={[
            styles.countBadge,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <Text style={[styles.countText, { color: palette.muted }]}>
            {saved.length} Araç
          </Text>
        </View>
      </View>

      {/* Liste */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {loading ? (
          <View style={styles.emptyFilter}>
            <ActivityIndicator size="large" color={Colors.orange} />
            <Text style={[styles.emptyFilterText, { color: palette.muted }]}>
              Kaydedilenler yükleniyor
            </Text>
          </View>
        ) : schemaMissing ? (
          <View style={styles.emptyFilter}>
            <FontAwesome6
              name="database"
              size={28}
              color={palette.muted}
            />
            <Text style={[styles.emptyFilterText, { color: palette.muted }]}>
              Kaydedilen araçlar şu anda kullanılamıyor
            </Text>
          </View>
        ) : saved.length === 0 ? (
          <View style={styles.emptyFilter}>
            <FontAwesome6 name="bookmark" size={28} color={palette.muted} />
            <Text style={[styles.emptyFilterText, { color: palette.muted }]}>
              Henüz kayıtlı araç yok
            </Text>
          </View>
        ) : (
          saved.map((car) => (
            <SavedCarCard
              key={car.id}
              car={car}
              onPress={() => {
                if (car.modelId) {
                  router.push(`/trending/${car.modelId}` as any);
                  return;
                }

                router.push({
                  pathname: "/",
                  params: { search: car.name },
                } as any);
              }}
              onRemove={() => remove(car.id)}
            />
          ))
        )}
      </ScrollView>

      {/* Alt bilgi */}
      {saved.length > 0 && (
        <View
          style={[
            styles.footer,
            {
              backgroundColor: palette.card,
              borderTopColor: palette.border,
            },
          ]}
        >
          <FontAwesome6 name="circle-info" size={11} color={palette.muted} />
          <Text style={[styles.footerText, { color: palette.muted }]}>
            Araç detayındaki kalp ikonuyla yeni araç ekleyebilirsin
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.navyMain },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.navyBorder,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.navyCard,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "800",
    color: Colors.white,
  },
  countBadge: {
    backgroundColor: Colors.navyCard,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  countText: { fontSize: 11, fontWeight: "700", color: Colors.textMuted },

  // Kart
  list: { paddingHorizontal: 20, paddingBottom: 100, gap: 14 },
  card: {
    backgroundColor: Colors.navyCard,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    boxShadow: "0 3px 6px rgba(0, 0, 0, 0.2)",
    elevation: 4,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  ratingText: { fontSize: 10, fontWeight: "700" },
  cardContent: { flex: 1, justifyContent: "space-between" },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  carName: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.white,
    letterSpacing: -0.3,
  },
  carTrim: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  bookmarkBtn: { padding: 4 },

  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  tagGreen: {
    backgroundColor: "rgba(34,197,94,0.12)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.25)",
  },
  tagGreenText: { fontSize: 10, color: "#4ade80", fontWeight: "700" },
  tagNeutral: {
    backgroundColor: Colors.navyMain,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  tagNeutralText: { fontSize: 10, color: Colors.textMuted, fontWeight: "700" },

  // Boş filtre
  emptyFilter: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyFilterText: { fontSize: 14, color: Colors.textMuted },

  // Footer
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.navyBorder,
    backgroundColor: Colors.navyMain,
  },
  footerText: { fontSize: 11, color: Colors.textMuted, flex: 1 },
});
