import Colors from "@/constants/Colors";
import { FontAwesome6 } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    Alert,
    Animated,
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { useAppTheme } from "../../contexts/ThemeContext";
import { loginRoute, withSearchParams } from "../../utils/authRedirect";

// ─── Tipler ───────────────────────────────────────────────────────────────────
interface CarStats {
  power: number | null;
  torque: number | null;
  fuel: number | null;
  bootSpace: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
}

interface CarData {
  id: string;
  name: string;
  trim: string;
  stats: CarStats;
  chronicIssues: string[];
}

interface ComparisonData {
  id: string;
  car1: CarData;
  car2: CarData;
  votes: {
    car1: number;
    car2: number;
  };
}

interface VehicleSpecRow {
  id: string;
  model_id: string | null;
  year: string | null;
  trim: string | null;
  engine: string | null;
  fuel_type: string | null;
  transmission: string | null;
  body_type: string | null;
  power_hp: number | null;
  torque_nm: number | null;
  fuel_consumption_l_100km: number | null;
  boot_space_l: number | null;
  length_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  source: string | null;
}

interface ComparisonQuestionPost {
  id: string;
  user: string | null;
  car: string | null;
  title: string | null;
  content: string | null;
  upvotes: number | null;
  comments: number | null;
  created_at: string | null;
  model_id: string | null;
}

const EMPTY_STATS: CarStats = {
  power: null,
  torque: null,
  fuel: null,
  bootSpace: null,
  length: null,
  width: null,
  height: null,
};

const FALLBACK_COMPARISON: ComparisonData = {
  id: "comparison",
  car1: {
    id: "c1",
    name: "Araç 1",
    trim: "Topluluk verisi bekleniyor",
    stats: EMPTY_STATS,
    chronicIssues: ["Henüz yeterli topluluk verisi yok"],
  },
  car2: {
    id: "c2",
    name: "Araç 2",
    trim: "Topluluk verisi bekleniyor",
    stats: EMPTY_STATS,
    chronicIssues: ["Henüz yeterli topluluk verisi yok"],
  },
  votes: {
    car1: 0,
    car2: 0,
  },
};

// ─── Alt Bileşen: İlerleme Çubuğu (Versus Bar) ────────────────────────────────
const VsStatBar = ({
  label,
  val1,
  val2,
  max,
  unit,
  palette,
  invert = false, // Eğer düşük olan daha iyiyse (Örn: Yakıt Tüketimi) true gönderilir
}: {
  label: string;
  val1: number | null;
  val2: number | null;
  max: number;
  unit: string;
  palette: ReturnType<typeof useAppTheme>["palette"];
  invert?: boolean;
}) => {
  const hasVal1 = typeof val1 === "number" && Number.isFinite(val1);
  const hasVal2 = typeof val2 === "number" && Number.isFinite(val2);
  const w1 = hasVal1 ? Math.min((val1 / max) * 100, 100) : 0;
  const w2 = hasVal2 ? Math.min((val2 / max) * 100, 100) : 0;
  const bothValues = hasVal1 && hasVal2 && val1 !== val2;
  const win1 = bothValues && (invert ? val1 < val2 : val1 > val2);
  const win2 = bothValues && (invert ? val2 < val1 : val2 > val1);
  const formatValue = (value: number | null) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return "Veri yok";
    const formatted = Number.isInteger(value) ? value.toString() : value.toFixed(1);
    return `${formatted} ${unit}`;
  };

  return (
    <View style={styles.statContainer}>
      <Text style={[styles.statLabel, { color: palette.softText }]}>{label}</Text>
      <View style={styles.statRow}>
        {/* Sol Araç Değeri */}
        <Text
          style={[
            styles.statValue,
            { color: palette.muted },
            win1 && styles.statWinnerText,
          ]}
        >
          {formatValue(val1)}
        </Text>

        {/* Ortadaki Karşılaştırma Barları */}
        <View style={styles.barsArea}>
          <View style={styles.barLeftWrapper}>
            <View
              style={[
                styles.barLeft,
                {
                  width: `${w1}%`,
                  backgroundColor: win1 ? Colors.orange : palette.border,
                },
              ]}
            />
          </View>
          <View style={[styles.barCenterDiv, { backgroundColor: palette.border }]} />
          <View style={styles.barRightWrapper}>
            <View
              style={[
                styles.barRight,
                {
                  width: `${w2}%`,
                  backgroundColor: win2 ? Colors.orange : palette.border,
                },
              ]}
            />
          </View>
        </View>

        {/* Sağ Araç Değeri */}
        <Text
          style={[
            styles.statValue,
            { color: palette.muted },
            win2 && styles.statWinnerText,
          ]}
        >
          {formatValue(val2)}
        </Text>
      </View>
    </View>
  );
};

const SpecTextRow = ({
  label,
  value1,
  value2,
  palette,
}: {
  label: string;
  value1?: string | null;
  value2?: string | null;
  palette: ReturnType<typeof useAppTheme>["palette"];
}) => (
  <View style={[styles.specTextRow, { borderBottomColor: palette.border }]}>
    <Text style={[styles.specTextValue, { color: palette.text }]}>
      {value1 || "Veri yok"}
    </Text>
    <Text style={[styles.specTextLabel, { color: palette.muted }]}>{label}</Text>
    <Text style={[styles.specTextValue, { color: palette.text }]}>
      {value2 || "Veri yok"}
    </Text>
  </View>
);

const isVehicleSpecsSchemaError = (message: string) =>
  message.includes("vehicle_specs") ||
  message.includes("power_hp") ||
  message.includes("fuel_consumption_l_100km");

const toNumberOrNull = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const statsFromSpec = (spec: VehicleSpecRow | null): CarStats => ({
  power: toNumberOrNull(spec?.power_hp),
  torque: toNumberOrNull(spec?.torque_nm),
  fuel: toNumberOrNull(spec?.fuel_consumption_l_100km),
  bootSpace: toNumberOrNull(spec?.boot_space_l),
  length: toNumberOrNull(spec?.length_mm),
  width: toNumberOrNull(spec?.width_mm),
  height: toNumberOrNull(spec?.height_mm),
});

