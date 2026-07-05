// app/(tabs)/index.tsx
// Keşfet Ekranı — Son Deneyimler "En Çok İncelenenler"in Hemen Üstünde

import Colors from "@/constants/Colors";
import { AddReviewModal } from "@/components/AddReviewModal";
import { FontAwesome6 } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import FilterSheet, {
  FilterState,
  defaultFilters,
} from "@/components/FilterSheet";
import VehicleCatalogPicker, {
  VehicleCatalogLevelSelection,
} from "@/components/VehicleCatalogPicker";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { useReviews } from "../../contexts/ReviewContext";
import { useAppTheme } from "../../contexts/ThemeContext";
import {
  normalizeCatalogText,
  VehicleCatalogSelection,
} from "../../utils/vehicleCatalog";
import { loginRoute } from "../../utils/authRedirect";

type TrendingCar = {
  id: string;
  brand: string;
  model: string;
  name: string;
  trim: string;
  rating: number;
  recommendPercent: number;
  featuredReview: string;
};

const buildTrendingRoute = (vehicle: {
  id: string;
  brand?: string;
  model?: string;
  name?: string;
}) => ({
  pathname: "/trending/[model_id]",
  params: {
    model_id: vehicle.id,
    brand: vehicle.brand || "",
    modelName: vehicle.model || "",
    displayName:
      vehicle.name ||
      `${vehicle.brand || ""} ${vehicle.model || ""}`.trim() ||
      "Araç",
  },
});

type ModelSuggestion = {
  id: string;
  brand: string;
  name: string;
  trim?: string;
  engineGroup?: string;
  fuelType?: string;
  transmission?: string;
};

type CompareSelection = ModelSuggestion | null;

type CompareBrand = {
  id: string;
  name: string;
};

// ─── Yardımcı Fonksiyonlar ────────────────────────────────────────────────────
type DailyComparisonCar = {
  modelId: string;
  name: string;
  brand: string;
  score: number;
  postsCount: number;
};

type DailyComparison = {
  id: string;
  dateKey: string;
  car1: DailyComparisonCar;
  car2: DailyComparisonCar;
};

const getInitials = (name: string) => {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g, "").charAt(0) || "U";
  const last =
    parts.length > 1
      ? parts[parts.length - 1]?.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g, "").charAt(0)
      : "";
  return `${first}${last}`.toLocaleUpperCase("tr-TR");
};

function countActive(f: FilterState) {
  return (
    [
      f.markalar || [],
      f.modeller || [],
      f.motorGruplari || [],
      f.donanimlar || [],
      f.yakitTipleri || [],
      f.vitesTipleri || [],
      f.renkler || [],
      f.cekisTipleri || [],
    ].reduce((acc, arr) => acc + arr.length, 0) +
    (f.yilMin || f.yilMax ? 1 : 0) +
    (f.kmMin || f.kmMax ? 1 : 0)
  );
}

function buildFilterInterestText(filters: FilterState) {
  const parts = [
    ...(filters.markalar || []),
    ...(filters.modeller || []),
    ...(filters.motorGruplari || []),
    ...(filters.donanimlar || []),
    ...(filters.yakitTipleri || []),
    ...(filters.vitesTipleri || []),
    ...(filters.renkler || []),
    ...(filters.cekisTipleri || []),
  ]
    .map((item) => item.trim())
    .filter(Boolean);

  if (filters.yilMin || filters.yilMax) {
    parts.push(
      `${filters.yilMin || "?"}-${filters.yilMax || "?"} model aralığı`,
    );
  }

  if (filters.kmMin || filters.kmMax) {
    parts.push(`${filters.kmMin || "?"}-${filters.kmMax || "?"} km aralığı`);
  }

  return parts.join(" ").trim();
}

const buildCarName = (brand: string, model: string) =>
  `${brand || "Bilinmeyen Marka"} ${model || "Model"}`.trim();

const buildCatalogFallbackId = (...parts: Array<string | undefined>) =>
  `catalog_${parts
    .map((part) =>
      String(part || "")
        .trim()
        .toLocaleLowerCase("tr-TR")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, ""),
    )
    .filter(Boolean)
    .join("_")}`;

const buildCompareSelectionLabel = (selection: ModelSuggestion) =>
  [
    buildCarName(selection.brand, selection.name),
    selection.engineGroup,
    selection.trim,
  ]
    .filter(Boolean)
    .join(" · ");

