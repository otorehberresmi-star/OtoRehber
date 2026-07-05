import Colors from "@/constants/Colors";
import { FontAwesome6 } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AddReviewModal } from "../../components/AddReviewModal";
import { useAuth } from "../../contexts/AuthContext";
import { useReviews } from "../../contexts/ReviewContext";
import { supabase } from "../../supabaseClient";
import { useAppTheme } from "../../contexts/ThemeContext";
import { loginRoute, withSearchParams } from "../../utils/authRedirect";

// ─── Tipler ───────────────────────────────────────────────────────────────────
interface SupabaseReview {
  id: string;
  title: string;
  comment: string;
  rating: number;
  created_at: string;
  user?: string;
  avatar?: string;
  brand?: string;
  car?: string;
  recommend?: boolean;
}

interface SupabasePost {
  id: string;
  user_id?: string;
  car?: string;
  title: string;
  content: string;
  created_at: string;
  upvotes: number;
  comments: number;
  profiles?: {
    full_name?: string;
    avatar_url?: string;
  };
  user?: string; // Yedek
  avatar?: string; // Yedek
}

interface CarDetail {
  name: string;
  trim: string;
  rating: number;
  reviewsCount: number;
  recommendPercent: number;
  chronicIssues: string[];
}

const buildSearchLabel = (value?: string) =>
  (value || "Araç").replace(/-/g, " ").trim();

const firstParam = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.charAt(0) || "S";
  const last = parts.length > 1 ? parts[parts.length - 1]?.charAt(0) : "";
  return `${first}${last}`.toLocaleUpperCase("tr-TR");
};

const calculateRatingDistribution = (items: SupabaseReview[]) => {
  if (items.length === 0) {
    return [5, 4, 3, 2, 1].map((stars) => ({ stars, pct: 0 }));
  }

  return [5, 4, 3, 2, 1].map((stars) => {
    const count = items.filter((item) => Math.round(item.rating || 0) === stars)
      .length;
    return { stars, pct: Math.round((count / items.length) * 100) };
  });
};

const deriveChronicIssues = (
  reviewItems: SupabaseReview[],
  postItems: SupabasePost[],
) => {
  const text = [...reviewItems, ...postItems]
    .map((item: any) => `${item.title || ""} ${item.comment || ""} ${item.content || ""}`)
    .join(" ")
    .toLocaleLowerCase("tr-TR");

  const candidates = [
    { label: "Şanzıman / kavrama şikayetleri", keys: ["şanzıman", "sanziman", "dsg", "kavrama", "vites"] },
    { label: "Trim sesi ve iç mekan sesleri", keys: ["trim", "tıkırtı", "tikırtı", "ses", "gıcırtı"] },
    { label: "Elektrik ve multimedya sorunları", keys: ["elektrik", "ekran", "multimedya", "sensör", "sensor", "akü"] },
    { label: "Motor / soğutma sistemi şikayetleri", keys: ["motor", "hararet", "soğutma", "sogutma", "radyatör", "devirdaim"] },
    { label: "Yakıt tüketimi şikayetleri", keys: ["yakıt", "yakit", "tüketim", "lpg"] },
    { label: "Süspansiyon ve yol sesi", keys: ["süspansiyon", "suspansiyon", "amortisör", "yol sesi", "konfor"] },
  ];

  const matches = candidates
    .map((candidate) => ({
      label: candidate.label,
      score: candidate.keys.filter((key) => text.includes(key)).length,
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.label);

  return matches.length > 0 ? matches : ["Henüz yeterli kronik sorun verisi yok"];
};

const normalizeContentKey = (value?: string | number | null) =>
  String(value || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ");

const uniqueReviews = (items: SupabaseReview[]) => {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = [
      normalizeContentKey(item.user),
      normalizeContentKey(item.brand),
      normalizeContentKey(item.car),
      normalizeContentKey(item.title),
      normalizeContentKey(item.comment),
      normalizeContentKey(item.rating),
    ].join("|");

    const safeKey = key.replace(/\|/g, "").trim() ? key : `id:${item.id}`;
    if (seen.has(safeKey)) return false;
    seen.add(safeKey);
    return true;
  });
};

const uniquePosts = (items: SupabasePost[]) => {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = [
      normalizeContentKey(item.user_id || item.user),
      normalizeContentKey(item.car),
      normalizeContentKey(item.title),
      normalizeContentKey(item.content),
    ].join("|");

    const safeKey = key.replace(/\|/g, "").trim() ? key : `id:${item.id}`;
    if (seen.has(safeKey)) return false;
    seen.add(safeKey);
    return true;
  });
};