const describeVehicleSpec = (spec: VehicleSpecRow | null) => {
  if (!spec) return "";
  return [
    spec.year,
    spec.trim,
    spec.engine,
    translateFuelType(spec.fuel_type),
    spec.transmission,
  ]
    .filter(Boolean)
    .join(" / ");
};

const hasFallbackSpecData = (spec: VehicleSpecRow | null) =>
  Boolean(spec?.trim || spec?.engine || spec?.fuel_type || spec?.transmission);

const translateFuelType = (fuelType?: string | null) => {
  if (!fuelType) return "";

  const translations: Record<string, string> = {
    gasoline: "Benzin",
    petrol: "Benzin",
    diesel: "Dizel",
    electric: "Elektrik",
    hybrid: "Hibrit",
    "plug-in hybrid": "Şarj Edilebilir Hibrit",
    phev: "Şarj Edilebilir Hibrit",
    lpg: "LPG",
  };

  return translations[fuelType.trim().toLocaleLowerCase("en-US")] || fuelType;
};

const getInitials = (name?: string | null) => {
  const parts = (name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].charAt(0).toLocaleUpperCase("tr-TR");
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toLocaleUpperCase(
    "tr-TR",
  );
};

const formatShortDate = (value?: string | null) => {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "short",
    }).format(new Date(value));
  } catch {
    return "";
  }
};