// ─── Bileşenler ────────────────────────────────────────────────────────────────
function ComparisonCard({
  comparison,
  loading,
}: {
  comparison: DailyComparison | null;
  loading: boolean;
}) {
  const router = useRouter();
  const { palette } = useAppTheme();

  if (loading) {
    return (
      <View
        style={[
          styles.comparisonCard,
          styles.comparisonLoading,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        <ActivityIndicator size="small" color={Colors.orange} />
      </View>
    );
  }

  if (!comparison) {
    return (
      <View
        style={[
          styles.comparisonCard,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        <View style={styles.emptyIconWrapper}>
          <FontAwesome6 name="scale-balanced" size={22} color={Colors.orange} />
        </View>
        <Text style={[styles.emptyTitle, { color: palette.text }]}>
          Karşılaştırma için veri yok
        </Text>
        <Text style={[styles.emptySubtitle, { color: palette.muted }]}>
          Günün karşılaştırması için en az iki araç modeli gerekiyor.
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.comparisonCard,
        styles.comparisonCardFeatured,
      ]}
    >
      <View style={styles.comparisonRow}>
        <View style={styles.comparisonCar}>
          <View
            style={[
              styles.comparisonIconBox,
              styles.comparisonIconBoxFeatured,
            ]}
          >
            <FontAwesome6 name="car-side" size={22} color={Colors.white} />
          </View>
          <Text
            style={[styles.comparisonCarName, styles.comparisonTextFeatured]}
            numberOfLines={2}
          >
            {buildCarName(comparison.car1.brand, comparison.car1.name)}
          </Text>
          <View style={styles.ratingRow}>
            <FontAwesome6 name="comments" size={9} color={Colors.white} />
            <Text style={[styles.ratingText, styles.comparisonMetaFeatured]}>
              {comparison.car1.postsCount} konu
            </Text>
          </View>
        </View>
        <View style={styles.vsBadge}>
          <Text style={styles.vsText}>VS</Text>
        </View>
        <View style={styles.comparisonCar}>
          <View
            style={[
              styles.comparisonIconBox,
              styles.comparisonIconBoxFeatured,
            ]}
          >
            <FontAwesome6 name="car-side" size={22} color={Colors.white} />
          </View>
          <Text
            style={[styles.comparisonCarName, styles.comparisonTextFeatured]}
            numberOfLines={2}
          >
            {buildCarName(comparison.car2.brand, comparison.car2.name)}
          </Text>
          <View style={styles.ratingRow}>
            <FontAwesome6 name="comments" size={9} color={Colors.white} />
            <Text style={[styles.ratingText, styles.comparisonMetaFeatured]}>
              {comparison.car2.postsCount} konu
            </Text>
          </View>
        </View>
      </View>
      <TouchableOpacity
        style={[
          styles.compareBtn,
          styles.compareBtnFeatured,
        ]}
        activeOpacity={0.8}
        onPress={() =>
          router.push({
            pathname: "/comparison/[id]",
            params: {
              id: comparison.id,
              car1Id: comparison.car1.modelId,
              car2Id: comparison.car2.modelId,
              car1Name: buildCarName(comparison.car1.brand, comparison.car1.name),
              car2Name: buildCarName(comparison.car2.brand, comparison.car2.name),
            },
          } as any)
        }
      >
        <Text style={[styles.compareBtnText, styles.compareBtnTextFeatured]}>
          Detaylı Kıyasla
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function TrendingCarCard({ car }: { car: TrendingCar }) {
  const router = useRouter();
  const { palette } = useAppTheme();
  return (
    <Pressable
      onPress={() => router.push(buildTrendingRoute(car) as any)}
      style={({ pressed }) => [
        styles.trendCard,
        { backgroundColor: palette.card, borderColor: palette.border },
        pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
      ]}
    >
      <View
        style={[
          styles.trendIconWrapper,
          {
            backgroundColor: palette.elevated,
            borderBottomColor: palette.border,
          },
        ]}
      >
        <FontAwesome6 name="car-side" size={30} color={Colors.orange} />
        <View style={styles.trendRatingBadge}>
          <FontAwesome6 name="star" size={9} color={Colors.orange} solid />
          <Text style={styles.trendRatingText}>{car.rating}</Text>
        </View>
      </View>
      <View style={styles.trendContent}>
        <View style={styles.trendHeader}>
          <View>
            <Text style={[styles.trendCarName, { color: palette.text }]}>
              {car.name}
            </Text>
            <Text style={[styles.trendCarTrim, { color: palette.muted }]}>
              {car.trim}
            </Text>
          </View>
          {car.recommendPercent > 0 ? (
            <View style={styles.recommendBadge}>
              <Text style={styles.recommendText}>
                %{car.recommendPercent} Tavsiye
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.trendReview} numberOfLines={2}>
          <Text style={[styles.trendReviewLabel, { color: palette.text }]}>
            Öne Çıkan Yorum:{" "}
          </Text>
          {car.featuredReview}
        </Text>
      </View>
    </Pressable>
  );
}

function ExperienceCard({
  review,
  onPress,
}: {
  review: any;
  onPress?: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { palette } = useAppTheme();
  const title = review.title?.trim();
  const comment = review.comment?.trim();

  const isMyReview =
    Boolean(user?.id && review.userId === user.id) || review.user === user?.name;
  const displayAvatar = isMyReview
    ? user?.avatar || review.avatar
    : review.avatar;

  const hasValidAvatar =
    displayAvatar &&
    !displayAvatar.includes("ui-avatars.com") &&
    !displayAvatar.includes("pravatar.cc") &&
    !displayAvatar.includes("placeholder");

  return (
    <TouchableOpacity
      style={[
        styles.expCard,
        { backgroundColor: palette.card, borderColor: palette.border },
      ]}
      activeOpacity={0.7}
      onPress={
        onPress ||
        (() => {
          if (review.sourceType === "post") {
            router.push(`/post/${review.sourceId || review.id.replace("post:", "")}` as any);
            return;
          }

          router.push({
            pathname: `/review/${review.sourceId || review.id}`,
            params: { fallbackData: JSON.stringify(review) },
          } as any);
        })
      }
    >
      <View style={styles.expHeader}>
        {hasValidAvatar ? (
          <Image source={{ uri: displayAvatar }} style={styles.expAvatar} />
        ) : (
          <View
            style={[
              styles.expAvatar,
              {
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: palette.elevated,
                borderWidth: 1,
                borderColor: palette.border,
              },
            ]}
          >
            <Text
              style={{ color: palette.text, fontSize: 14, fontWeight: "bold" }}
            >
              {getInitials(review.user)}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.expUser, { color: palette.text }]}>
            {review.user}
          </Text>
          <Text style={styles.expCarInfo}>{review.car}</Text>
        </View>
        <Text style={[styles.expDate, { color: palette.muted }]}>
          {review.date}
        </Text>
      </View>
      {title ? (
        <Text style={[styles.expTitle, { color: palette.text }]}>{title}</Text>
      ) : null}
      {comment ? (
        <Text
          style={[styles.expComment, { color: palette.softText }]}
          numberOfLines={3}
        >
          {comment}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Ana Ekran ─────────────────────────────────────────────────────────────────
export default function DiscoverScreen() {
  const params = useLocalSearchParams<{ search?: string }>();
  const { palette } = useAppTheme();
  const [filterVisible, setFilterVisible] = useState(false);
  const [activeFilters, setActiveFilters] =
    useState<FilterState>(defaultFilters);
  const normalizedActiveFilters = useMemo<FilterState>(
    () => ({ ...defaultFilters, ...activeFilters }),
    [activeFilters],
  );
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<TextInput>(null);
  const searchParam = Array.isArray(params.search)
    ? params.search[0]
    : params.search;
  const activeCount = countActive(normalizedActiveFilters);
  const followableSearchText = useMemo(() => {
    const typedSearch = searchQuery.trim();
    if (typedSearch.length > 0) return typedSearch;

    return buildFilterInterestText(normalizedActiveFilters);
  }, [normalizedActiveFilters, searchQuery]);
  const router = useRouter();
  const { reviews, addReview, refreshReviews } = useReviews();
  const recentReviews = useMemo(() => reviews.slice(0, 5), [reviews]);

  useEffect(() => {
    if (!searchParam) return;
    const nextSearch = String(searchParam).trim();
    if (nextSearch) {
      setSearchQuery(nextSearch);
    }
  }, [searchParam]);

  useFocusEffect(
    useCallback(() => {
      void refreshReviews();
    }, [refreshReviews]),
  );
  const { user, isLoggedIn } = useAuth();
  const [isAddModalVisible, setAddModalVisible] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // --- Supabase Dinamik Filtreleme State'leri ---
  const [filteredPosts, setFilteredPosts] = useState<any[]>([]);
  const [modelSuggestions, setModelSuggestions] = useState<ModelSuggestion[]>(
    [],
  );
  const [isFiltering, setIsFiltering] = useState(false);
  const [isSavingInterest, setIsSavingInterest] = useState(false);
  const [followedSearchKey, setFollowedSearchKey] = useState<string | null>(
    null,
  );
  const currentFollowableSearchKey = followableSearchText
    ? `search:${followableSearchText.toLocaleLowerCase("tr-TR")}`
    : "";
  const isCurrentSearchFollowed =
    !!currentFollowableSearchKey && followedSearchKey === currentFollowableSearchKey;
  const [dailyComparison, setDailyComparison] =
    useState<DailyComparison | null>(null);
  const [isLoadingComparison, setIsLoadingComparison] = useState(false);
  const [compareSelections, setCompareSelections] = useState<
    [CompareSelection, CompareSelection]
  >([null, null]);
  const [comparePickerSlot, setComparePickerSlot] = useState<0 | 1 | null>(null);
  const [catalogPickerSlot, setCatalogPickerSlot] = useState<0 | 1 | null>(null);
  const [comparePickerStep, setComparePickerStep] = useState<"brand" | "model">(
    "brand",
  );
  const [compareBrands, setCompareBrands] = useState<CompareBrand[]>([]);
  const [compareSelectedBrand, setCompareSelectedBrand] =
    useState<CompareBrand | null>(null);
  const [compareSearch, setCompareSearch] = useState("");
  const [compareCatalogModels, setCompareCatalogModels] = useState<
    ModelSuggestion[]
  >([]);
  const [isLoadingCompareCatalog, setIsLoadingCompareCatalog] = useState(false);
  const [trendingCars, setTrendingCars] = useState<TrendingCar[]>([]);
  const [isLoadingTrending, setIsLoadingTrending] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchCompareCatalog = async () => {
      if (comparePickerSlot === null) return;

      setIsLoadingCompareCatalog(true);
      try {
        if (comparePickerStep === "brand") {
          const { data, error } = await supabase
            .from("brands")
            .select("id, name")
            .order("name", { ascending: true });

          if (error) {
            console.error(
              "Kıyaslama marka listesi alınamadı:",
              error.message,
            );
          } else if (isMounted) {
            setCompareBrands(
              (data || []).map((brand: any) => ({
                id: brand.id,
                name: brand.name,
              })),
            );
          }
          return;
        }

        if (!compareSelectedBrand) {
          if (isMounted) setCompareCatalogModels([]);
          return;
        }

        const { data, error } = await supabase
          .from("models")
          .select("id, name")
          .eq("brand_id", compareSelectedBrand.id)
          .order("name", { ascending: true });

        if (error) {
          console.error("Kıyaslama model listesi alınamadı:", error.message);
        } else if (isMounted) {
          setCompareCatalogModels(
            (data || []).map((model: any) => ({
              id: model.id,
              name: model.name,
              brand: compareSelectedBrand.name,
            })),
          );
        }
      } finally {
        if (isMounted) setIsLoadingCompareCatalog(false);
      }
    };

    void fetchCompareCatalog();

    return () => {
      isMounted = false;
    };
  }, [comparePickerSlot, comparePickerStep, compareSelectedBrand]);

  const filteredCompareBrands = useMemo(() => {
    const query = compareSearch.trim().toLocaleLowerCase("tr-TR");
    if (!query) return compareBrands;
    return compareBrands.filter((brand) =>
      brand.name.toLocaleLowerCase("tr-TR").includes(query),
    );
  }, [compareBrands, compareSearch]);

  const filteredCompareModels = useMemo(() => {
    const query = compareSearch.trim().toLocaleLowerCase("tr-TR");
    if (!query) return compareCatalogModels;
    return compareCatalogModels.filter((model) =>
      model.name.toLocaleLowerCase("tr-TR").includes(query),
    );
  }, [compareCatalogModels, compareSearch]);

  useEffect(() => {
    let isMounted = true;

    const fetchTrendingCars = async () => {
      setIsLoadingTrending(true);

      const { data, error } = await supabase.rpc("get_discover_trending_cars", {
        p_limit: 5,
        p_days: 30,
      });

      if (error) {
        console.error("Trend araçlar alınamadı:", error.message);
        if (isMounted) {
          setTrendingCars([]);
          setIsLoadingTrending(false);
        }
        return;
      }

      const nextTrending: TrendingCar[] = (data || []).map((item: any) => {
        const brand = item.brand || "";
        const modelName = item.model || "Model";
        const reviewCount = Number(item.review_count || 0);
        const searchCount = Number(item.search_count || 0);

        return {
          id: item.model_id,
          brand,
          model: modelName,
          name: `${brand} ${modelName}`.trim(),
          trim: `${reviewCount} yorum • ${searchCount} arama`,
          rating: Number(item.average_rating || 0),
          recommendPercent: Number(item.recommend_percent || 0),
          featuredReview:
            item.featured_review || "Bu araç son dönemde daha çok aranıyor.",
        };
      });

      if (isMounted) {
        setTrendingCars(nextTrending);
        setIsLoadingTrending(false);
      }
    };

    fetchTrendingCars();

    return () => {
      isMounted = false;
    };
  }, [refreshTrigger]);

  useEffect(() => {
    let isMounted = true;

    const fetchDailyComparison = async () => {
      setIsLoadingComparison(true);

      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase.rpc("get_daily_comparison", {
        p_date: today,
      });

      if (error) {
        console.error("Günün karşılaştırması alınamadı:", error.message);
        if (isMounted) {
          setDailyComparison(null);
          setIsLoadingComparison(false);
        }
        return;
      }

      const rows = (data || []) as any[];

      if (rows.length < 2) {
        if (isMounted) {
          setDailyComparison(null);
          setIsLoadingComparison(false);
        }
        return;
      }

      const first = rows.find((item) => Number(item.slot) === 1) || rows[0];
      const second = rows.find((item) => Number(item.slot) === 2) || rows[1];

      const car1 = {
        modelId: first.model_id,
        name: first.model || "Model",
        brand: first.brand || "Bilinmeyen Marka",
        postsCount: Number(first.posts_count || 0),
        score: Number(first.score || 0),
      };
      const car2 = {
        modelId: second.model_id,
        name: second.model || "Model",
        brand: second.brand || "Bilinmeyen Marka",
        postsCount: Number(second.posts_count || 0),
        score: Number(second.score || 0),
      };
      const dateKey = first.date_key || new Date().toISOString().slice(0, 10);

      if (isMounted) {
        setDailyComparison({
          id: `${dateKey}_${car1.modelId}_vs_${car2.modelId}`,
          dateKey,
          car1,
          car2,
        });
        setIsLoadingComparison(false);
      }
    };

    fetchDailyComparison();

    return () => {
      isMounted = false;
    };
  }, [refreshTrigger]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshReviews();
      setRefreshTrigger((prev) => prev + 1);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshReviews]);

  // 1. Filtreler değiştiğinde verileri dinamik olarak Supabase'den çek
  useEffect(() => {
    let isMounted = true;

    const fetchFilteredPosts = async () => {
      // Eğer filtre seçili değilse ve arama yapılmadıysa listeyi temizle
      if (activeCount === 0 && searchQuery.trim().length === 0) {
        if (isMounted) {
          setFilteredPosts([]);
          setModelSuggestions([]);
        }
        return;
      }

      if (isMounted) setIsFiltering(true);
      try {
        const safeSearchQuery = searchQuery.trim().replace(/,/g, " ");
        const normalizedSearchQuery = normalizeCatalogText(safeSearchQuery);

        if (safeSearchQuery.length >= 2) {
          const brandResult = await supabase
            .from("brands")
            .select("id, name")
            .ilike("search_text", `%${normalizedSearchQuery}%`)
            .limit(10);

          if (brandResult.error) {
            console.error(
              "Arama marka önerileri alınamadı:",
              brandResult.error.message,
            );
          }

          const brandIds = (brandResult.data || []).map((brand: any) => brand.id);
          const brandNamesById = new Map(
            (brandResult.data || []).map((brand: any) => [brand.id, brand.name]),
          );

          const modelsByNameQuery = supabase
            .from("models")
            .select("id, name, brand_id, brands(name)")
            .ilike("search_text", `%${normalizedSearchQuery}%`)
            .order("name", { ascending: true })
            .limit(20);

          const modelsByBrandQuery =
            brandIds.length > 0
              ? supabase
                  .from("models")
                  .select("id, name, brand_id, brands(name)")
                  .in("brand_id", brandIds)
                  .order("name", { ascending: true })
                  .limit(30)
              : Promise.resolve({ data: [], error: null });

          const [modelsByNameResult, modelsByBrandResult]: any =
            await Promise.all([modelsByNameQuery, modelsByBrandQuery]);

          if (modelsByNameResult.error) {
            console.error(
              "Arama model önerileri alınamadı:",
              modelsByNameResult.error.message,
            );
          }
          if (modelsByBrandResult.error) {
            console.error(
              "Markaya bağlı model önerileri alınamadı:",
              modelsByBrandResult.error.message,
            );
          }

          const suggestionsById = new Map<string, ModelSuggestion>();
          [...(modelsByBrandResult.data || []), ...(modelsByNameResult.data || [])]
            .filter((model: any) => model?.id && model?.name)
            .forEach((model: any) => {
              const relationBrand = Array.isArray(model.brands)
                ? model.brands[0]?.name
                : model.brands?.name;
              suggestionsById.set(model.id, {
                id: model.id,
                brand:
                  relationBrand ||
                  brandNamesById.get(model.brand_id) ||
                  "Bilinmeyen Marka",
                name: model.name,
              });
            });

          if (isMounted) {
            setModelSuggestions(Array.from(suggestionsById.values()).slice(0, 12));
          }
        } else if (isMounted) {
          setModelSuggestions([]);
        }

        // Posts ve Reviews birlikte aranır. Ana sayfadaki artı butonu posts,
        // profil deneyim modalı ise reviews kaydını detaylı veri olarak üretir.
        let postQuery: any = supabase
          .from("posts")
          .select(
            "id,user,avatar,car,title,content,created_at,user_id,model_id,community_id",
          )
          .not("user_id", "is", null)
          .is("community_id", null);

        let reviewQuery: any = supabase
          .from("reviews")
          .select(
            "id,user,avatar,brand,car,title,comment,created_at,date,user_id,model_id,rating",
          )
          .not("user_id", "is", null);

        // Arama Çubuğu Filtresi (Araç modeli, başlık veya içeriğinde arar)
        if (searchQuery.trim().length > 0) {
          const safeQuery = searchQuery.trim().replace(/,/g, ""); // Supabase hatasını önlemek için virgülleri sil
          const sq = `%${normalizeCatalogText(safeQuery)}%`;
          postQuery = postQuery.ilike("search_text", sq);
          reviewQuery = reviewQuery.ilike("search_text", sq);
        }

        // Doğrudan Filtre Seçimlerinden Gelen İsimlerle (Text) Eşleştir
        if (normalizedActiveFilters.markalar.length > 0) {
          const brandOrFilters = normalizedActiveFilters.markalar
            .map((m) => `search_text.ilike.%${normalizeCatalogText(m)}%`)
            .join(",");
          const reviewBrandOrFilters = normalizedActiveFilters.markalar
            .map((m) => `search_text.ilike.%${normalizeCatalogText(m)}%`)
            .join(",");
          postQuery = postQuery.or(brandOrFilters);
          reviewQuery = reviewQuery.or(reviewBrandOrFilters);
        }
        if (normalizedActiveFilters.modeller.length > 0) {
          const modelOrFilters = normalizedActiveFilters.modeller
            .map((m) => `search_text.ilike.%${normalizeCatalogText(m)}%`)
            .join(",");
          postQuery = postQuery.or(modelOrFilters);
          reviewQuery = reviewQuery.or(modelOrFilters);
        }
        if (normalizedActiveFilters.motorGruplari.length > 0) {
          normalizedActiveFilters.motorGruplari.forEach((engine) => {
            const normalizedEngine = `%${normalizeCatalogText(engine)}%`;
            postQuery = postQuery.ilike("search_text", normalizedEngine);
            reviewQuery = reviewQuery.ilike("search_text", normalizedEngine);
          });
        }
        if (normalizedActiveFilters.donanimlar.length > 0) {
          normalizedActiveFilters.donanimlar.forEach((trim) => {
            const normalizedTrim = `%${normalizeCatalogText(trim)}%`;
            postQuery = postQuery.ilike("search_text", normalizedTrim);
            reviewQuery = reviewQuery.ilike("search_text", normalizedTrim);
          });
        }

        const [postsResult, reviewsResult]: any = await Promise.all([
          postQuery.order("created_at", { ascending: false }).limit(50),
          reviewQuery.order("created_at", { ascending: false }).limit(50),
        ]);

        if (postsResult.error) {
          console.error("Gönderiler çekilirken hata:", postsResult.error.message);
        }
        if (reviewsResult.error) {
          console.error("Deneyimler çekilirken hata:", reviewsResult.error.message);
        }

        const postsData = postsResult.data || [];
        const reviewsData = reviewsResult.data || [];

        if (isMounted) {
          const modelIds = Array.from(
            new Set(
              [...postsData, ...reviewsData]
                .map((item: any) => item.model_id)
                .filter(Boolean),
            ),
          );
          let modelNamesById: Record<string, string> = {};

          if (modelIds.length > 0) {
            const { data: modelRows, error: modelLookupError } = await supabase
              .from("models")
              .select("id, name, brands(name)")
              .in("id", modelIds);

            if (modelLookupError) {
              console.error(
                "Araç marka/model bilgisi alınamadı:",
                modelLookupError.message,
              );
            } else {
              modelNamesById = (modelRows || []).reduce(
                (acc: Record<string, string>, model: any) => {
                  const brandName = model.brands?.name || "";
                  const modelName = model.name || "";
                  acc[model.id] = `${brandName} ${modelName}`.trim();
                  return acc;
                },
                {},
              );
            }
          }

          const isCleanResult = (item: any) => {
            const combined = [
              item.user,
              item.avatar,
              item.brand,
              item.car,
              item.title,
              item.content,
              item.comment,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

            return (
              !combined.includes("test kullanıcısı") &&
              !combined.includes("pravatar") &&
              !combined.includes("placeholder") &&
              !combined.includes("audi a3 sınıfının en konforlu")
            );
          };

          const formattedPosts = postsData
            .filter(isCleanResult)
            .map((item: any) => ({
              id: `post:${item.id}`,
              sourceId: item.id,
              sourceType: "post",
              userId: item.user_id,
              user: item.user || "Anonim Kullanıcı",
              avatar: item.avatar,
              car:
                item.car ||
                (item.model_id ? modelNamesById[item.model_id] : "") ||
                "Araç bilgisi eklenmemiş",
              date: item.created_at
                ? new Date(item.created_at).toLocaleDateString("tr-TR")
                : "Yeni",
              title: item.title || "",
              comment: item.content || "",
              modelId: item.model_id || null,
              createdAt: item.created_at || null,
            }));

          const formattedReviews = reviewsData
            .filter((item: any) => {
              if (!isCleanResult(item)) return false;
              return Boolean(item.title || item.comment || item.car || item.brand);
            })
            .map((item: any) => ({
              id: `review:${item.id}`,
              sourceId: item.id,
              sourceType: "review",
              userId: item.user_id,
              user: item.user || "Anonim Kullanıcı",
              avatar: item.avatar,
              car:
                item.car ||
                (item.model_id ? modelNamesById[item.model_id] : "") ||
                "Araç bilgisi eklenmemiş",
              date: item.created_at
                ? new Date(item.created_at).toLocaleDateString("tr-TR")
                : item.date || "Yeni",
              title: item.title || "",
              comment: item.comment || "",
              rating: item.rating ? Number(item.rating) : undefined,
              modelId: item.model_id || null,
              createdAt: item.created_at || null,
            }));

          const deduped = new Map<string, any>();
          [...formattedPosts, ...formattedReviews].forEach((item) => {
            const key = [
              item.userId || item.user,
              item.modelId || item.car,
              item.title?.trim().toLocaleLowerCase("tr-TR"),
              item.comment?.trim().toLocaleLowerCase("tr-TR"),
            ].join("|");
            const existing = deduped.get(key);
            if (!existing || item.sourceType === "review") {
              deduped.set(key, item);
            }
          });

          const formatted = Array.from(deduped.values()).sort((a, b) => {
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bTime - aTime;
          });

          setFilteredPosts(formatted);
        }
      } catch (err) {
        console.error("Filtreleme işlemi sırasında hata:", err);
      } finally {
        if (isMounted) setIsFiltering(false);
      }
    };

    const timer = setTimeout(fetchFilteredPosts, 350);

    // Component kapandığında state güncellemelerini durdur (Memory Leak'i önler)
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [normalizedActiveFilters, activeCount, searchQuery, refreshTrigger]);

  const recordSearchTrendEvent = async (
    queryText: string,
    knownModelId?: string | null,
  ) => {
    const cleanQuery = queryText.trim();
    if (!user?.id || cleanQuery.length < 2) return;

    try {
      let matchedModel: any = null;

      if (knownModelId) {
        const { data } = await supabase
          .from("models")
          .select("id, brand_id, name")
          .eq("id", knownModelId)
          .maybeSingle();
        matchedModel = data;
      }

      if (!matchedModel) {
        const safeQuery = cleanQuery.replace(/,/g, " ");
        const normalizedQuery = normalizeCatalogText(safeQuery);
        const { data: directModelsData, error: directModelsError } =
          await supabase
            .from("models")
            .select("id, brand_id, name, brands(name)")
            .ilike("search_text", `%${normalizedQuery}%`)
            .limit(1);

        if (directModelsError) {
          console.error(
            "Arama modeli eşleştirilemedi:",
            directModelsError.message,
          );
          return;
        }

        matchedModel = directModelsData?.[0] as any;

        if (!matchedModel) {
          const tokens = normalizedQuery
            .split(/\s+/)
            .map((token) => token.trim())
            .filter((token) => token.length >= 2);

          const candidateRows: any[] = [];
          for (const token of tokens) {
            const { data: tokenMatches, error: tokenError } = await supabase
              .from("models")
              .select("id, brand_id, name, brands(name)")
              .ilike("search_text", `%${normalizeCatalogText(token)}%`)
              .limit(25);

            if (tokenError) {
              console.error("Arama modeli eşleştirilemedi:", tokenError.message);
              continue;
            }

            candidateRows.push(...(tokenMatches || []));
          }

          const uniqueCandidates = Array.from(
            new Map(candidateRows.map((item) => [item.id, item])).values(),
          );

          matchedModel = uniqueCandidates
            .map((candidate: any) => {
              const modelName = String(candidate.name || "").toLocaleLowerCase("tr-TR");
              const brandName = String(candidate.brands?.name || "").toLocaleLowerCase("tr-TR");
              const modelMatched = normalizedQuery.includes(modelName);
              const brandMatched = brandName && normalizedQuery.includes(brandName);

              return {
                candidate,
                score:
                  (modelMatched ? 10 : 0) +
                  (brandMatched ? 5 : 0) +
                  (tokens.some((token) => modelName.includes(token)) ? 2 : 0),
              };
            })
            .filter((item) => item.score > 0)
            .sort((a, b) => b.score - a.score)[0]?.candidate;
        }
      }

      const { data: didRecord, error } = await supabase.rpc(
        "record_vehicle_search_event",
        {
          p_query: cleanQuery,
          p_brand_id: matchedModel?.brand_id || null,
          p_model_id: matchedModel?.id || null,
        },
      );

      if (didRecord) {
        setRefreshTrigger((prev) => prev + 1);
      }

      if (error) {
        const missingSearchEvents =
          error.message.includes("vehicle_search_events") ||
          error.message.includes("schema cache");

        if (!missingSearchEvents) {
          console.error("Arama kaydı oluşturulamadı:", error.message);
        }
      }
    } catch (error) {
      console.error("Arama trend kaydı oluşturulamadı:", error);
    }
  };


  useEffect(() => {
    let isMounted = true;
    const interestText = followableSearchText;

    const checkFollowedSearch = async () => {
      if (!user?.id || !interestText) {
        if (isMounted) setFollowedSearchKey(null);
        return;
      }

      const carKey = `search:${interestText.toLocaleLowerCase("tr-TR")}`;
      const { data, error } = await supabase
        .from("saved_cars")
        .select("id")
        .eq("user_id", user.id)
        .eq("car_key", carKey)
        .maybeSingle();

      if (!isMounted) return;
      setFollowedSearchKey(!error && data?.id ? carKey : null);
    };

    checkFollowedSearch();

    return () => {
      isMounted = false;
    };
  }, [followableSearchText, user?.id]);

  const saveSearchInterest = async () => {
    const interestText = followableSearchText;
    if (!interestText || isSavingInterest) return;

    if (!isLoggedIn || !user?.id) {
      router.push(loginRoute("/") as any);
      return;
    }

    setIsSavingInterest(true);
    try {
      await supabase.from("profiles").upsert({
        id: user.id,
        display_name: user.name,
        full_name: user.name,
        avatar_url: user.avatar || null,
      });

      const carKey = `search:${interestText.toLocaleLowerCase("tr-TR")}`;

      const { data: existing } = await supabase
        .from("saved_cars")
        .select("id")
        .eq("user_id", user.id)
        .eq("car_key", carKey)
        .maybeSingle();

      if (followedSearchKey === carKey || existing?.id) {
        const { error } = await supabase
          .from("saved_cars")
          .delete()
          .eq("user_id", user.id)
          .eq("car_key", carKey);

        if (error) {
          Alert.alert("Hata", "Takipten çıkarılamadı: " + error.message);
          return;
        }

        setFollowedSearchKey(null);
        return;
      }

      const payload = {
        user_id: user.id,
        car_key: carKey,
        car_name: interestText,
        trim: "Yeni deneyim gelince bildir",
        save_intent: "considering_purchase",
        recommend_percent: 0,
      };

      const { error } = existing?.id
        ? await supabase
            .from("saved_cars")
            .update(payload)
            .eq("id", existing.id)
        : await supabase.from("saved_cars").insert(payload);

      if (error) {
        Alert.alert("Hata", "Takip kaydı oluşturulamadı: " + error.message);
        return;
      }

      await recordSearchTrendEvent(interestText);
      setFollowedSearchKey(carKey);
      Alert.alert(
        "Takibe alındı",
        `"${interestText}" için yeni deneyim girildiğinde bildirim alacaksın.`,
      );
    } finally {
      setIsSavingInterest(false);
    }
  };

  const renderFollowSearchButton = (compact = false) => {
    if (!followableSearchText) return null;

    return (
      <TouchableOpacity
        style={[
          compact ? styles.inlineFollowBtn : styles.emptySecondaryBtn,
          isCurrentSearchFollowed && styles.emptySecondaryBtnActive,
        ]}
        onPress={saveSearchInterest}
        disabled={isSavingInterest}
        activeOpacity={0.85}
      >
        {isSavingInterest ? (
          <ActivityIndicator
            size="small"
            color={isCurrentSearchFollowed ? Colors.white : Colors.orange}
          />
        ) : (
          <>
            <FontAwesome6
              name="bookmark"
              size={13}
              color={isCurrentSearchFollowed ? Colors.white : Colors.orange}
              solid
            />
            <Text
              style={[
                styles.emptySecondaryBtnText,
                isCurrentSearchFollowed && styles.emptySecondaryBtnTextActive,
              ]}
            >
              {isCurrentSearchFollowed
                ? "Bu arama takip ediliyor"
                : "Bu aramayı takip et"}
            </Text>
          </>
        )}
      </TouchableOpacity>
    );
  };

  const openComparePicker = (slot: 0 | 1) => {
    Keyboard.dismiss();
    setCatalogPickerSlot(slot);
  };

  const closeComparePicker = () => {
    setComparePickerSlot(null);
    setComparePickerStep("brand");
    setCompareSelectedBrand(null);
    setCompareSearch("");
  };

  const selectCompareBrand = (brand: CompareBrand) => {
    setCompareSelectedBrand(brand);
    setComparePickerStep("model");
    setCompareSearch("");
  };

  const selectCompareModel = (model: ModelSuggestion) => {
    if (comparePickerSlot === null) return;

    const otherSelection = compareSelections[comparePickerSlot === 0 ? 1 : 0];
    if (
      otherSelection &&
      (otherSelection.id === model.id ||
        (otherSelection.brand === model.brand &&
          otherSelection.name === model.name))
    ) {
      Alert.alert(
        "Aynı araç seçilemez",
        "Kıyaslama için ikinci alanda farklı bir model seçmelisin.",
      );
      return;
    }

    setCompareSelections((prev) => {
      const next: [CompareSelection, CompareSelection] = [...prev];
      next[comparePickerSlot] = model;
      return next;
    });
    closeComparePicker();
  };

  const clearCompareSelections = () => {
    setCompareSelections([null, null]);
    setCatalogPickerSlot(null);
    closeComparePicker();
  };

  const selectCatalogVehicle = async (
    selection: VehicleCatalogSelection,
  ) => {
    if (catalogPickerSlot === null) return;

    const duplicate = compareSelections.some(
      (item, index) =>
        index !== catalogPickerSlot &&
        item?.brand === selection.brand &&
        item?.name === selection.model,
    );

    if (duplicate) {
      Alert.alert(
        "Aynı araç seçilemez",
        "Kıyaslama için ikinci alanda farklı bir model seçmelisin.",
      );
      return;
    }

    const { data: brandRow } = await supabase
      .from("brands")
      .select("id, name")
      .ilike("name", selection.brand)
      .maybeSingle();

    const { data: modelRow } = brandRow?.id
      ? await supabase
          .from("models")
          .select("id, name")
          .eq("brand_id", brandRow.id)
          .ilike("name", selection.model)
          .maybeSingle()
      : { data: null };

    const selectedId =
      modelRow?.id ||
      buildCatalogFallbackId(
        selection.brand,
        selection.model,
        selection.engineGroup,
        selection.trim,
        selection.sourceRecordId,
      );

    const otherSelection =
      compareSelections[catalogPickerSlot === 0 ? 1 : 0];
    if (otherSelection?.id === selectedId) {
      Alert.alert(
        "Aynı araç seçilemez",
        "Kıyaslama için ikinci alanda farklı bir model seçmelisin.",
      );
      return;
    }

    setCompareSelections((prev) => {
      const next: [CompareSelection, CompareSelection] = [...prev];
      next[catalogPickerSlot] = {
        id: selectedId,
        brand: selection.brand,
        name: selection.model,
        trim: selection.trim,
        engineGroup: selection.engineGroup,
        fuelType: selection.fuelType,
        transmission: selection.transmission,
      };
      return next;
    });
    setCatalogPickerSlot(null);
  };

  const selectCatalogVehicleLevel = async (
    selection: VehicleCatalogLevelSelection,
  ) => {
    if (catalogPickerSlot === null) return;

    const duplicate = compareSelections.some(
      (item, index) =>
        index !== catalogPickerSlot &&
        item?.brand === selection.brand &&
        item?.name === selection.model,
    );

    if (duplicate) {
      Alert.alert(
        "Aynı araç seçilemez",
        "Kıyaslama için ikinci alanda farklı bir model seçmelisin.",
      );
      return;
    }

    const { data: brandRow } = await supabase
      .from("brands")
      .select("id, name")
      .ilike("name", selection.brand)
      .maybeSingle();

    const { data: modelRow } = brandRow?.id
      ? await supabase
          .from("models")
          .select("id, name")
          .eq("brand_id", brandRow.id)
          .ilike("name", selection.model)
          .maybeSingle()
      : { data: null };

    const selectedId =
      modelRow?.id ||
      buildCatalogFallbackId(
        selection.brand,
        selection.model,
        selection.engineGroup,
        selection.fuelType,
        selection.level,
      );

    const otherSelection =
      compareSelections[catalogPickerSlot === 0 ? 1 : 0];
    if (otherSelection?.id === selectedId) {
      Alert.alert(
        "Aynı araç seçilemez",
        "Kıyaslama için ikinci alanda farklı bir model seçmelisin.",
      );
      return;
    }

    setCompareSelections((prev) => {
      const next: [CompareSelection, CompareSelection] = [...prev];
      next[catalogPickerSlot] = {
        id: selectedId,
        brand: selection.brand,
        name: selection.model,
        trim:
          selection.level === "model"
            ? "Tüm motor/donanımlar"
            : "Tüm donanımlar",
        engineGroup:
          selection.level === "engine" ? selection.engineGroup || "" : "",
        fuelType: selection.level === "engine" ? selection.fuelType || "" : "",
        transmission: "",
      };
      return next;
    });
    setCatalogPickerSlot(null);
  };

  const startCustomComparison = () => {
    const [first, second] = compareSelections;
    if (!first || !second) return;

    if (
      first.id === second.id ||
      (first.brand === second.brand && first.name === second.name)
    ) {
      Alert.alert(
        "Aynı araç seçilemez",
        "Kıyaslamaya başlamak için iki farklı model seç.",
      );
      return;
    }

    router.push({
      pathname: "/comparison/[id]",
      params: {
        id: `custom_${first.id}_vs_${second.id}`,
        car1Id: first.id,
        car2Id: second.id,
        car1Name: buildCarName(first.brand, first.name),
        car2Name: buildCarName(second.brand, second.name),
        car1Trim: first.trim || "",
        car2Trim: second.trim || "",
        car1Engine: first.engineGroup || "",
        car2Engine: second.engineGroup || "",
        car1Fuel: first.fuelType || "",
        car2Fuel: second.fuelType || "",
        car1Transmission: first.transmission || "",
        car2Transmission: second.transmission || "",
      },
    } as any);
  };

  const canStartComparison = Boolean(
    compareSelections[0] && compareSelections[1],
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: palette.background }]}
      edges={["top"]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={Keyboard.dismiss}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.orange}
            colors={[Colors.orange]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <View style={styles.logoIcon}>
              <FontAwesome6
                name="car-side"
                size={14}
                color={Colors.white}
                solid
              />
            </View>
            <Text style={[styles.logoText, { color: palette.text }]}>
              Oto<Text style={styles.logoAccent}>Rehber</Text>
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {/* 1. Artı Butonu (Yeni gönderi veya Giriş için) */}
            <TouchableOpacity
              style={styles.addBtnHeader}
              accessibilityRole="button"
              accessibilityLabel="Yeni içerik paylaş"
              onPress={() => {
                if (!isLoggedIn) {
                  router.push(loginRoute("/") as any);
                } else {
                  setAddModalVisible(true);
                }
              }}
              activeOpacity={0.8}
            >
              <FontAwesome6 name="plus" size={16} color={Colors.white} />
            </TouchableOpacity>

            {/* 2. Bildirim Zili Butonu */}
            <TouchableOpacity
              style={[styles.bellWrapper, { backgroundColor: palette.card }]}
              accessibilityRole="button"
              accessibilityLabel="Bildirimleri aç"
              onPress={() => router.push("/notifications-feed")}
              activeOpacity={0.8}
            >
              <FontAwesome6 name="bell" size={18} color={palette.muted} />
              <View style={styles.bellDot} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Arama + Filtre ── */}
        <View style={styles.searchRow}>
          <Pressable
            style={[
              styles.searchBar,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
            onPress={() => searchInputRef.current?.focus()}
          >
            <FontAwesome6
              name="magnifying-glass"
              size={14}
              color={palette.muted}
            />
            <TextInput
              ref={searchInputRef}
              placeholder="Marka veya model ara... (Örn: Alfa Romeo)"
              placeholderTextColor={palette.muted}
              selectionColor={Colors.orange}
              cursorColor={Colors.orange}
              style={[styles.searchInput, { color: palette.text }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              blurOnSubmit
              onSubmitEditing={Keyboard.dismiss}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Aramayı temizle"
                onPress={() => setSearchQuery("")}
                style={styles.clearSearchBtn}
                hitSlop={8}
              >
                <FontAwesome6 name="xmark" size={14} color={palette.muted} />
              </TouchableOpacity>
            )}
          </Pressable>

          <TouchableOpacity
            onPress={() => setFilterVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Detaylı filtreleri aç"
            style={[
              styles.filterBtn,
              { backgroundColor: palette.card, borderColor: palette.border },
              activeCount > 0 && styles.filterBtnActive,
            ]}
            activeOpacity={0.8}
          >
            <FontAwesome6
              name="sliders"
              size={16}
              color={activeCount > 0 ? Colors.white : palette.muted}
            />
            {activeCount > 0 ? (
              <View style={styles.filterCountBadge}>
                <Text style={styles.filterCountText}>{activeCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        {/* Aktif Filtre Etiketleri */}
        {activeCount > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.activeTagsRow}
          >
            {normalizedActiveFilters.markalar.map((m) => (
              <View key={m} style={styles.activeTag}>
                <Text style={styles.activeTagText}>{m}</Text>
              </View>
            ))}
            {normalizedActiveFilters.modeller.map((model) => (
              <View key={model} style={styles.activeTag}>
                <Text style={styles.activeTagText}>{model}</Text>
              </View>
            ))}
            {normalizedActiveFilters.motorGruplari.map((engine) => (
              <View key={engine} style={styles.activeTag}>
                <Text style={styles.activeTagText}>{engine}</Text>
              </View>
            ))}
            {normalizedActiveFilters.donanimlar.map((trim) => (
              <View key={trim} style={styles.activeTag}>
                <Text style={styles.activeTagText}>{trim}</Text>
              </View>
            ))}
            {normalizedActiveFilters.yakitTipleri.map((y) => (
              <View key={y} style={styles.activeTag}>
                <Text style={styles.activeTagText}>{y}</Text>
              </View>
            ))}
          </ScrollView>
        ) : null}

        {/* ── ARAMA VE FİLTRE SONUÇLARI ── */}
        {activeCount > 0 || searchQuery.trim().length > 0 ? (
          <View style={styles.px}>
            <View style={styles.rowBetween}>
              <Text style={[styles.sectionHeader, { color: palette.text }]}>
                Arama Sonuçları
              </Text>
            </View>
            {followableSearchText ? (
              <View style={styles.followSearchRow}>
                {renderFollowSearchButton(true)}
              </View>
            ) : null}
            <View style={{ height: 12 }} />
            {isFiltering ? (
              <View style={{ paddingVertical: 20 }}>
                <ActivityIndicator size="small" color={Colors.orange} />
              </View>
            ) : modelSuggestions.length > 0 || filteredPosts.length > 0 ? (
              <>
                {modelSuggestions.length > 0 ? (
                  <View
                    style={[
                      styles.modelSuggestionBox,
                      {
                        backgroundColor: palette.card,
                        borderColor: palette.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.modelSuggestionTitle,
                        { color: palette.text },
                      ]}
                    >
                      Araç Modelleri
                    </Text>
                    {modelSuggestions.map((model) => (
                      <TouchableOpacity
                        key={`model-suggestion-${model.id}`}
                        style={[
                          styles.modelSuggestionItem,
                          { borderTopColor: palette.border },
                        ]}
                        activeOpacity={0.8}
                        onPress={() => {
                          const queryText = `${model.brand} ${model.name}`.trim();
                          void recordSearchTrendEvent(queryText, model.id);
                          router.push(
                            buildTrendingRoute({
                              id: model.id,
                              brand: model.brand,
                              model: model.name,
                              name: queryText,
                            }) as any,
                          );
                        }}
                      >
                        <View style={styles.modelSuggestionIcon}>
                          <FontAwesome6
                            name="car-side"
                            size={15}
                            color={Colors.orange}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.modelSuggestionName,
                              { color: palette.text },
                            ]}
                            numberOfLines={1}
                          >
                            {model.name}
                          </Text>
                          <Text
                            style={[
                              styles.modelSuggestionBrand,
                              { color: palette.muted },
                            ]}
                            numberOfLines={1}
                          >
                            {model.brand}
                          </Text>
                        </View>
                        <FontAwesome6
                          name="chevron-right"
                          size={13}
                          color={palette.muted}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}

                {filteredPosts.map((rev) => (
                  <ExperienceCard
                    key={`filter-${rev.id}`}
                    review={rev}
                    onPress={() => {
                      void recordSearchTrendEvent(searchQuery, rev.modelId);
                      if (rev.sourceType === "review") {
                        router.push({
                          pathname: `/review/${rev.sourceId || rev.id}`,
                          params: { fallbackData: JSON.stringify(rev) },
                        } as any);
                      } else {
                        router.push(`/post/${rev.sourceId || rev.id}` as any);
                      }
                    }}
                  />
                ))}
              </>
            ) : (
              <View
                style={[
                  styles.emptyCard,
                  {
                    marginTop: 0,
                    marginBottom: 12,
                    backgroundColor: palette.card,
                    borderColor: palette.border,
                  },
                ]}
              >
                <View style={styles.emptyIconWrapper}>
                  <FontAwesome6
                    name="comment-slash"
                    size={24}
                    color={Colors.orange}
                  />
                </View>
                <Text style={[styles.emptyTitle, { color: palette.text }]}>
                  {followableSearchText
                    ? `"${followableSearchText}" için Deneyim Bulunamadı!`
                    : "Deneyim Bulunamadı!"}
                </Text>
                <Text style={[styles.emptySubtitle, { color: palette.muted }]}>
                  Görünüşe göre bu kriterlerde sanayi tecrübesi olan ilk kişi
                  sensin. Topluluğa rehberlik etmek için bir inceleme başlatmaya
                  ne dersin?
                </Text>
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={async () => {
                    const {
                      data: { session },
                    } = await supabase.auth.getSession();
                    if (session && session.user) {
                      setAddModalVisible(true);
                    } else {
                      router.push(loginRoute("/") as any);
                    }
                  }}
                >
                  <Text style={styles.emptyBtnText}>
                    İlk İncelemeyi / Yorumu Sen Yaz
                  </Text>
                </TouchableOpacity>
                {renderFollowSearchButton(false)}
              </View>
            )}
          </View>
        ) : null}

        {/* Günün Karşılaştırması */}
        <View style={styles.px}>
          <View style={styles.rowBetween}>
            <Text style={[styles.sectionHeader, { color: palette.text }]}>
              Günün Karşılaştırması
            </Text>
          </View>
          <ComparisonCard
            comparison={dailyComparison}
            loading={isLoadingComparison}
          />
        </View>

        {/* Sen de Kıyasla */}
        <View style={[styles.px, { marginTop: 14 }]}>
          <View
            style={[
              styles.customCompareCard,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <View style={styles.customCompareHeader}>
              <View>
                <Text
                  style={[styles.customCompareTitle, { color: palette.text }]}
                >
                  Sen de Kıyasla
                </Text>
                <Text
                  style={[styles.customCompareSubtitle, { color: palette.muted }]}
                >
                  Merak ettiğin iki aracı seç.
                </Text>
              </View>
              <View style={styles.customCompareHeaderActions}>
                {(compareSelections[0] || compareSelections[1]) && (
                  <TouchableOpacity
                    style={[
                      styles.customCompareClearBtn,
                      { backgroundColor: palette.elevated, borderColor: palette.border },
                    ]}
                    onPress={clearCompareSelections}
                    activeOpacity={0.8}
                  >
                    <FontAwesome6 name="xmark" size={11} color={palette.muted} />
                    <Text
                      style={[
                        styles.customCompareClearText,
                        { color: palette.muted },
                      ]}
                    >
                      Temizle
                    </Text>
                  </TouchableOpacity>
                )}
                <View style={styles.customCompareHeaderIcon}>
                  <FontAwesome6
                    name="scale-balanced"
                    size={16}
                    color={Colors.orange}
                  />
                </View>
              </View>
            </View>

            <View style={styles.customComparePickers}>
              {[0, 1].map((slot) => {
                const selected = compareSelections[slot as 0 | 1];
                return (
                  <TouchableOpacity
                    key={`compare-slot-${slot}`}
                    style={[
                      styles.customComparePicker,
                      {
                        backgroundColor: palette.elevated,
                        borderColor: palette.border,
                      },
                    ]}
                    activeOpacity={0.85}
                    onPress={() => openComparePicker(slot as 0 | 1)}
                  >
                    <Text
                      style={[
                        styles.customComparePickerLabel,
                        { color: palette.muted },
                      ]}
                    >
                      {slot === 0 ? "1. araç" : "2. araç"}
                    </Text>
                    <Text
                      style={[
                        styles.customComparePickerValue,
                        { color: selected ? palette.text : palette.muted },
                      ]}
                      numberOfLines={2}
                    >
                      {selected
                        ? buildCompareSelectionLabel(selected)
                        : "Araç seç"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[
                styles.customCompareButton,
                !canStartComparison && styles.customCompareButtonDisabled,
              ]}
              disabled={!canStartComparison}
              activeOpacity={0.85}
              onPress={startCustomComparison}
            >
              <Text
                style={[
                  styles.customCompareButtonText,
                  !canStartComparison && styles.customCompareButtonTextDisabled,
                ]}
              >
                Kıyaslamaya Başla
              </Text>
              <FontAwesome6
                name="arrow-right"
                size={13}
                color={canStartComparison ? Colors.white : "#475569"}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── SON DENEYİMLER (En Çok İncelenenlerin Üstünde) ── */}
        <View style={[styles.px, { marginTop: 24 }]}>
          <View style={styles.rowBetween}>
            <Text style={[styles.sectionHeader, { color: palette.text }]}>
              Son Deneyimler
            </Text>
            <TouchableOpacity onPress={() => router.push("/reviews" as any)}>
              <Text style={styles.seeAll}>Tümünü Gör</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: 12 }} />
          {recentReviews.map((rev) => (
            <ExperienceCard key={`fixed-${rev.id}`} review={rev} />
          ))}
        </View>

        {/* ── EN ÇOK İNCELENENLER ── */}
        {searchQuery.trim().length === 0 ? (
          <View style={[styles.px, { marginTop: 24, marginBottom: 40 }]}>
            <Text style={[styles.sectionHeader, { color: palette.text }]}>
              En Çok İncelenenler
            </Text>
            <View style={{ height: 12 }} />
            {isLoadingTrending ? (
              <View style={{ paddingVertical: 20 }}>
                <ActivityIndicator size="small" color={Colors.orange} />
              </View>
            ) : trendingCars.length > 0 ? (
              trendingCars.map((car) => (
                <TrendingCarCard key={`trend-${car.id}`} car={car} />
              ))
            ) : (
              <Text style={[styles.emptyText, { color: palette.muted }]}>
                Trend listesi için henüz yeterli topluluk verisi yok.
              </Text>
            )}
          </View>
        ) : null}
      </ScrollView>

      <FilterSheet
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        onApply={(f) => setActiveFilters(f)}
      />

      <VehicleCatalogPicker
        visible={catalogPickerSlot !== null}
        title={
          catalogPickerSlot === 0 ? "1. karşılaştırma aracı" : "2. karşılaştırma aracı"
        }
        onClose={() => setCatalogPickerSlot(null)}
        onSelect={selectCatalogVehicle}
        allowCurrentLevelSelect
        onSelectCurrentLevel={selectCatalogVehicleLevel}
        disabledModel={
          catalogPickerSlot === null
            ? null
            : compareSelections[catalogPickerSlot === 0 ? 1 : 0]
              ? {
                  brand:
                    compareSelections[catalogPickerSlot === 0 ? 1 : 0]!.brand,
                  model:
                    compareSelections[catalogPickerSlot === 0 ? 1 : 0]!.name,
                }
              : null
        }
      />

      <Modal
        visible={comparePickerSlot !== null}
        animationType="slide"
        transparent
        onRequestClose={closeComparePicker}
      >
        <Pressable style={styles.modalOverlay} onPress={closeComparePicker} />
        <KeyboardAvoidingView
          style={styles.comparePickerKeyboardAvoiding}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
          pointerEvents="box-none"
        >
        <View
          style={[
            styles.comparePickerSheet,
            { backgroundColor: palette.background, borderColor: palette.border },
          ]}
        >
          <View style={styles.comparePickerHandle} />
          <View style={styles.comparePickerHeader}>
            <View style={styles.comparePickerHeaderLeft}>
              {comparePickerStep === "model" ? (
                <TouchableOpacity
                  onPress={() => {
                    setComparePickerStep("brand");
                    setCompareSelectedBrand(null);
                    setCompareSearch("");
                  }}
                  style={styles.comparePickerClose}
                  hitSlop={8}
                >
                  <FontAwesome6
                    name="arrow-left"
                    size={16}
                    color={palette.text}
                  />
                </TouchableOpacity>
              ) : null}
              <View>
                <Text
                  style={[styles.comparePickerTitle, { color: palette.text }]}
                >
                  {comparePickerStep === "brand" ? "Marka Seç" : "Model Seç"}
                </Text>
                <Text
                  style={[styles.comparePickerSubtitle, { color: palette.muted }]}
                >
                  {comparePickerStep === "brand"
                    ? comparePickerSlot === 0
                      ? "1. araç için marka"
                      : "2. araç için marka"
                    : compareSelectedBrand?.name}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={closeComparePicker}
              style={styles.comparePickerClose}
              hitSlop={8}
            >
              <FontAwesome6 name="xmark" size={18} color={palette.muted} />
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.comparePickerSearch,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <FontAwesome6
              name="magnifying-glass"
              size={14}
              color={palette.muted}
            />
            <TextInput
              value={compareSearch}
              onChangeText={setCompareSearch}
              placeholder={
                comparePickerStep === "brand" ? "Marka ara..." : "Model ara..."
              }
              placeholderTextColor={palette.muted}
              style={[styles.comparePickerSearchInput, { color: palette.text }]}
              autoCapitalize="none"
              autoCorrect={false}
              selectionColor={Colors.orange}
              cursorColor={Colors.orange}
            />
            {compareSearch.length > 0 ? (
              <TouchableOpacity
                onPress={() => setCompareSearch("")}
                style={styles.clearSearchBtn}
                hitSlop={8}
              >
                <FontAwesome6 name="xmark" size={14} color={palette.muted} />
              </TouchableOpacity>
            ) : null}
          </View>

          {isLoadingCompareCatalog ? (
            <View style={styles.comparePickerLoading}>
              <ActivityIndicator size="small" color={Colors.orange} />
            </View>
          ) : (
            <FlatList
              data={
                comparePickerStep === "brand"
                  ? filteredCompareBrands
                  : filteredCompareModels
              }
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.comparePickerList}
              ListEmptyComponent={
                <Text style={[styles.emptyText, { color: palette.muted }]}>
                  {comparePickerStep === "brand"
                    ? "Marka bulunamadı."
                    : "Bu markaya ait model bulunamadı."}
                </Text>
              }
              renderItem={({ item }) => {
                if (comparePickerStep === "brand") {
                  const brand = item as CompareBrand;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.comparePickerItem,
                        { borderBottomColor: palette.border },
                      ]}
                      activeOpacity={0.85}
                      onPress={() => selectCompareBrand(brand)}
                    >
                      <View style={styles.modelSuggestionIcon}>
                        <FontAwesome6
                          name="copyright"
                          size={15}
                          color={Colors.orange}
                        />
                      </View>
                      <Text
                        style={[
                          styles.modelSuggestionName,
                          { color: palette.text, flex: 1 },
                        ]}
                        numberOfLines={1}
                      >
                        {brand.name}
                      </Text>
                      <FontAwesome6
                        name="chevron-right"
                        size={13}
                        color={palette.muted}
                      />
                    </TouchableOpacity>
                  );
                }

                const model = item as ModelSuggestion;
                const otherSlot =
                  comparePickerSlot === null
                    ? null
                    : comparePickerSlot === 0
                      ? 1
                      : 0;
                const isAlreadySelected =
                  otherSlot !== null &&
                  compareSelections[otherSlot]?.id === model.id;
                return (
                  <TouchableOpacity
                    key={`compare-picker-${model.id}`}
                    style={[
                      styles.comparePickerItem,
                      { borderBottomColor: palette.border },
                      isAlreadySelected && styles.comparePickerItemSelected,
                    ]}
                    activeOpacity={0.85}
                    disabled={isAlreadySelected}
                    onPress={() => selectCompareModel(model)}
                  >
                    <View style={styles.modelSuggestionIcon}>
                      <FontAwesome6
                        name="car-side"
                        size={15}
                        color={Colors.orange}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.modelSuggestionName,
                          { color: palette.text },
                        ]}
                        numberOfLines={1}
                      >
                        {model.name}
                      </Text>
                      <Text
                        style={[
                          styles.modelSuggestionBrand,
                          { color: palette.muted },
                        ]}
                        numberOfLines={1}
                      >
                        {model.brand}
                      </Text>
                      {isAlreadySelected ? (
                        <Text
                          style={[
                            styles.modelSuggestionBrand,
                            { color: palette.muted },
                          ]}
                        >
                          Diğer karşılaştırma alanında seçili
                        </Text>
                      ) : null}
                    </View>
                    {isAlreadySelected ? (
                      <FontAwesome6 name="ban" size={14} color={palette.muted} />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Gönderi Oluştur Modalı */}
      <AddReviewModal
        visible={isAddModalVisible}
        onClose={() => setAddModalVisible(false)}
        onSave={(rev) => {
          addReview(rev);
          void refreshReviews();
          setAddModalVisible(false);
          setRefreshTrigger((prev) => prev + 1); // Anında güncel listeyi (Supabase) tetikle
        }}
        userName={user?.name || "Sürücü"}
        userAvatar={user?.avatar || ""}
        initialSearchText={followableSearchText || searchQuery}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.navyMain },
  scrollContent: { paddingBottom: 100 },
  px: { paddingHorizontal: 20, marginTop: 20 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.orange,
    justifyContent: "center",
    alignItems: "center",
  },
  logoText: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.white,
    letterSpacing: -0.5,
  },
  logoAccent: { color: Colors.orange },
  addBtnHeader: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.orange,
    justifyContent: "center",
    alignItems: "center",
  },
  bellWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.navyCard,
    justifyContent: "center",
    alignItems: "center",
  },
  bellDot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
    borderWidth: 1.5,
    borderColor: Colors.navyCard,
  },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  searchBar: {
    flex: 1,
    backgroundColor: Colors.navyCard,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  searchInput: { flex: 1, color: Colors.white, fontSize: 14 },
  clearSearchBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBtn: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: Colors.navyCard,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  filterBtnActive: {
    backgroundColor: Colors.orange,
    borderColor: Colors.orange,
  },
  filterCountBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: Colors.navyMain,
  },
  filterCountText: { fontSize: 9, fontWeight: "800", color: Colors.white },

  activeTagsRow: { paddingHorizontal: 20, gap: 8, marginTop: 10 },
  activeTag: {
    backgroundColor: "rgba(255,101,0,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,101,0,0.35)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  activeTagText: { fontSize: 11, color: Colors.orange, fontWeight: "600" },

  modelSuggestionBox: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 12,
  },
  modelSuggestionTitle: {
    fontSize: 13,
    fontWeight: "800",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  modelSuggestionItem: {
    minHeight: 58,
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modelSuggestionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,101,0,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  modelSuggestionName: {
    fontSize: 14,
    fontWeight: "800",
  },
  modelSuggestionBrand: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },

  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 12,
  },
  sectionHeader: { fontSize: 17, fontWeight: "800", color: Colors.white },
  seeAll: { fontSize: 12, fontWeight: "700", color: Colors.orange },

  comparisonCard: {
    backgroundColor: Colors.navyCard,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  comparisonCardFeatured: {
    backgroundColor: Colors.orange,
    borderColor: Colors.orange,
  },
  comparisonLoading: {
    minHeight: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  comparisonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  comparisonCar: { width: "42%", alignItems: "center" },
  comparisonIconBox: {
    width: "100%",
    height: 64,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: Colors.navyMain,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  comparisonIconBoxFeatured: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderColor: "rgba(255,255,255,0.35)",
  },
  comparisonCarName: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.white,
    textAlign: "center",
  },
  comparisonTextFeatured: {
    color: Colors.white,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 4,
  },
  ratingText: { fontSize: 10, color: Colors.gray300 },
  comparisonMetaFeatured: {
    color: "rgba(255,255,255,0.9)",
  },
  vsBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.orange,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: Colors.navyCard,
  },
  vsText: { color: Colors.white, fontWeight: "900", fontSize: 10 },
  compareBtn: {
    marginTop: 14,
    backgroundColor: Colors.navyMain,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  compareBtnText: { color: Colors.gray300, fontSize: 12, fontWeight: "600" },
  compareBtnFeatured: {
    backgroundColor: Colors.white,
    borderColor: Colors.white,
  },
  compareBtnTextFeatured: {
    color: Colors.orange,
    fontWeight: "800",
  },

  customCompareCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  customCompareHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  customCompareTitle: {
    fontSize: 16,
    fontWeight: "900",
  },
  customCompareSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 3,
  },
  customCompareHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,101,0,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  customCompareHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  customCompareClearBtn: {
    minHeight: 34,
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  customCompareClearText: {
    fontSize: 11,
    fontWeight: "800",
  },
  customComparePickers: {
    flexDirection: "row",
    gap: 10,
  },
  customComparePicker: {
    flex: 1,
    minHeight: 62,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: "center",
  },
  customComparePickerLabel: {
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  customComparePickerValue: {
    fontSize: 13,
    fontWeight: "800",
  },
  customCompareButton: {
    marginTop: 12,
    height: 46,
    borderRadius: 13,
    backgroundColor: Colors.orange,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  customCompareButtonDisabled: {
    backgroundColor: "#cbd5e1",
  },
  customCompareButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: "900",
  },
  customCompareButtonTextDisabled: {
    color: "#475569",
  },

  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  comparePickerKeyboardAvoiding: {
    flex: 1,
    justifyContent: "flex-end",
  },
  comparePickerSheet: {
    width: "100%",
    maxHeight: "82%",
    minHeight: "60%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingBottom: 24,
  },
  comparePickerHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(148,163,184,0.6)",
    alignSelf: "center",
    marginTop: 10,
  },
  comparePickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  comparePickerHeaderLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  comparePickerTitle: {
    fontSize: 18,
    fontWeight: "900",
  },
  comparePickerSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  comparePickerClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  comparePickerSearch: {
    marginHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  comparePickerSearchInput: {
    flex: 1,
    fontSize: 14,
  },
  comparePickerLoading: {
    paddingVertical: 28,
  },
  comparePickerList: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  comparePickerItem: {
    minHeight: 60,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  comparePickerItemSelected: {
    opacity: 0.85,
  },

  trendCard: {
    backgroundColor: Colors.navyCard,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    marginBottom: 14,
  },
  trendIconWrapper: {
    height: 96,
    backgroundColor: Colors.navyMain,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: Colors.navyBorder,
  },
  trendRatingBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  trendRatingText: { color: Colors.white, fontSize: 11, fontWeight: "700" },
  trendContent: { padding: 14 },
  trendHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  trendCarName: { fontSize: 17, fontWeight: "800", color: Colors.white },
  trendCarTrim: { fontSize: 11, color: Colors.textMuted },
  recommendBadge: {
    backgroundColor: "rgba(34,197,94,0.15)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  recommendText: { color: "#4ade80", fontSize: 10, fontWeight: "700" },
  trendReview: { fontSize: 12, color: "#9ca3af" },
  trendReviewLabel: { color: Colors.white, fontWeight: "600" },

  expCard: {
    backgroundColor: Colors.navyCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    marginBottom: 12,
  },
  expHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  expAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.navyBorder,
  },
  expUser: { fontSize: 14, fontWeight: "700", color: Colors.white },
  expCarInfo: { fontSize: 11, color: Colors.orange, fontWeight: "600" },
  expDate: { fontSize: 10, color: Colors.textMuted },
  expTitle: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
    marginBottom: 6,
  },
  expComment: {
    fontSize: 13,
    color: Colors.gray300,
    lineHeight: 20,
    fontStyle: "italic",
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 10,
  },

  // Arama Sonucu Boş Durum (Empty State) Stilleri
  emptyCard: {
    backgroundColor: Colors.navyCard,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    marginTop: 10,
  },
  emptyIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(255, 101, 0, 0.1)", // Turuncu tonlu şeffaf arka plan
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  emptySubtitle: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  emptyBtn: {
    backgroundColor: Colors.orange,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  emptyBtnText: { color: Colors.white, fontSize: 14, fontWeight: "700" },
  emptySecondaryBtn: {
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 101, 0, 0.35)",
    backgroundColor: "rgba(255, 101, 0, 0.08)",
    paddingHorizontal: 16,
    marginTop: 10,
    width: "100%",
  },
  followSearchRow: {
    marginTop: 10,
    alignItems: "flex-start",
  },
  inlineFollowBtn: {
    minHeight: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 101, 0, 0.35)",
    backgroundColor: "rgba(255, 101, 0, 0.08)",
    paddingHorizontal: 14,
  },
  emptySecondaryBtnActive: {
    backgroundColor: Colors.orange,
    borderColor: Colors.orange,
  },
  emptySecondaryBtnText: {
    color: Colors.orange,
    fontSize: 13,
    fontWeight: "800",
  },
  emptySecondaryBtnTextActive: { color: Colors.white },

});