const withTimeout = async <T,>(
  promise: PromiseLike<T>,
  timeoutMs: number,
  label: string,
) =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} zaman aşımına uğradı.`)), timeoutMs);
    }),
  ]);

// ─── Ana Sayfa Bileşeni ───────────────────────────────────────────────────────
export default function TrendingCarDetailScreen() {
  const params = useLocalSearchParams<{
    model_id: string;
    brand?: string | string[];
    modelName?: string | string[];
    displayName?: string | string[];
  }>();
  const router = useRouter();
  const { palette } = useAppTheme();
  const { user, isLoggedIn } = useAuth();
  const { addReview } = useReviews();

  const [reviews, setReviews] = useState<SupabaseReview[]>([]);
  const [posts, setPosts] = useState<SupabasePost[]>([]);
  const [loading, setLoading] = useState(true);
  const modelId = firstParam(params.model_id);
  const initialBrandName = firstParam(params.brand) || "";
  const initialModelName = firstParam(params.modelName) || "";
  const initialDisplayNameParam = firstParam(params.displayName) || "";
  const initialDisplayName =
    initialDisplayNameParam ||
    `${initialBrandName} ${initialModelName}`.trim() ||
    buildSearchLabel(modelId);

  const [car, setCar] = useState<CarDetail>({
    name: initialDisplayName,
    trim: "Topluluk verileri",
    rating: 0,
    reviewsCount: 0,
    recommendPercent: 0,
    chronicIssues: ["Henüz yeterli kronik sorun verisi yok"],
  });
  const [isSaved, setIsSaved] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [isAddModalVisible, setAddModalVisible] = useState(false);

  const isUuidModelId =
    !!modelId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      modelId,
    );

  const fetchData = useCallback(
    async (showLoader = true) => {
      if (!modelId) return;
      if (showLoader) {
        setLoading(true);
      }
      try {
        let brandName = initialBrandName;
        let modelName =
          initialModelName ||
          (initialDisplayName !== buildSearchLabel(modelId)
            ? initialDisplayName
            : buildSearchLabel(modelId));

        if (isUuidModelId && (!brandName || !initialModelName)) {
          const { data: modelData, error: modelError } = await withTimeout(
            supabase
              .from("models")
              .select("id, name, brands(name)")
              .eq("id", modelId)
              .maybeSingle(),
            4500,
            "Model bilgisi",
          );

          if (!modelError && modelData) {
            modelName = modelData.name || modelName;
            brandName = (modelData.brands as any)?.name || brandName;
          }
        }

        const fullCarName =
          initialDisplayNameParam ||
          `${brandName} ${modelName}`.trim() ||
          modelName;
        const safeFullSearch = fullCarName.replace(/,/g, " ");
        const safeModelSearch = modelName.replace(/,/g, " ");
        const safeBrandSearch = brandName.replace(/,/g, " ");
        const reviewOrFilters = [
          `car.ilike.%${safeFullSearch}%`,
          `car.ilike.%${safeModelSearch}%`,
          `title.ilike.%${safeModelSearch}%`,
          `comment.ilike.%${safeModelSearch}%`,
          safeBrandSearch ? `brand.ilike.%${safeBrandSearch}%` : "",
        ]
          .filter(Boolean)
          .join(",");
        const postOrFilters = [
          `car.ilike.%${safeFullSearch}%`,
          `car.ilike.%${safeModelSearch}%`,
          `title.ilike.%${safeModelSearch}%`,
          `content.ilike.%${safeModelSearch}%`,
        ].join(",");

        let reviewsQuery = supabase
          .from("reviews")
          .select(
            "id,user,avatar,brand,car,title,comment,rating,recommend,created_at",
          )
          .not("user_id", "is", null);

        reviewsQuery = isUuidModelId
          ? reviewsQuery.eq("model_id", modelId)
          : reviewsQuery.or(reviewOrFilters);

        const { data: reviewsData, error: reviewsError } = await withTimeout(
          reviewsQuery.order("created_at", { ascending: false }).limit(20),
          4500,
          "Araç incelemeleri",
        );

        const dedupedReviews = uniqueReviews(
          reviewsError ? [] : ((reviewsData || []) as SupabaseReview[]),
        );

        if (!reviewsError) {
          setReviews(dedupedReviews);
        } else {
          setReviews([]);
        }

        let postsQuery = supabase
          .from("posts")
          .select(
            "id,user_id,user,avatar,car,title,content,upvotes,comments,created_at,model_id",
          );

        if (isUuidModelId) {
          postsQuery = postsQuery.eq("model_id", modelId);
        } else {
          postsQuery = postsQuery.or(postOrFilters);
        }

        const { data: postsData, error: postsError } = await withTimeout(
          postsQuery.order("created_at", { ascending: false }).limit(5),
          4500,
          "Topluluk gönderileri",
        );

        const dedupedPosts = uniquePosts(
          postsError ? [] : ((postsData || []) as SupabasePost[]),
        );

        if (!postsError && dedupedPosts.length > 0) {
          const userIds = Array.from(
            new Set(
              dedupedPosts
                .map((post) => post.user_id)
                .filter(Boolean) as string[],
            ),
          );
          let profilesById: Record<
            string,
            { full_name?: string; avatar_url?: string }
          > = {};

          if (userIds.length > 0) {
            const { data: publicProfilesData } = await withTimeout(
              supabase
                .from("public_profiles")
                .select("id, full_name, display_name, avatar_url")
                .in("id", userIds),
              4500,
              "Profil bilgileri",
            );

            profilesById = (publicProfilesData || []).reduce(
              (
                acc: Record<string, { full_name?: string; avatar_url?: string }>,
                profile: any,
              ) => {
                acc[profile.id] = {
                  full_name: profile.full_name || profile.display_name,
                  avatar_url: profile.avatar_url,
                };
                return acc;
              },
              {},
            );
          }

          setPosts(
            dedupedPosts.map((post) => ({
              ...post,
              profiles: post.user_id ? profilesById[post.user_id] : undefined,
            })),
          );
        } else {
          setPosts([]);
        }

        const visibleReviews = dedupedReviews;
        const visiblePosts = dedupedPosts;
        const ratedReviews = visibleReviews.filter((item) => Number(item.rating) > 0);
        const averageRating =
          ratedReviews.length > 0
            ? Number(
                (
                  ratedReviews.reduce(
                    (sum, item) => sum + Number(item.rating || 0),
                    0,
                  ) / ratedReviews.length
                ).toFixed(1),
              )
            : 0;
        const recommendReviews = visibleReviews.filter(
          (item) => item.recommend === true,
        ).length;
        const recommendPercent =
          visibleReviews.length > 0
            ? Math.round((recommendReviews / visibleReviews.length) * 100)
            : 0;
        setCar({
          name: fullCarName,
          trim:
            visibleReviews[0]?.title ||
            `${visibleReviews.length + visiblePosts.length} topluluk kaydı`,
          rating: averageRating,
          reviewsCount: visibleReviews.length,
          recommendPercent,
          chronicIssues: deriveChronicIssues(visibleReviews, visiblePosts),
        });
      } catch (e) {
        console.error("Veri çekilirken hata:", e);
        setReviews([]);
        setPosts([]);
        setCar((current) => ({
          ...current,
          trim: "Topluluk verileri hazırlanıyor",
          rating: 0,
          reviewsCount: 0,
          recommendPercent: 0,
          chronicIssues: ["Bu araç için henüz yeterli topluluk verisi yok"],
        }));
      } finally {
        setLoading(false);
      }
    },
    [
      initialBrandName,
      initialDisplayName,
      initialDisplayNameParam,
      initialModelName,
      isUuidModelId,
      modelId,
    ],
  );

  useEffect(() => {
    if (modelId) fetchData();
  }, [fetchData, modelId]);

  useFocusEffect(
    useCallback(() => {
      if (modelId) fetchData(false);
    }, [fetchData, modelId]),
  );

  useEffect(() => {
    const fetchSavedState = async () => {
      if (!user?.id || !modelId) {
        setIsSaved(false);
        setSavedId(null);
        return;
      }

      const { data, error } = await supabase
        .from("saved_cars")
        .select("id")
        .eq("user_id", user.id)
        .eq("car_key", modelId)
        .maybeSingle();

      if (error) {
        console.error("Kaydetme durumu alınamadı:", error.message);
        return;
      }

      setSavedId(data?.id || null);
      setIsSaved(!!data);
    };

    fetchSavedState();
  }, [modelId, user?.id]);

  const ratingDistribution = calculateRatingDistribution(reviews);

  const toggleBookmark = async () => {
    if (!isLoggedIn || !user?.id) {
      router.push(loginRoute(`/trending/${modelId}`) as any);
      return;
    }

    if (!modelId) return;

    if (isSaved && savedId) {
      const { error } = await supabase
        .from("saved_cars")
        .delete()
        .eq("id", savedId);

      if (error) {
        Alert.alert("Hata", "Araç kayıtlardan çıkarılamadı.");
        return;
      }

      setIsSaved(false);
      setSavedId(null);
      return;
    }

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: user.id,
      display_name: user.name,
      full_name: user.name,
      avatar_url: user.avatar || null,
    });

    if (profileError) {
      Alert.alert("Hata", "Profil kaydı hazırlanamadı.");
      return;
    }

    const payload = {
      user_id: user.id,
      car_key: modelId,
      model_id: isUuidModelId ? modelId : null,
      car_name: car.name,
      trim: car.trim,
      rating: car.rating,
      recommend_percent: car.recommendPercent,
      save_intent: "interested",
    };

    const { data: existingSavedCar, error: existingError } = await supabase
      .from("saved_cars")
      .select("id")
      .eq("user_id", user.id)
      .eq("car_key", modelId)
      .maybeSingle();

    if (existingError) {
      Alert.alert("Hata", "Kaydetme durumu kontrol edilemedi.");
      return;
    }

    const saveQuery = existingSavedCar?.id
      ? supabase
          .from("saved_cars")
          .update(payload)
          .eq("id", existingSavedCar.id)
          .select("id")
          .single()
      : supabase.from("saved_cars").insert(payload).select("id").single();

    const { data, error } = await saveQuery;

    if (error) {
      const isMissingSavedCarsColumn =
        error.message.includes("saved_cars.car_key") ||
        error.message.includes("saved_cars.car_name") ||
        error.message.includes("saved_cars.save_intent");

      if (isMissingSavedCarsColumn) {
        Alert.alert(
          "Araç bilgileri şu anda kullanılamıyor",
          "Araç şu anda kaydedilemiyor. Lütfen daha sonra tekrar dene.",
        );
        return;
      }

      Alert.alert("Hata", "Araç kaydedilemedi: " + error.message);
      return;
    }

    setSavedId(data.id);
    setIsSaved(true);
  };

  const renderReviewItem = ({ item: rev }: { item: SupabaseReview }) => (
    <View
      style={[
        styles.reviewItem,
        styles.reviewListItem,
        { borderBottomColor: palette.border },
      ]}
    >
      <View style={styles.reviewItemHeader}>
        <View style={styles.reviewStars}>
          {[1, 2, 3, 4, 5].map((s) => (
            <FontAwesome6
              key={s}
              name="star"
              size={10}
              solid={rev.rating >= s}
              color={rev.rating >= s ? Colors.orange : palette.border}
            />
          ))}
        </View>
        <Text style={[styles.reviewDate, { color: palette.muted }]}>
          {new Date(rev.created_at).toLocaleDateString("tr-TR")}
        </Text>
      </View>
      {rev.title && (
        <Text style={[styles.reviewTitle, { color: palette.text }]}>
          {rev.title}
        </Text>
      )}
      <Text style={[styles.reviewText, { color: palette.softText }]}>
        {rev.comment}
      </Text>
      <Text style={[styles.reviewUser, { color: palette.muted }]}>
        — {rev.user || "Kullanıcı"}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Üst Kısım: Yapışkan Geri & Kaydet Butonları ── */}
      <SafeAreaView
        style={[styles.headerWrapper, { backgroundColor: palette.background }]}
        edges={["top"]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.headerBtn, { backgroundColor: palette.card }]}
        >
          <FontAwesome6 name="arrow-left" size={18} color={palette.text} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={toggleBookmark}
          style={[styles.headerBtn, { backgroundColor: palette.card }]}
          activeOpacity={0.8}
        >
          <FontAwesome6
            name="bookmark"
            size={18}
            color={isSaved ? Colors.orange : palette.text}
            solid={isSaved}
          />
        </TouchableOpacity>
      </SafeAreaView>

      <FlatList
        data={loading ? [] : reviews}
        keyExtractor={(item) => item.id}
        renderItem={renderReviewItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={6}
        removeClippedSubviews
        ListHeaderComponent={
          <>
            {/* ── A. Araç Özet Kartı ── */}
            <View
              style={[
                styles.heroSection,
                { backgroundColor: palette.background },
              ]}
            >
              <View
                style={[
                  styles.heroCard,
                  { backgroundColor: palette.card, borderColor: palette.border },
                ]}
              >
                <View style={styles.heroTopRow}>
                  <View
                    style={[
                      styles.vehicleIconPill,
                      {
                        backgroundColor: palette.elevated,
                        borderColor: palette.border,
                      },
                    ]}
                  >
                    <FontAwesome6
                      name="car-side"
                      size={26}
                      color={Colors.orange}
                    />
                  </View>
                  <View style={styles.vehicleTitleBlock}>
                    <Text style={[styles.carName, { color: palette.text }]}>
                      {car.name}
                    </Text>
                    <Text style={[styles.carTrim, { color: palette.softText }]}>
                      {car.trim}
                    </Text>
                  </View>
                </View>

                <View style={styles.badgeRow}>
                  <View
                    style={[
                      styles.ratingBadge,
                      { backgroundColor: palette.elevated, borderColor: palette.border },
                    ]}
                  >
                    <FontAwesome6
                      name="star"
                      size={14}
                      color={Colors.orange}
                      solid
                    />
                    <Text style={[styles.ratingText, { color: palette.text }]}>
                      {car.rating}
                    </Text>
                    <Text style={[styles.reviewCountText, { color: palette.muted }]}>
                      ({car.reviewsCount} İnceleme)
                    </Text>
                  </View>
                  <View style={styles.recommendBadge}>
                    <FontAwesome6
                      name="thumbs-up"
                      size={12}
                      color="#4ade80"
                      solid
                    />
                    <Text style={styles.recommendText}>
                      %{car.recommendPercent} Tavsiye
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.contentSection}>
              {/* ── C. Sanayi Notları / Kronik Sorunlar ── */}
              <View
                style={[
                  styles.chronicCard,
                  { backgroundColor: palette.card },
                ]}
              >
                <View style={styles.sectionHeaderRow}>
                  <FontAwesome6 name="wrench" size={16} color="#f87171" />
                  <Text style={[styles.sectionTitle, { color: palette.text }]}>
                    Sanayi Rehberi & Kronikler
                  </Text>
                </View>
                <Text style={[styles.chronicDesc, { color: palette.softText }]}>
                  Topluluğun bu araçta en çok şikayet ettiği ve kronik kabul
                  edilen sorunlar:
                </Text>
                <View style={styles.chronicTags}>
                  {car.chronicIssues.map((issue: string, index: number) => (
                    <View key={index} style={styles.chronicBadge}>
                      <FontAwesome6
                        name="triangle-exclamation"
                        size={10}
                        color="#f87171"
                      />
                      <Text style={styles.chronicBadgeText}>{issue}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {loading ? (
                <View
                  style={[
                    styles.emptyState,
                    { backgroundColor: palette.card, borderColor: palette.border },
                  ]}
                >
                  <ActivityIndicator color={Colors.orange} />
                  <Text style={[styles.emptyStateText, { color: palette.softText }]}>
                    Araç deneyimleri yükleniyor. Veri gelmezse boş durum
                    gösterilecek.
                  </Text>
                </View>
              ) : (
                <View style={styles.sectionBox}>
                  <Text style={[styles.sectionTitle, { color: palette.text }]}>
                    Kullanıcı Değerlendirmeleri
                  </Text>

                  <View style={styles.ratingBarsContainer}>
                    {ratingDistribution.map((r) => (
                      <View key={r.stars} style={styles.ratingBarRow}>
                        <Text style={[styles.starLabel, { color: palette.softText }]}>
                          {r.stars}{" "}
                          <FontAwesome6
                            name="star"
                            size={9}
                            color={palette.muted}
                            solid
                          />
                        </Text>
                        <View
                          style={[
                            styles.barTrack,
                            { backgroundColor: palette.card },
                          ]}
                        >
                          <View
                            style={[styles.barFill, { width: `${r.pct}%` }]}
                          />
                        </View>
                        <Text style={[styles.pctLabel, { color: palette.muted }]}>
                          %{r.pct}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {reviews.length === 0 ? (
                  <View
                    style={[
                      styles.emptyState,
                      { backgroundColor: palette.card, borderColor: palette.border },
                    ]}
                  >
                    <View style={styles.emptyIconBox}>
                      <FontAwesome6
                        name="car-side"
                        size={32}
                        color={Colors.orange}
                      />
                    </View>
                    <Text style={[styles.emptyStateText, { color: palette.softText }]}>
                      Bu aracın henüz sanayi tecrübesi girilmemiş. İlk yorumu
                      yazarak topluluğa rehberlik etmeye ne dersin?
                    </Text>
                    <TouchableOpacity
                      style={styles.emptyStateBtn}
                      activeOpacity={0.8}
                      onPress={() => {
                        if (!isLoggedIn) {
                          router.push(loginRoute(`/trending/${modelId}`) as any);
                        }
                        else setAddModalVisible(true);
                      }}
                    >
                      <Text style={styles.emptyStateBtnText}>
                        İlk İncelemeyi Yaz
                      </Text>
                    </TouchableOpacity>
                  </View>
                  ) : null}
                </View>
              )}
            </View>
          </>
        }
        ListFooterComponent={
          loading ? null : (
            <View style={styles.contentSection}>
              {/* ── D. Topluluk Soruları & Tartışmalar (Posts) ── */}
              <View style={styles.sectionBox}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>
                  Bu Araç Hakkındaki Güncel Konular
                </Text>

                {posts.length > 0 ? (
                  posts.map((post) => {
                    // Profil verisini public_profiles view veya fallback verisinden çek
                    const authorName =
                      post.profiles?.full_name || post.user || "Anonim Üye";
                    const authorAvatar =
                      post.profiles?.avatar_url ||
                      post.avatar ||
                      "";

                    return (
                      <TouchableOpacity
                        key={post.id}
                        style={[
                          styles.postCard,
                          { backgroundColor: palette.card, borderColor: palette.border },
                        ]}
                        activeOpacity={0.7}
                        onPress={() => router.push(`/post/${post.id}` as any)}
                      >
                        <View style={styles.postHeader}>
                          {authorAvatar ? (
                            <Image
                              source={{ uri: authorAvatar }}
                              style={styles.postAvatar}
                            />
                          ) : (
                            <View
                              style={[
                                styles.postAvatarFallback,
                                {
                                  backgroundColor: palette.elevated,
                                  borderColor: palette.border,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.postAvatarFallbackText,
                                  { color: palette.text },
                                ]}
                              >
                                {getInitials(authorName)}
                              </Text>
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.postAuthor, { color: palette.text }]}>
                              {authorName}
                            </Text>
                            <Text style={[styles.postTime, { color: palette.muted }]}>
                              {new Date(post.created_at).toLocaleDateString(
                                "tr-TR",
                              )}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.postTitle, { color: palette.text }]}>
                          {post.title}
                        </Text>
                        <Text
                          style={[styles.postContent, { color: palette.softText }]}
                          numberOfLines={2}
                        >
                          {post.content}
                        </Text>

                        <View
                          style={[
                            styles.postFooter,
                            { borderTopColor: palette.border },
                          ]}
                        >
                          <View style={styles.postStat}>
                            <FontAwesome6
                              name="arrow-up"
                              size={12}
                              color={Colors.orange}
                            />
                            <Text style={[styles.postStatText, { color: palette.muted }]}>
                              {post.upvotes || 0}
                            </Text>
                          </View>
                          <View style={styles.postStat}>
                            <FontAwesome6
                              name="message"
                              size={12}
                              color={palette.muted}
                            />
                            <Text style={[styles.postStatText, { color: palette.muted }]}>
                              {post.comments || 0} Yorum
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <View
                    style={[
                      styles.emptyState,
                      { backgroundColor: palette.card, borderColor: palette.border },
                    ]}
                  >
                    <FontAwesome6
                      name="comments"
                      size={32}
                      color={palette.muted}
                    />
                    <Text style={[styles.emptyStateText, { color: palette.softText }]}>
                      Bu araç hakkında henüz bir tartışma başlatılmamış. Merak
                      ettiklerini sorabilirsin.
                    </Text>
                    <TouchableOpacity
                      style={styles.emptyStateBtn}
                      activeOpacity={0.8}
                      onPress={() => {
                        if (!isLoggedIn) {
                          router.push(
                            loginRoute(
                              withSearchParams("/post/create", {
                                mode: "vehicle-question",
                                modelId,
                                carName: car.name,
                              }),
                            ) as any,
                          );
                          return;
                        }

                        router.push({
                          pathname: "/post/create",
                          params: {
                            mode: "vehicle-question",
                            modelId,
                            carName: car.name,
                          },
                        } as any);
                      }}
                    >
                      <Text style={styles.emptyStateBtnText}>Soru Sor</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          )}
      />

      <AddReviewModal
        visible={isAddModalVisible}
        onClose={() => setAddModalVisible(false)}
        onSave={(rev) => {
          addReview(rev);
        }}
        userName={user?.name || "Sürücü"}
        userAvatar={user?.avatar || ""}
      />
    </View>
  );
}

// ─── Stiller ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.navyMain },
  scrollContent: { paddingBottom: 60 },

  headerWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  headerBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 20,
    marginTop: 16,
  },

  // Hero
  heroSection: {
    width: "100%",
    backgroundColor: Colors.navyMain,
    paddingTop: 108,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  heroCard: {
    padding: 20,
    backgroundColor: Colors.navyCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 18,
  },
  vehicleIconPill: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: Colors.navyMain,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  vehicleTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  carName: {
    fontSize: 24,
    fontWeight: "900",
    color: Colors.white,
  },
  carTrim: {
    fontSize: 14,
    color: Colors.gray300,
    marginTop: 4,
    lineHeight: 19,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    gap: 6,
  },
  ratingText: { color: Colors.white, fontWeight: "800", fontSize: 15 },
  reviewCountText: { color: Colors.textMuted, fontSize: 11 },
  recommendBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  recommendText: { color: "#4ade80", fontWeight: "700", fontSize: 12 },

  contentSection: {
    padding: 20,
  },

  // Chronic Card
  chronicCard: {
    backgroundColor: Colors.navyCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.3)", // Hafif kırmızımsı kenarlık
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.white,
  },
  chronicDesc: {
    fontSize: 12,
    color: Colors.gray300,
    marginBottom: 16,
    lineHeight: 18,
  },
  chronicTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chronicBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(248, 113, 113, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.2)",
    gap: 6,
  },
  chronicBadgeText: { color: "#f87171", fontSize: 12, fontWeight: "600" },

  // Sections (Reviews & Posts)
  sectionBox: { marginBottom: 32 },

  // Rating Bars
  ratingBarsContainer: { marginTop: 16, marginBottom: 24 },
  ratingBarRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  starLabel: {
    width: 30,
    fontSize: 12,
    color: Colors.gray300,
    fontWeight: "600",
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.navyCard,
    borderRadius: 4,
    marginHorizontal: 10,
    overflow: "hidden",
  },
  barFill: { height: "100%", backgroundColor: Colors.orange, borderRadius: 4 },
  pctLabel: {
    width: 35,
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: "right",
  },

  // Review Item
  reviewItem: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.navyBorder,
    paddingBottom: 16,
    marginBottom: 16,
  },
  reviewListItem: {
    marginHorizontal: 20,
  },
  reviewItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  reviewStars: { flexDirection: "row", gap: 3 },
  reviewDate: { fontSize: 11, color: Colors.textMuted },
  reviewTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.white,
    marginBottom: 6,
  },
  reviewText: {
    fontSize: 13,
    color: Colors.gray300,
    lineHeight: 20,
    marginBottom: 8,
  },
  reviewUser: { fontSize: 12, color: Colors.textMuted, fontStyle: "italic" },

  // Post Card
  postCard: {
    backgroundColor: Colors.navyCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    marginTop: 12,
  },
  postHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  postAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
    backgroundColor: Colors.navyBorder,
  },
  postAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  postAvatarFallbackText: {
    fontSize: 11,
    fontWeight: "900",
  },
  postAuthor: { fontSize: 13, fontWeight: "700", color: Colors.white },
  postTime: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  postTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.white,
    marginBottom: 6,
  },
  postContent: {
    fontSize: 13,
    color: Colors.gray300,
    lineHeight: 18,
    marginBottom: 12,
  },
  postFooter: {
    flexDirection: "row",
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.navyBorder,
  },
  postStat: { flexDirection: "row", alignItems: "center", gap: 6 },
  postStatText: { fontSize: 12, fontWeight: "600", color: Colors.textMuted },

  // Empty State
  emptyState: {
    alignItems: "center",
    backgroundColor: Colors.navyCard,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 16,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255, 101, 0, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyStateText: {
    color: Colors.gray300,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 22,
  },
  emptyStateBtn: {
    backgroundColor: Colors.orange,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    boxShadow: "0 4px 8px rgba(249, 115, 22, 0.3)",
    elevation: 4,
  },
  emptyStateBtnText: { color: Colors.white, fontSize: 14, fontWeight: "800" },
});