// ─── Ana Sayfa Bileşeni ───────────────────────────────────────────────────────
export default function ComparisonDetailScreen() {
  const {
    id,
    car1Id,
    car2Id,
    car1Name,
    car2Name,
    car1Trim,
    car2Trim,
    car1Engine,
    car2Engine,
    car1Fuel,
    car2Fuel,
    car1Transmission,
    car2Transmission,
  } =
    useLocalSearchParams<{
    id: string;
    car1Id?: string;
    car2Id?: string;
    car1Name?: string;
    car2Name?: string;
    car1Trim?: string;
    car2Trim?: string;
    car1Engine?: string;
    car2Engine?: string;
    car1Fuel?: string;
    car2Fuel?: string;
    car1Transmission?: string;
    car2Transmission?: string;
  }>();
  const router = useRouter();
  const { user, isLoggedIn } = useAuth();
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();

  const paramCar1Id = Array.isArray(car1Id) ? car1Id[0] : car1Id;
  const paramCar2Id = Array.isArray(car2Id) ? car2Id[0] : car2Id;
  const paramCar1Name = Array.isArray(car1Name) ? car1Name[0] : car1Name;
  const paramCar2Name = Array.isArray(car2Name) ? car2Name[0] : car2Name;
  const paramCar1Trim = Array.isArray(car1Trim) ? car1Trim[0] : car1Trim;
  const paramCar2Trim = Array.isArray(car2Trim) ? car2Trim[0] : car2Trim;
  const paramCar1Engine = Array.isArray(car1Engine) ? car1Engine[0] : car1Engine;
  const paramCar2Engine = Array.isArray(car2Engine) ? car2Engine[0] : car2Engine;
  const paramCar1Fuel = Array.isArray(car1Fuel) ? car1Fuel[0] : car1Fuel;
  const paramCar2Fuel = Array.isArray(car2Fuel) ? car2Fuel[0] : car2Fuel;
  const paramCar1Transmission = Array.isArray(car1Transmission)
    ? car1Transmission[0]
    : car1Transmission;
  const paramCar2Transmission = Array.isArray(car2Transmission)
    ? car2Transmission[0]
    : car2Transmission;
  const data = {
    ...FALLBACK_COMPARISON,
    id: Array.isArray(id) ? id[0] : id || FALLBACK_COMPARISON.id,
    car1: {
      ...FALLBACK_COMPARISON.car1,
      id: paramCar1Id || FALLBACK_COMPARISON.car1.id,
      name: paramCar1Name || FALLBACK_COMPARISON.car1.name,
      trim:
        paramCar1Trim ||
        (paramCar1Name ? "Günün seçilen modeli" : FALLBACK_COMPARISON.car1.trim),
    },
    car2: {
      ...FALLBACK_COMPARISON.car2,
      id: paramCar2Id || FALLBACK_COMPARISON.car2.id,
      name: paramCar2Name || FALLBACK_COMPARISON.car2.name,
      trim:
        paramCar2Trim ||
        (paramCar2Name ? "Günün seçilen modeli" : FALLBACK_COMPARISON.car2.trim),
    },
  };
  const comparisonReturnTo = withSearchParams(`/comparison/${data.id}`, {
    car1Id: data.car1.id,
    car2Id: data.car2.id,
    car1Name: data.car1.name,
    car2Name: data.car2.name,
    car1Trim: data.car1.trim,
    car2Trim: data.car2.trim,
    car1Engine: paramCar1Engine,
    car2Engine: paramCar2Engine,
    car1Fuel: paramCar1Fuel,
    car2Fuel: paramCar2Fuel,
    car1Transmission: paramCar1Transmission,
    car2Transmission: paramCar2Transmission,
  });
  const [vehicleSpecs, setVehicleSpecs] = useState<{
    car1: VehicleSpecRow | null;
    car2: VehicleSpecRow | null;
  }>({ car1: null, car2: null });
  const [isLoadingVehicleSpecs, setIsLoadingVehicleSpecs] = useState(false);
  const [savedCarKeys, setSavedCarKeys] = useState<Record<string, boolean>>({});
  const [vehicleSpecsSchemaMissing, setVehicleSpecsSchemaMissing] =
    useState(false);
  const [comparisonQuestions, setComparisonQuestions] = useState<
    ComparisonQuestionPost[]
  >([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);

  // Anket State'leri
  const [votedFor, setVotedFor] = useState<"car1" | "car2" | null>(null);
  const [votes, setVotes] = useState(data.votes); // Oyları dinamik state'e alıyoruz
  const animBar1 = useRef(new Animated.Value(0)).current;
  const animBar2 = useRef(new Animated.Value(0)).current;
  const comparisonVoteKey = [
    "comparison-vote",
    data.id,
    data.car1.id,
    data.car2.id,
  ].join(":");

  const handleVote = async (choice: "car1" | "car2") => {
    if (!isLoggedIn || !user?.id) {
      router.push(loginRoute(comparisonReturnTo) as any);
      return;
    }

    const previousChoice = votedFor;
    setVotedFor(choice);
    setVotes((prev) => {
      const next = { ...prev };
      if (previousChoice && previousChoice !== choice) {
        next[previousChoice] = Math.max(0, next[previousChoice] - 1);
      }
      if (previousChoice !== choice) {
        next[choice] += 1;
      }
      return next;
    });

    const { data: voteData, error } = await supabase.rpc(
      "submit_comparison_vote",
      {
        p_comparison_key: comparisonVoteKey,
        p_car1_id: data.car1.id,
        p_car2_id: data.car2.id,
        p_choice: choice,
      },
    );

    if (error) {
      Alert.alert("Hata", "Karşılaştırma oyu kaydedilemedi: " + error.message);
      setVotedFor(previousChoice);
      return;
    }

    const result = Array.isArray(voteData) ? voteData[0] : voteData;
    if (result) {
      setVotedFor(result.user_choice || choice);
      setVotes({
        car1: Number(result.car1_votes || 0),
        car2: Number(result.car2_votes || 0),
      });
    }
  };

  const openVehicleQuestion = (car: CarData) => {
    const target = withSearchParams("/post/create", {
      mode: "vehicle-question",
      modelId: car.id,
      carName: car.name,
    });

    if (!isLoggedIn) {
      router.push(loginRoute(target) as any);
      return;
    }

    router.push(target as any);
  };

  const isUuid = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    );

  const fetchComparisonQuestions = useCallback(async () => {
    const modelIds = [data.car1.id, data.car2.id].filter(isUuid);

    if (modelIds.length === 0) {
      setComparisonQuestions([]);
      return;
    }

    setQuestionsLoading(true);
    const { data: postsData, error } = await supabase
      .from("posts")
      .select(
        "id, user, car, title, content, upvotes, comments, created_at, model_id",
      )
      .in("model_id", modelIds)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("Karşılaştırma soruları alınamadı:", error.message);
      setComparisonQuestions([]);
    } else {
      setComparisonQuestions((postsData || []) as ComparisonQuestionPost[]);
    }
    setQuestionsLoading(false);
  }, [data.car1.id, data.car2.id]);

  useFocusEffect(
    useCallback(() => {
      fetchComparisonQuestions();
    }, [fetchComparisonQuestions]),
  );

  const fallbackVehicleSpecs: {
    car1: VehicleSpecRow | null;
    car2: VehicleSpecRow | null;
  } = {
    car1:
      paramCar1Trim ||
      paramCar1Engine ||
      paramCar1Fuel ||
      paramCar1Transmission
        ? {
            id: `${data.car1.id}:catalog-fallback`,
            model_id: data.car1.id,
            year: null,
            trim: paramCar1Trim || null,
            engine: paramCar1Engine || null,
            fuel_type: paramCar1Fuel || null,
            transmission: paramCar1Transmission || null,
            body_type: null,
            power_hp: null,
            torque_nm: null,
            fuel_consumption_l_100km: null,
            boot_space_l: null,
            length_mm: null,
            width_mm: null,
            height_mm: null,
            source: "OtoRehber katalog seçimi",
          }
        : null,
    car2:
      paramCar2Trim ||
      paramCar2Engine ||
      paramCar2Fuel ||
      paramCar2Transmission
        ? {
            id: `${data.car2.id}:catalog-fallback`,
            model_id: data.car2.id,
            year: null,
            trim: paramCar2Trim || null,
            engine: paramCar2Engine || null,
            fuel_type: paramCar2Fuel || null,
            transmission: paramCar2Transmission || null,
            body_type: null,
            power_hp: null,
            torque_nm: null,
            fuel_consumption_l_100km: null,
            boot_space_l: null,
            length_mm: null,
            width_mm: null,
            height_mm: null,
            source: "OtoRehber katalog seçimi",
          }
        : null,
  };
  const effectiveVehicleSpecs = {
    car1: vehicleSpecs.car1 || fallbackVehicleSpecs.car1,
    car2: vehicleSpecs.car2 || fallbackVehicleSpecs.car2,
  };
  const car1Stats = statsFromSpec(effectiveVehicleSpecs.car1);
  const car2Stats = statsFromSpec(effectiveVehicleSpecs.car2);
  const hasTechnicalSpecs = Boolean(
    effectiveVehicleSpecs.car1 || effectiveVehicleSpecs.car2,
  );
  const hasOnlyCatalogFallbackSpecs =
    !vehicleSpecs.car1 &&
    !vehicleSpecs.car2 &&
    (hasFallbackSpecData(fallbackVehicleSpecs.car1) ||
      hasFallbackSpecData(fallbackVehicleSpecs.car2));
  const car1SpecLabel = describeVehicleSpec(effectiveVehicleSpecs.car1);
  const car2SpecLabel = describeVehicleSpec(effectiveVehicleSpecs.car2);

  const saveCar = async (car: CarData) => {
    if (!isLoggedIn || !user?.id) {
      router.push(loginRoute(comparisonReturnTo) as any);
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
      car_key: car.id,
      model_id: isUuid(car.id) ? car.id : null,
      car_name: car.name,
      trim: car.trim,
      save_intent: "considering_purchase",
    };

    const { data: existingSavedCar, error: existingError } = await supabase
      .from("saved_cars")
      .select("id")
      .eq("user_id", user.id)
      .eq("car_key", car.id)
      .maybeSingle();

    if (existingError) {
      Alert.alert("Hata", "Kaydetme durumu kontrol edilemedi.");
      return;
    }

    const { error } = existingSavedCar?.id
      ? await supabase
          .from("saved_cars")
          .update(payload)
          .eq("id", existingSavedCar.id)
      : await supabase.from("saved_cars").insert(payload);

    if (error) {
      const isMissingSavedCarsColumn =
        error.message.includes("saved_cars.car_key") ||
        error.message.includes("saved_cars.car_name") ||
        error.message.includes("saved_cars.save_intent");

      if (isMissingSavedCarsColumn) {
        Alert.alert(
          "Kaydetme şu anda kullanılamıyor",
          "Araç şu anda kaydedilemiyor. Lütfen daha sonra tekrar dene.",
        );
        return;
      }

      Alert.alert("Hata", "Araç kaydedilemedi: " + error.message);
      return;
    }

    setSavedCarKeys((prev) => ({ ...prev, [car.id]: true }));
    Alert.alert("Kaydedildi", `${car.name} kaydedilen araçlara eklendi.`);
  };

  useEffect(() => {
    let isMounted = true;

    const fetchSavedCars = async () => {
      if (!user?.id) {
        if (isMounted) setSavedCarKeys({});
        return;
      }

      const carKeys = [data.car1.id, data.car2.id].filter(Boolean);
      if (carKeys.length === 0) {
        if (isMounted) setSavedCarKeys({});
        return;
      }

      const { data: savedData, error } = await supabase
        .from("saved_cars")
        .select("car_key")
        .eq("user_id", user.id)
        .in("car_key", carKeys);

      if (error) {
        console.error("Karşılaştırma kayıt durumu alınamadı:", error.message);
        return;
      }

      if (isMounted) {
        const nextState = (savedData || []).reduce(
          (acc: Record<string, boolean>, item: any) => {
            if (item.car_key) acc[item.car_key] = true;
            return acc;
          },
          {},
        );
        setSavedCarKeys(nextState);
      }
    };

    fetchSavedCars();

    return () => {
      isMounted = false;
    };
  }, [user?.id, data.car1.id, data.car2.id]);

  useEffect(() => {
    let isMounted = true;
    const ids = [data.car1.id, data.car2.id].filter(isUuid);

    if (ids.length === 0) {
      setVehicleSpecs({ car1: null, car2: null });
      setIsLoadingVehicleSpecs(false);
      return;
    }

    const fetchVehicleSpecs = async () => {
      setIsLoadingVehicleSpecs(true);
      const { data: specsData, error } = await supabase
        .from("vehicle_specs")
        .select(
          "id, model_id, year, trim, engine, fuel_type, transmission, body_type, power_hp, torque_nm, fuel_consumption_l_100km, boot_space_l, length_mm, width_mm, height_mm, source",
        )
        .in("model_id", ids)
        .order("year", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (!isMounted) return;

      if (error) {
        setVehicleSpecs({ car1: null, car2: null });
        setVehicleSpecsSchemaMissing(isVehicleSpecsSchemaError(error.message));
        setIsLoadingVehicleSpecs(false);
        console.error("Teknik araç verileri alınamadı:", error.message);
        return;
      }

      setVehicleSpecsSchemaMissing(false);
      const specsByModel = new Map<string, VehicleSpecRow[]>();
      (specsData || []).forEach((item: any) => {
        if (!item.model_id) return;
        const current = specsByModel.get(item.model_id) || [];
        current.push(item as VehicleSpecRow);
        specsByModel.set(item.model_id, current);
      });

      const pickSpec = (modelId: string, preferredTrim?: string) => {
        const rows = specsByModel.get(modelId) || [];
        if (!preferredTrim) return rows[0] || null;
        const normalizedTrim = preferredTrim.trim().toLocaleLowerCase("tr-TR");
        return (
          rows.find(
            (item) =>
              item.trim?.trim().toLocaleLowerCase("tr-TR") === normalizedTrim,
          ) ||
          rows[0] ||
          null
        );
      };

      setVehicleSpecs({
        car1: isUuid(data.car1.id)
          ? pickSpec(data.car1.id, paramCar1Trim)
          : null,
        car2: isUuid(data.car2.id)
          ? pickSpec(data.car2.id, paramCar2Trim)
          : null,
      });
      setIsLoadingVehicleSpecs(false);
    };

    fetchVehicleSpecs();

    return () => {
      isMounted = false;
    };
  }, [data.car1.id, data.car2.id, paramCar1Trim, paramCar2Trim]);

  useEffect(() => {
    let isMounted = true;

    const loadSavedVote = async () => {
      const { data: summaryData, error } = await supabase.rpc(
        "get_comparison_vote_summary",
        { p_comparison_key: comparisonVoteKey },
      );

      if (!isMounted) return;

      if (error) {
        console.error("Karşılaştırma oyu okunamadı:", error.message);
        setVotedFor(null);
        setVotes(data.votes);
        animBar1.setValue(0);
        animBar2.setValue(0);
        return;
      }

      const summary = Array.isArray(summaryData) ? summaryData[0] : summaryData;
      setVotedFor(
        summary?.user_choice === "car1" || summary?.user_choice === "car2"
          ? summary.user_choice
          : null,
      );
      setVotes({
        car1: Number(summary?.car1_votes || 0),
        car2: Number(summary?.car2_votes || 0),
      });

      if (!summary?.user_choice) {
        animBar1.setValue(0);
        animBar2.setValue(0);
      }
    };

    loadSavedVote();

    return () => {
      isMounted = false;
    };
  }, [comparisonVoteKey, data.votes, animBar1, animBar2]);

  useEffect(() => {
    if (votedFor) {
      // Yüzde Hesaplama (Dinamik State Üzerinden)
      const totalVotes = votes.car1 + votes.car2;
      const c1Percent = totalVotes > 0 ? (votes.car1 / totalVotes) * 100 : 0;
      const c2Percent = totalVotes > 0 ? (votes.car2 / totalVotes) * 100 : 0;

      // Animasyonları Başlat
      Animated.parallel([
        Animated.timing(animBar1, {
          toValue: c1Percent,
          duration: 800,
          useNativeDriver: false,
        }),
        Animated.timing(animBar2, {
          toValue: c2Percent,
          duration: 800,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [votedFor, votes, animBar1, animBar2]);

  if (!data) return null; // Yükleme durumu buraya eklenebilir

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: palette.background }]}
      edges={["top"]}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Header ── */}
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome6 name="arrow-left" size={18} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: palette.text }]}>
          Karşılaştırma Detayı
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 60 },
        ]}
      >
        {/* ── Üst Alan (VS Hero) ── */}
        <View
          style={[
            styles.heroSection,
            { backgroundColor: palette.card, borderBottomColor: palette.border },
          ]}
        >
          {/* Sol Araç */}
          <View style={styles.heroCarBox}>
            <View
              style={[
                styles.heroCarIconBox,
                { backgroundColor: palette.elevated, borderColor: palette.border },
              ]}
            >
              <FontAwesome6 name="car-side" size={28} color={Colors.orange} />
            </View>
            <Text
              style={[styles.heroCarName, { color: palette.text }]}
              numberOfLines={2}
            >
              {data.car1.name}
            </Text>
            <Text
              style={[styles.heroCarTrim, { color: palette.muted }]}
              numberOfLines={3}
            >
              {car1SpecLabel || data.car1.trim}
            </Text>
            <View style={styles.heroActions}>
              <TouchableOpacity
                style={[
                  styles.heroIconBtn,
                  { backgroundColor: palette.elevated, borderColor: palette.border },
                ]}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`${data.car1.name} araç detayını aç`}
                onPress={() => router.push(`/trending/${data.car1.id}` as any)}
              >
                <FontAwesome6 name="circle-info" size={12} color={palette.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.heroIconBtn,
                  { backgroundColor: palette.elevated, borderColor: palette.border },
                ]}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`${data.car1.name} aracını kaydet`}
                onPress={() =>
                  saveCar({
                    ...data.car1,
                    trim: car1SpecLabel || data.car1.trim,
                  })
                }
              >
                <FontAwesome6
                  name="bookmark"
                  size={12}
                  color={savedCarKeys[data.car1.id] ? Colors.orange : palette.muted}
                  solid={Boolean(savedCarKeys[data.car1.id])}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* VS Rozeti */}
          <View style={styles.vsBadgeContainer}>
            <View
              style={[
                styles.vsBadge,
                { backgroundColor: palette.background },
              ]}
            >
              <Text style={styles.vsBadgeText}>VS</Text>
            </View>
          </View>

          {/* Sağ Araç */}
          <View style={styles.heroCarBox}>
            <View
              style={[
                styles.heroCarIconBox,
                { backgroundColor: palette.elevated, borderColor: palette.border },
              ]}
            >
              <FontAwesome6 name="car-side" size={28} color={Colors.orange} />
            </View>
            <Text
              style={[styles.heroCarName, { color: palette.text }]}
              numberOfLines={2}
            >
              {data.car2.name}
            </Text>
            <Text
              style={[styles.heroCarTrim, { color: palette.muted }]}
              numberOfLines={3}
            >
              {car2SpecLabel || data.car2.trim}
            </Text>
            <View style={styles.heroActions}>
              <TouchableOpacity
                style={[
                  styles.heroIconBtn,
                  { backgroundColor: palette.elevated, borderColor: palette.border },
                ]}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`${data.car2.name} araç detayını aç`}
                onPress={() => router.push(`/trending/${data.car2.id}` as any)}
              >
                <FontAwesome6 name="circle-info" size={12} color={palette.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.heroIconBtn,
                  { backgroundColor: palette.elevated, borderColor: palette.border },
                ]}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`${data.car2.name} aracını kaydet`}
                onPress={() =>
                  saveCar({
                    ...data.car2,
                    trim: car2SpecLabel || data.car2.trim,
                  })
                }
              >
                <FontAwesome6
                  name="bookmark"
                  size={12}
                  color={savedCarKeys[data.car2.id] ? Colors.orange : palette.muted}
                  solid={Boolean(savedCarKeys[data.car2.id])}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Canlı Anket (Live Poll) ── */}
        <View
          style={[
            styles.sectionCard,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <View style={styles.sectionHeader}>
            <FontAwesome6 name="fire" size={16} color={Colors.orange} solid />
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              Senin Tercihin Hangisi?
            </Text>
          </View>

          {!votedFor ? (
            <View style={styles.pollButtonsRow}>
              <TouchableOpacity
                style={[
                  styles.pollBtn,
                  { backgroundColor: palette.elevated, borderColor: palette.border },
                ]}
                activeOpacity={0.8}
                onPress={() => handleVote("car1")}
              >
                <Text style={[styles.pollBtnText, { color: palette.softText }]}>
                  {data.car1.name}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.pollBtn,
                  { backgroundColor: palette.elevated, borderColor: palette.border },
                ]}
                activeOpacity={0.8}
                onPress={() => handleVote("car2")}
              >
                <Text style={[styles.pollBtnText, { color: palette.softText }]}>
                  {data.car2.name}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.pollResultContainer}>
              {/* Sol Çubuk (Araç 1) */}
              <View style={styles.pollResultItem}>
                <Text style={[styles.pollResultName, { color: palette.softText }]}>
                  {data.car1.name}
                </Text>
                <View
                  style={[
                    styles.pollResultTrack,
                    { backgroundColor: palette.elevated, borderColor: palette.border },
                  ]}
                >
                  <Animated.View
                    style={[
                      styles.pollResultFill,
                      votedFor === "car1" && styles.pollResultFillActive,
                      {
                        width: animBar1.interpolate({
                          inputRange: [0, 100],
                          outputRange: ["0%", "100%"],
                        }),
                      },
                    ]}
                  />
                  <Text style={[styles.pollResultPercent, { color: palette.text }]}>
                    %
                    {votes.car1 + votes.car2 > 0
                      ? Math.round(
                          (votes.car1 / (votes.car1 + votes.car2)) * 100,
                        )
                      : 0}
                  </Text>
                </View>
              </View>

              {/* Sağ Çubuk (Araç 2) */}
              <View style={styles.pollResultItem}>
                <Text style={[styles.pollResultName, { color: palette.softText }]}>
                  {data.car2.name}
                </Text>
                <View
                  style={[
                    styles.pollResultTrack,
                    { backgroundColor: palette.elevated, borderColor: palette.border },
                  ]}
                >
                  <Animated.View
                    style={[
                      styles.pollResultFill,
                      votedFor === "car2" && styles.pollResultFillActive,
                      {
                        width: animBar2.interpolate({
                          inputRange: [0, 100],
                          outputRange: ["0%", "100%"],
                        }),
                      },
                    ]}
                  />
                  <Text style={[styles.pollResultPercent, { color: palette.text }]}>
                    %
                    {votes.car1 + votes.car2 > 0
                      ? Math.round(
                          (votes.car2 / (votes.car1 + votes.car2)) * 100,
                        )
                      : 0}
                  </Text>
                </View>
              </View>
              <Text style={[styles.pollTotalVotes, { color: palette.muted }]}>
                Toplam {votes.car1 + votes.car2} Oy
              </Text>
            </View>
          )}
        </View>

        {/* ── Teknik Özellikler Kıyaslaması ── */}
        <View
          style={[
            styles.sectionCard,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              { marginBottom: 16, color: palette.text },
            ]}
          >
            Teknik Kıyaslama
          </Text>

          {isLoadingVehicleSpecs ? (
            <View
              style={[
                styles.specEmptyBox,
                { backgroundColor: palette.elevated, borderColor: palette.border },
              ]}
            >
              <ActivityIndicator size="small" color={Colors.orange} />
              <Text style={[styles.specEmptyTitle, { color: palette.text }]}>
                Teknik veriler yükleniyor
              </Text>
            </View>
          ) : vehicleSpecsSchemaMissing ? (
            <View
              style={[
                styles.specEmptyBox,
                { backgroundColor: palette.elevated, borderColor: palette.border },
              ]}
            >
              <FontAwesome6 name="database" size={18} color={Colors.orange} />
              <Text style={[styles.specEmptyTitle, { color: palette.text }]}>
                Teknik bilgiler yüklenemedi
              </Text>
              <Text style={[styles.specEmptyText, { color: palette.muted }]}>
                Teknik araç verileri şu anda kullanılamıyor. Lütfen daha sonra
                tekrar dene.
              </Text>
            </View>
          ) : hasTechnicalSpecs ? (
            <>
              <View
                style={[
                  styles.specSummaryRow,
                  { backgroundColor: palette.elevated, borderColor: palette.border },
                ]}
              >
                <View style={styles.specSummaryCol}>
                  <Text style={[styles.specSummaryTitle, { color: palette.text }]}>
                    {data.car1.name}
                  </Text>
                  <Text style={[styles.specSummaryText, { color: palette.muted }]}>
                    {car1SpecLabel || "Teknik veri bekleniyor"}
                  </Text>
                </View>
                <View
                  style={[
                    styles.specSummaryDivider,
                    { backgroundColor: palette.border },
                  ]}
                />
                <View style={styles.specSummaryCol}>
                  <Text style={[styles.specSummaryTitle, { color: palette.text }]}>
                    {data.car2.name}
                  </Text>
                  <Text style={[styles.specSummaryText, { color: palette.muted }]}>
                    {car2SpecLabel || "Teknik veri bekleniyor"}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.specTextTable,
                  { backgroundColor: palette.elevated, borderColor: palette.border },
                ]}
              >
                {hasOnlyCatalogFallbackSpecs ? (
                  <View
                    style={[
                      styles.specFallbackNotice,
                      { borderBottomColor: palette.border },
                    ]}
                  >
                    <FontAwesome6
                      name="circle-info"
                      size={13}
                      color={Colors.orange}
                    />
                    <Text
                      style={[
                        styles.specFallbackNoticeText,
                        { color: palette.muted },
                      ]}
                    >
                      Bu kıyaslama, seçtiğin katalog seviyesindeki teknik
                      bilgilerle gösteriliyor. Detaylı ölçüm verileri geldikçe
                      otomatik zenginleşir.
                    </Text>
                  </View>
                ) : null}
                <SpecTextRow
                  label="Model Yılı"
                  value1={effectiveVehicleSpecs.car1?.year}
                  value2={effectiveVehicleSpecs.car2?.year}
                  palette={palette}
                />
                <SpecTextRow
                  label="Donanım"
                  value1={effectiveVehicleSpecs.car1?.trim}
                  value2={effectiveVehicleSpecs.car2?.trim}
                  palette={palette}
                />
                <SpecTextRow
                  label="Motor"
                  value1={effectiveVehicleSpecs.car1?.engine}
                  value2={effectiveVehicleSpecs.car2?.engine}
                  palette={palette}
                />
                <SpecTextRow
                  label="Yakıt"
                  value1={translateFuelType(effectiveVehicleSpecs.car1?.fuel_type)}
                  value2={translateFuelType(effectiveVehicleSpecs.car2?.fuel_type)}
                  palette={palette}
                />
                <SpecTextRow
                  label="Şanzıman"
                  value1={effectiveVehicleSpecs.car1?.transmission}
                  value2={effectiveVehicleSpecs.car2?.transmission}
                  palette={palette}
                />
                <SpecTextRow
                  label="Kasa Tipi"
                  value1={effectiveVehicleSpecs.car1?.body_type}
                  value2={effectiveVehicleSpecs.car2?.body_type}
                  palette={palette}
                />
              </View>

              <VsStatBar
                label="Motor Gücü"
                val1={car1Stats.power}
                val2={car2Stats.power}
                max={350}
                unit="BG"
                palette={palette}
              />
              <VsStatBar
                label="Tork"
                val1={car1Stats.torque}
                val2={car2Stats.torque}
                max={600}
                unit="Nm"
                palette={palette}
              />
              <VsStatBar
                label="Yakıt Tüketimi (Ort.)"
                val1={car1Stats.fuel}
                val2={car2Stats.fuel}
                max={12}
                unit="L/100 km"
                palette={palette}
                invert
              />
              <VsStatBar
                label="Bagaj Hacmi"
                val1={car1Stats.bootSpace}
                val2={car2Stats.bootSpace}
                max={700}
                unit="L"
                palette={palette}
              />
              <VsStatBar
                label="Uzunluk"
                val1={car1Stats.length}
                val2={car2Stats.length}
                max={5500}
                unit="mm"
                palette={palette}
              />
              <VsStatBar
                label="Genişlik"
                val1={car1Stats.width}
                val2={car2Stats.width}
                max={2200}
                unit="mm"
                palette={palette}
              />
              <VsStatBar
                label="Yükseklik"
                val1={car1Stats.height}
                val2={car2Stats.height}
                max={2200}
                unit="mm"
                palette={palette}
              />
            </>
          ) : (
            <View
              style={[
                styles.specEmptyBox,
                { backgroundColor: palette.elevated, borderColor: palette.border },
              ]}
            >
              <FontAwesome6 name="circle-info" size={18} color={palette.muted} />
              <Text style={[styles.specEmptyTitle, { color: palette.text }]}>
                Teknik veri yok
              </Text>
              <Text style={[styles.specEmptyText, { color: palette.muted }]}>
                Bu iki model için henüz teknik özellik girilmemiş. Veri eklendiğinde
                karşılaştırma otomatik olarak dolacak.
              </Text>
            </View>
          )}
        </View>

        {/* ── Sanayi Notları (Kronik Sorunlar) ── */}
        <View
          style={[
            styles.sectionCard,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <View style={styles.sectionHeader}>
            <FontAwesome6 name="wrench" size={16} color="#ef4444" solid />
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              Sanayi Notları (Kronikler)
            </Text>
          </View>

          <View style={styles.chronicGrid}>
            {/* Sol Kolon */}
            <View style={styles.chronicCol}>
              <Text style={[styles.chronicColTitle, { color: palette.softText }]}>
                {data.car1.name}
              </Text>
              {data.car1.chronicIssues.map((issue, idx) => (
                <View key={`c1-${idx}`} style={styles.chronicBadge}>
                  <FontAwesome6
                    name="triangle-exclamation"
                    size={10}
                    color="#ef4444"
                  />
                  <Text style={[styles.chronicText, { color: palette.text }]}>
                    {issue}
                  </Text>
                </View>
              ))}
            </View>
            {/* Dikey Ayırıcı */}
            <View style={[styles.chronicDivider, { backgroundColor: palette.border }]} />
            {/* Sağ Kolon */}
            <View style={styles.chronicCol}>
              <Text style={[styles.chronicColTitle, { color: palette.softText }]}>
                {data.car2.name}
              </Text>
              {data.car2.chronicIssues.map((issue, idx) => (
                <View key={`c2-${idx}`} style={styles.chronicBadge}>
                  <FontAwesome6
                    name="triangle-exclamation"
                    size={10}
                    color="#ef4444"
                  />
                  <Text style={[styles.chronicText, { color: palette.text }]}>
                    {issue}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View
            style={[
              styles.askQuestionBox,
              { backgroundColor: palette.elevated, borderColor: palette.border },
            ]}
          >
            <View style={styles.askQuestionHeader}>
              <FontAwesome6 name="circle-question" size={16} color={Colors.orange} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.askQuestionTitle, { color: palette.text }]}>
                  Bu araçlar hakkında merak ettiğin bir şey mi var?
                </Text>
                <Text style={[styles.askQuestionText, { color: palette.muted }]}>
                  Sorunu ilgili araca bağlayarak paylaş.
                </Text>
              </View>
            </View>
            <View style={styles.askQuestionActions}>
              <TouchableOpacity
                style={[
                  styles.askQuestionBtn,
                  { backgroundColor: palette.card, borderColor: palette.border },
                ]}
                activeOpacity={0.85}
                onPress={() => openVehicleQuestion(data.car1)}
              >
                <Text style={[styles.askQuestionBtnText, { color: palette.text }]}>
                  {data.car1.name}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.askQuestionBtn,
                  { backgroundColor: palette.card, borderColor: palette.border },
                ]}
                activeOpacity={0.85}
                onPress={() => openVehicleQuestion(data.car2)}
              >
                <Text style={[styles.askQuestionBtnText, { color: palette.text }]}>
                  {data.car2.name}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.sectionCard,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <View style={styles.sectionHeader}>
            <FontAwesome6 name="comments" size={16} color={Colors.orange} solid />
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              Bu Karşılaştırmadaki Sorular
            </Text>
          </View>

          {questionsLoading ? (
            <View
              style={[
                styles.emptyQuestionsBox,
                { backgroundColor: palette.elevated, borderColor: palette.border },
              ]}
            >
              <ActivityIndicator color={Colors.orange} />
            </View>
          ) : comparisonQuestions.length === 0 ? (
            <View
              style={[
                styles.emptyQuestionsBox,
                { backgroundColor: palette.elevated, borderColor: palette.border },
              ]}
            >
              <FontAwesome6 name="circle-question" size={18} color={palette.muted} />
              <Text style={[styles.emptyQuestionsText, { color: palette.muted }]}>
                Bu araçlar için henüz soru yok.
              </Text>
            </View>
          ) : (
            <View style={styles.questionList}>
              {comparisonQuestions.map((post) => (
                <TouchableOpacity
                  key={post.id}
                  style={[
                    styles.questionCard,
                    { backgroundColor: palette.elevated, borderColor: palette.border },
                  ]}
                  activeOpacity={0.86}
                  onPress={() => router.push(`/post/${post.id}` as any)}
                >
                  <View style={styles.questionHeader}>
                    <View
                      style={[
                        styles.questionAvatar,
                        { backgroundColor: palette.card, borderColor: palette.border },
                      ]}
                    >
                      <Text style={styles.questionInitials}>
                        {getInitials(post.user)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.questionAuthor, { color: palette.text }]}>
                        {post.user || "Bilinmeyen kullanıcı"}
                      </Text>
                      <Text style={[styles.questionMeta, { color: palette.muted }]}>
                        {[post.car || "Araç bilgisi yok", formatShortDate(post.created_at)]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    </View>
                    <FontAwesome6 name="chevron-right" size={12} color={palette.muted} />
                  </View>
                  <Text style={[styles.questionTitle, { color: palette.text }]}>
                    {post.title || "Başlıksız soru"}
                  </Text>
                  {!!post.content && (
                    <Text
                      style={[styles.questionContent, { color: palette.softText }]}
                    >
                      {post.content}
                    </Text>
                  )}
                  <View style={styles.questionStatsRow}>
                    <View style={styles.questionStat}>
                      <FontAwesome6 name="thumbs-up" size={11} color={palette.muted} />
                      <Text style={[styles.questionStatText, { color: palette.muted }]}>
                        {post.upvotes || 0}
                      </Text>
                    </View>
                    <View style={styles.questionStat}>
                      <FontAwesome6 name="comment" size={11} color={palette.muted} />
                      <Text style={[styles.questionStatText, { color: palette.muted }]}>
                        {post.comments || 0}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Stiller ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.navyMain },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.navyBorder,
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 16, fontWeight: "800", color: Colors.white },
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1 },

  // Hero VS Area
  heroSection: {
    flexDirection: "row",
    padding: 20,
    alignItems: "flex-start",
    justifyContent: "space-between",
    backgroundColor: Colors.navyCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.navyBorder,
  },
  heroCarBox: { flex: 1, alignItems: "center", minWidth: 0 },
  heroCarIconBox: {
    width: "100%",
    height: 80,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: Colors.navyMain,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCarName: {
    minHeight: 36,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    color: Colors.white,
    textAlign: "center",
    textAlignVertical: "center",
  },
  heroCarTrim: {
    minHeight: 45,
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textMuted,
    textAlign: "center",
    textAlignVertical: "top",
    marginTop: 2,
  },
  heroActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
  },
  heroIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.navyMain,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  vsBadgeContainer: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
    zIndex: 10,
  },
  vsBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.navyMain,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: Colors.orange,
    boxShadow: "0 0 10px rgba(249, 115, 22, 0.8)",
    elevation: 5,
  },
  vsBadgeText: { fontSize: 14, fontWeight: "900", color: Colors.orange },

  // Cards & Sections
  sectionCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: Colors.navyCard,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: Colors.white },
  specSummaryRow: {
    flexDirection: "row",
    backgroundColor: Colors.navyMain,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
  },
  specSummaryCol: { flex: 1, gap: 4 },
  specSummaryDivider: {
    width: 1,
    backgroundColor: Colors.navyBorder,
    marginHorizontal: 10,
  },
  specSummaryTitle: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  specSummaryText: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
  specTextTable: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 18,
  },
  specFallbackNotice: {
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  specFallbackNoticeText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700",
  },
  specTextRow: {
    minHeight: 54,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  specTextValue: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  specTextLabel: {
    width: 72,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  specEmptyBox: {
    alignItems: "center",
    backgroundColor: Colors.navyMain,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    borderRadius: 12,
    padding: 18,
    gap: 8,
  },
  specEmptyTitle: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  specEmptyText: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },

  // Poll
  pollButtonsRow: { flexDirection: "row", gap: 12 },
  pollBtn: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: Colors.navyMain,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    borderRadius: 12,
    alignItems: "center",
  },
  pollBtnText: { color: Colors.gray300, fontSize: 13, fontWeight: "700" },
  pollResultContainer: { gap: 12 },
  pollResultItem: { gap: 6 },
  pollResultName: { fontSize: 12, fontWeight: "600", color: Colors.gray300 },
  pollResultTrack: {
    height: 32,
    backgroundColor: Colors.navyMain,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    overflow: "hidden",
    justifyContent: "center",
  },
  pollResultFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: Colors.navyBorder,
  },
  pollResultFillActive: { backgroundColor: Colors.orange },
  pollResultPercent: {
    position: "absolute",
    right: 12,
    fontSize: 12,
    fontWeight: "800",
    color: Colors.white,
  },
  pollTotalVotes: {
    textAlign: "center",
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 8,
  },

  // Stats Bar Component
  statContainer: { marginBottom: 16 },
  statLabel: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
    color: Colors.gray300,
    marginBottom: 6,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statValue: {
    width: 64,
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: "center",
    fontWeight: "600",
  },
  statWinnerText: { color: Colors.orange, fontWeight: "800" },
  barsArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  barLeftWrapper: { flex: 1, alignItems: "flex-end" }, // Sola doğru büyümesi için
  barLeft: { height: 8, borderTopLeftRadius: 4, borderBottomLeftRadius: 4 },
  barCenterDiv: {
    width: 2,
    height: 16,
    backgroundColor: Colors.navyBorder,
    marginHorizontal: 2,
  },
  barRightWrapper: { flex: 1, alignItems: "flex-start" },
  barRight: { height: 8, borderTopRightRadius: 4, borderBottomRightRadius: 4 },

  // Chronic Grid
  chronicGrid: { flexDirection: "row" },
  chronicCol: { flex: 1 },
  chronicDivider: {
    width: 1,
    backgroundColor: Colors.navyBorder,
    marginHorizontal: 12,
  },
  chronicColTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.gray300,
    marginBottom: 10,
    textAlign: "center",
  },
  chronicBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
  },
  chronicText: {
    color: Colors.white,
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
  askQuestionBox: {
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  askQuestionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 12,
  },
  askQuestionTitle: {
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19,
  },
  askQuestionText: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  askQuestionActions: {
    flexDirection: "row",
    gap: 10,
  },
  askQuestionBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  askQuestionBtnText: {
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  questionList: {
    gap: 10,
  },
  questionCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  questionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  questionAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  questionInitials: {
    color: Colors.orange,
    fontSize: 12,
    fontWeight: "900",
  },
  questionAuthor: {
    fontSize: 13,
    fontWeight: "800",
  },
  questionMeta: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  questionTitle: {
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19,
  },
  questionContent: {
    fontSize: 12,
    lineHeight: 18,
  },
  questionStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  questionStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  questionStatText: {
    fontSize: 12,
    fontWeight: "800",
  },
  emptyQuestionsBox: {
    minHeight: 96,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    gap: 8,
  },
  emptyQuestionsText: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
});
