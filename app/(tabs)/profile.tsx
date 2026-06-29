import Colors from "@/constants/Colors";
import { FontAwesome6 } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { supabase } from "../../supabaseClient";
import { uploadPublicFiles } from "../../utils/storageUpload";
import { useAuth } from "../../contexts/AuthContext";
import { Review, useReviews } from "../../contexts/ReviewContext";
import { ThemePreference, useAppTheme } from "../../contexts/ThemeContext";
import { getCommunityById } from "../../utils/communities";
import { validateCleanContent } from "../../utils/contentModeration";
import VehicleCatalogPicker from "../../components/VehicleCatalogPicker";
import { VehicleCatalogSelection } from "../../utils/vehicleCatalog";
import PhotoCarousel from "../../components/PhotoCarousel";

type ProfileStats = {
  joinedText: string;
  reviewsCount: number;
  helpfulVotesCount: number;
  carsCount: number;
  reviewPhotosCount: number;
  communitiesCount: number;
};

type ProfileCommunity = {
  id: string;
  name: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  showOnProfile: boolean;
  useVehicleBadge: boolean;
  notificationsEnabled: boolean;
};

const INITIAL_PROFILE_STATS: ProfileStats = {
  joinedText: "Yeni üye",
  reviewsCount: 0,
  helpfulVotesCount: 0,
  carsCount: 0,
  reviewPhotosCount: 0,
  communitiesCount: 0,
};

const BADGE_RULES: Array<{
  id: string;
  icon: React.ComponentProps<typeof FontAwesome6>["name"];
  title: string;
  color: string;
  isEarned: (stats: ProfileStats) => boolean;
}> = [
  {
    id: "first-review",
    icon: "pen-nib",
    title: "İlk\nYorum",
    color: Colors.orange,
    isEarned: (stats) => stats.reviewsCount >= 1,
  },
  {
    id: "garage-owner",
    icon: "warehouse",
    title: "Garaj\nSahibi",
    color: "#60a5fa",
    isEarned: (stats) => stats.carsCount >= 1,
  },
  {
    id: "detailed-eye",
    icon: "camera",
    title: "Detaylı\nGöz",
    color: "#a78bfa",
    isEarned: (stats) => stats.reviewPhotosCount >= 3,
  },
  {
    id: "helpful-member",
    icon: "handshake-angle",
    title: "Yardımsever\nÜye",
    color: "#4ade80",
    isEarned: (stats) => stats.helpfulVotesCount >= 10,
  },
  {
    id: "master-reviewer",
    icon: "fire",
    title: "Usta\nYorumcu",
    color: "#fb923c",
    isEarned: (stats) => stats.reviewsCount >= 5,
  },
];

const MENU_ITEMS = [
  {
    id: "garage",
    icon: "warehouse",
    title: "Garajım",
    isSolid: true,
  },
  {
    id: "saved",
    icon: "bookmark",
    title: "Kaydedilen Araçlar",
    isSolid: false,
  },
  {
    id: "reviews",
    icon: "message",
    title: "Yorumlarım ve Puanlarım",
    isSolid: false,
  },
  {
    id: "following",
    icon: "user-group",
    title: "Takip Edilenler ve Kullanıcı Ara",
    isSolid: true,
  },
  {
    id: "security",
    icon: "shield-halved",
    title: "Hesap ve Güvenlik",
    isSolid: true,
  },
  {
    id: "notifications",
    icon: "bell",
    title: "Bildirim Ayarları",
    isSolid: false,
  },
];

const ADMIN_MENU_ITEM = {
  id: "moderation",
  icon: "user-shield",
  title: "Moderasyon Paneli",
  isSolid: true,
};

// ─── Yardımcı Fonksiyonlar ────────────────────────────────────────────────────
const getInitials = (name: string) => {
  const parts = (name || "")
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g, ""))
    .filter(Boolean);

  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();

  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
};

const getDisplayName = (name?: string | null) => {
  const trimmed = name?.trim();
  if (!trimmed || trimmed.includes("@")) return "Sürücü";
  return trimmed;
};

const getJoinedText = (createdAt?: string | null) => {
  if (!createdAt) return "Yeni üye";

  const joinedDate = new Date(createdAt);
  if (Number.isNaN(joinedDate.getTime())) return "Yeni üye";

  return `${joinedDate.toLocaleDateString("tr-TR", {
    month: "long",
    year: "numeric",
  })}'ten beri üye`;
};

// ─── Araç Deneyimini Paylaş Modal ─────────────────────────────────────────────
export function AddReviewModal({
  visible,
  onClose,
  onSave,
  userName,
  userAvatar,
  initialSearchText,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (review: Review) => void;
  userName: string;
  userAvatar: string;
  initialSearchText?: string;
}) {
  const { palette } = useAppTheme();
  const [missingCar, setMissingCar] = useState(false);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [brandList, setBrandList] = useState<
    { label: string; value: string }[]
  >([]);
  const [isBrandDropdownVisible, setIsBrandDropdownVisible] = useState(false);
  const [isLoadingBrands, setIsLoadingBrands] = useState(false);

  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [modelList, setModelList] = useState<
    { label: string; value: string }[]
  >([]);
  const [isModelDropdownVisible, setIsModelDropdownVisible] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [catalogPickerVisible, setCatalogPickerVisible] = useState(false);
  const [selectedVehicleTrim, setSelectedVehicleTrim] = useState("");

  const [title, setTitle] = useState("");
  const [experience, setExperience] = useState("");
  const [generalRating, setGeneralRating] = useState(0);
  const [detailedOpen, setDetailedOpen] = useState(false);
  const [detailedRatings, setDetailedRatings] = useState<
    Record<string, number>
  >({});

  const [buyYear, setBuyYear] = useState("");
  const [duration, setDuration] = useState("");
  const [km, setKm] = useState("");
  const [ownership, setOwnership] = useState("");
  const [isOwnershipDropdownOpen, setIsOwnershipDropdownOpen] = useState(false);
  const [pros, setPros] = useState("");
  const [cons, setCons] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [recommend, setRecommend] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal açıldığında, Supabase'den markaları çek ve arama metni varsa otomatik seç
  useEffect(() => {
    if (!visible) return;

    const fetchBrands = async () => {
      setIsLoadingBrands(true);
      try {
        const { data } = await supabase
          .from("brands")
          .select("id, name")
          .order("name", { ascending: true });
        if (data) {
          const formatted = data.map((b: any) => ({
            label: b.name || b.brand_name || "Bilinmiyor",
            value: b.id,
          }));
          setBrandList(formatted);

          if (initialSearchText) {
            const searchTextLower = initialSearchText.toLowerCase();
            const matched = formatted.find((b: any) =>
              searchTextLower.includes(b.label.toLowerCase()),
            );
            if (matched) {
              setSelectedBrandId(matched.value);
            }
          }
        }
      } catch (e) {
        console.error("Markalar çekilirken hata:", e);
      } finally {
        setIsLoadingBrands(false);
      }
    };

    fetchBrands();
  }, [visible, initialSearchText]);

  // Seçili markaya göre modelleri çek ve arama varsa otomatik seçimi yap
  useEffect(() => {
    const fetchModels = async () => {
      if (!selectedBrandId) {
        setModelList([]);
        setSelectedModelId(null);
        return;
      }
      setIsLoadingModels(true);
      try {
        const { data } = await supabase
          .from("models")
          .select("id, name")
          .eq("brand_id", selectedBrandId)
          .order("name", { ascending: true });

        if (data) {
          const formatted = data.map((m: any) => ({
            label: m.name || m.model_name || "Bilinmiyor",
            value: m.id,
          }));
          setModelList(formatted);

          if (initialSearchText) {
            const searchTextLower = initialSearchText.toLowerCase();
            const matched = formatted.find((m: any) =>
              searchTextLower.includes(m.label.toLowerCase()),
            );
            if (matched) {
              setSelectedModelId(matched.value);
            }
          }
        }
      } catch (e) {
        console.error("Modeller çekilirken hata:", e);
      } finally {
        setIsLoadingModels(false);
      }
    };

    fetchModels();
  }, [selectedBrandId, initialSearchText]);

  const DETAILED_CATS = [
    "Konfor",
    "Performans",
    "Yakıt Ekonomisi",
    "Güvenilirlik",
    "Güvenlik",
    "Bakım Maliyeti",
    "İç Mekan Kalitesi",
    "Dış Tasarım",
    "Teknoloji",
    "Fiyat/Performans",
  ];

  const OWNERSHIP_OPTIONS = ["Sıfır", "İkinci el"];

  const canSave =
    selectedBrandId &&
    selectedModelId &&
    title.trim() &&
    experience.trim() &&
    generalRating > 0;

  const handleImagePick = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) return Alert.alert("Hata", "Galeri erişimi gereklidir.");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 5 - images.length,
      quality: 0.8,
    });
    if (!result.canceled) {
      const newUris = result.assets.map((a) => a.uri);
      setImages((prev) => [...prev, ...newUris].slice(0, 5));
    }
  };

  const handleCatalogSelection = async (
    selection: VehicleCatalogSelection,
  ) => {
    setSelectedVehicleTrim(selection.trim);

    const { data: brandRow } = await supabase
      .from("brands")
      .select("id")
      .ilike("name", selection.brand)
      .maybeSingle();
    if (!brandRow?.id) return;

    setSelectedBrandId(brandRow.id);
    const { data: modelRow } = await supabase
      .from("models")
      .select("id")
      .eq("brand_id", brandRow.id)
      .ilike("name", selection.model)
      .maybeSingle();
    setSelectedModelId(modelRow?.id || null);
  };

  const handleSave = async () => {
    const moderation = validateCleanContent([
      { label: "Başlık", value: title },
      { label: "Deneyim", value: experience },
      { label: "Artılar", value: pros },
      { label: "Eksiler", value: cons },
    ]);

    if (!moderation.ok) {
      Alert.alert("Uygunsuz içerik", moderation.message);
      return;
    }

    setIsSubmitting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user?.id) {
        Alert.alert("Hata", "Deneyim paylaşmak için lütfen giriş yapın.");
        return;
      }

      const brandName =
        brandList.find((b) => b.value === selectedBrandId)?.label ||
        "Bilinmiyor";
      const modelName =
        modelList.find((m) => m.value === selectedModelId)?.label ||
        "Bilinmiyor";
      const fullCarName = `${brandName} ${modelName}`.trim();
      const detailedCarName = [fullCarName, selectedVehicleTrim]
        .filter(Boolean)
        .join(" · ");
      const uploadedImages = await uploadPublicFiles(
        images,
        session.user.id,
        "reviews",
      );

      // Araç deneyiminin tek kanonik kaydı reviews tablosudur.
      // Keşfet ekranı reviews kayıtlarını da okuduğu için posts'a kopya yazılmaz.
      const { data: savedReview, error: reviewError } = await supabase
        .from("reviews")
        .insert({
          title,
          comment: experience,
          rating: generalRating,
          user_id: session.user.id,
          user: userName,
          avatar: userAvatar,
          brand_id: selectedBrandId,
          model_id: selectedModelId,
          brand: brandName,
          car: detailedCarName,
          detailed_ratings: detailedRatings,
          buy_year: buyYear,
          duration,
          km,
          ownership,
          pros,
          cons,
          images: uploadedImages,
          recommend,
          date: "Şimdi",
        })
        .select("id")
        .single();

      if (reviewError) throw reviewError;

      if (typeof onSave === "function") {
        onSave({
          id: savedReview.id,
          user: userName,
          brand: brandName,
          car: detailedCarName,
          title,
          rating: generalRating,
          detailedRatings,
          buyYear,
          duration,
          km,
          ownership,
          pros,
          cons,
          images: uploadedImages,
          recommend,
          comment: experience,
          date: "Şimdi",
          avatar: userAvatar,
        });
      }

      // Form alanlarını bir sonraki açılış için sıfırla
      setSelectedBrandId(null);
      setSelectedModelId(null);
      setSelectedVehicleTrim("");
      setTitle("");
      setExperience("");
      setGeneralRating(0);
      setBuyYear("");
      setDuration("");
      setKm("");
      setOwnership("");
      setIsOwnershipDropdownOpen(false);
      setPros("");
      setCons("");
      setDetailedOpen(false);
      setDetailedRatings({});
      setImages([]);
      onClose();
    } catch (err: any) {
      console.error("Gönderi kaydedilirken hata:", err);
      Alert.alert("Hata", "Deneyiminiz paylaşılamadı: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={m.overlay} onPress={onClose} />
      <View style={[m.sheet, { backgroundColor: palette.background }]}>
        <View style={[m.handle, { backgroundColor: palette.border }]} />
        <View style={[m.header, { borderBottomColor: palette.border }]}>
          <Text style={[m.title, { color: palette.text }]}>
            Araç Deneyimini Paylaş
          </Text>
          <TouchableOpacity onPress={onClose} style={m.closeBtn}>
            <FontAwesome6 name="xmark" size={16} color={palette.muted} />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={m.form}
        >
          {/* 1. Araç Bilgileri */}
          <Text style={[m.sectionTitle, { color: palette.text }]}>
            Araç Bilgileri
          </Text>

          <TouchableOpacity
            style={m.checkboxRow}
            onPress={() => setMissingCar(!missingCar)}
            activeOpacity={0.8}
          >
            <FontAwesome6
              name={missingCar ? "check-square" : "square"}
              size={16}
              color={missingCar ? Colors.orange : palette.muted}
              solid={missingCar}
            />
            <Text style={[m.checkboxLabel, { color: palette.muted }]}>
              Aracım listede yok, yeni araç önermek istiyorum
            </Text>
          </TouchableOpacity>

          <Text style={[m.label, { color: palette.softText }]}>
            Araç <Text style={m.required}>*</Text>
          </Text>
          <TouchableOpacity
            style={[
              m.dropdownBtn,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
            onPress={() => setCatalogPickerVisible(true)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                selectedBrandId ? m.dropdownTextActive : m.dropdownText,
                { color: selectedBrandId ? palette.text : palette.muted },
              ]}
            >
              {selectedBrandId && selectedModelId
                ? [
                    brandList.find((b) => b.value === selectedBrandId)?.label,
                    modelList.find((item) => item.value === selectedModelId)
                      ?.label,
                    selectedVehicleTrim,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : "Marka, model, motor ve donanım seç"}
            </Text>
            {isLoadingBrands ? (
              <ActivityIndicator size="small" color={palette.muted} />
            ) : (
              <FontAwesome6
                name="chevron-down"
                size={12}
                color={palette.muted}
              />
            )}
          </TouchableOpacity>

          <Text style={[m.label, { color: palette.softText }]}>
            Başlık <Text style={m.required}>*</Text>
          </Text>
          <TextInput
            style={[
              m.input,
              {
                backgroundColor: palette.card,
                borderColor: palette.border,
                color: palette.text,
              },
            ]}
            value={title}
            onChangeText={setTitle}
            placeholder="örn: 3 yıllık kullanım deneyimim"
            placeholderTextColor={palette.muted}
          />

          <Text style={[m.label, { color: palette.softText }]}>
            Deneyiminiz <Text style={m.required}>*</Text>{" "}
            <Text style={[m.charCount, { color: palette.muted }]}>
              ({experience.length}/100 karakter)
            </Text>
          </Text>
          <TextInput
            style={[
              m.input,
              m.textArea,
              {
                backgroundColor: palette.card,
                borderColor: palette.border,
                color: palette.text,
              },
            ]}
            value={experience}
            onChangeText={setExperience}
            placeholder="Araç hakkındaki deneyimlerinizi detaylı olarak yazın..."
            placeholderTextColor={palette.muted}
            multiline
            textAlignVertical="top"
          />

          <Text style={[m.label, { color: palette.softText }]}>
            Genel Puan <Text style={m.required}>*</Text>
          </Text>
          <View style={m.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => setGeneralRating(star)}
              >
                <FontAwesome6
                  name="star"
                  size={28}
                  solid={generalRating >= star}
                  color={generalRating >= star ? Colors.orange : palette.border}
                />
              </TouchableOpacity>
            ))}
          </View>

          {/* 2. Detaylı Puanlama */}
          <TouchableOpacity
            style={[
              m.accordionHeader,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
            onPress={() => setDetailedOpen(!detailedOpen)}
            activeOpacity={0.8}
          >
            <Text style={[m.accordionTitle, { color: palette.text }]}>
              Detaylı Puanlama (isteğe bağlı)
            </Text>
            <FontAwesome6
              name={detailedOpen ? "chevron-up" : "chevron-down"}
              size={14}
              color={palette.muted}
            />
          </TouchableOpacity>
          {detailedOpen && (
            <View
              style={[
                m.detailedContainer,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
            >
              {DETAILED_CATS.map((cat) => (
                <View key={cat} style={m.detailedRow}>
                  <Text style={[m.detailedLabel, { color: palette.softText }]}>
                    {cat}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <TouchableOpacity
                        key={s}
                        onPress={() =>
                          setDetailedRatings((p) => ({ ...p, [cat]: s }))
                        }
                      >
                        <FontAwesome6
                          name="star"
                          size={16}
                          solid={(detailedRatings[cat] || 0) >= s}
                          color={
                            (detailedRatings[cat] || 0) >= s
                              ? Colors.orange
                              : palette.border
                          }
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* 3. Kullanım Bilgileri */}
          <Text style={[m.sectionTitle, { color: palette.text }]}>
            Kullanım Bilgileri (isteğe bağlı)
          </Text>
          <View style={m.row}>
            <View style={{ flex: 1 }}>
              <Text style={[m.label, { color: palette.softText }]}>
                Araç Alınan Yıl
              </Text>
              <TextInput
                style={[
                  m.input,
                  {
                    backgroundColor: palette.card,
                    borderColor: palette.border,
                    color: palette.text,
                  },
                ]}
                value={buyYear}
                onChangeText={setBuyYear}
                placeholder="örn: 2020"
                keyboardType="numeric"
                placeholderTextColor={palette.muted}
              />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={[m.label, { color: palette.softText }]}>
                Kullanım Süresi (ay)
              </Text>
              <TextInput
                style={[
                  m.input,
                  {
                    backgroundColor: palette.card,
                    borderColor: palette.border,
                    color: palette.text,
                  },
                ]}
                value={duration}
                onChangeText={setDuration}
                placeholder="örn: 36"
                keyboardType="numeric"
                placeholderTextColor={palette.muted}
              />
            </View>
          </View>

          <View style={m.row}>
            <View style={{ flex: 1 }}>
              <Text style={[m.label, { color: palette.softText }]}>
                Kullanılan KM
              </Text>
              <TextInput
                style={[
                  m.input,
                  {
                    backgroundColor: palette.card,
                    borderColor: palette.border,
                    color: palette.text,
                  },
                ]}
                value={km}
                onChangeText={setKm}
                placeholder="örn: 45000"
                keyboardType="numeric"
                placeholderTextColor={palette.muted}
              />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={[m.label, { color: palette.softText }]}>
                Sahiplik Türü
              </Text>
              <TouchableOpacity
                style={[
                  m.dropdownBtn,
                  { backgroundColor: palette.card, borderColor: palette.border },
                  isOwnershipDropdownOpen && m.inlineDropdownBtnOpen,
                ]}
                onPress={() =>
                  setIsOwnershipDropdownOpen((current) => !current)
                }
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    ownership ? m.dropdownTextActive : m.dropdownText,
                    { color: ownership ? palette.text : palette.muted },
                  ]}
                >
                  {ownership || "Seç"}
                </Text>
                <FontAwesome6
                  name={isOwnershipDropdownOpen ? "chevron-up" : "chevron-down"}
                  size={12}
                  color={palette.muted}
                />
              </TouchableOpacity>
              {isOwnershipDropdownOpen && (
                <View
                  style={[
                    m.inlineDropdownList,
                    {
                      backgroundColor: palette.card,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  {OWNERSHIP_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[
                        m.inlineDropdownItem,
                        { borderBottomColor: palette.border },
                      ]}
                      onPress={() => {
                        setOwnership(option);
                        setIsOwnershipDropdownOpen(false);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          m.inlineDropdownItemText,
                          { color: ownership === option ? Colors.orange : palette.text },
                        ]}
                      >
                        {option}
                      </Text>
                      {ownership === option && (
                        <FontAwesome6
                          name="check"
                          size={12}
                          color={Colors.orange}
                        />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>

          <Text style={[m.label, { color: palette.softText }]}>Artı Yönleri</Text>
          <TextInput
            style={[
              m.input,
              {
                backgroundColor: palette.card,
                borderColor: palette.border,
                color: palette.text,
              },
            ]}
            value={pros}
            onChangeText={setPros}
            placeholder="örn: Düşük yakıt tüketimi"
            placeholderTextColor={palette.muted}
          />

          <Text style={[m.label, { color: palette.softText }]}>Eksi Yönleri</Text>
          <TextInput
            style={[
              m.input,
              {
                backgroundColor: palette.card,
                borderColor: palette.border,
                color: palette.text,
              },
            ]}
            value={cons}
            onChangeText={setCons}
            placeholder="örn: Yüksek bakım maliyeti"
            placeholderTextColor={palette.muted}
          />

          {/* 4. Fotoğraflar */}
          <Text style={[m.label, { color: palette.softText }]}>
            Fotoğraflar (max 5 adet, her biri max 5MB)
          </Text>
          {images.length > 0 ? (
            <PhotoCarousel
              images={images}
              height={230}
              style={m.imagePreviewCarousel}
              onRemoveImage={(index) =>
                setImages(images.filter((_, i) => i !== index))
              }
            />
          ) : null}
          <View style={m.imageActionRow}>
            {images.length < 5 && (
              <TouchableOpacity
                style={[
                  m.imagePickerBtn,
                  { backgroundColor: palette.card, borderColor: palette.border },
                ]}
                onPress={handleImagePick}
              >
                <FontAwesome6
                  name="camera"
                  size={20}
                  color={palette.muted}
                />
                <Text style={[m.imagePickerText, { color: palette.muted }]}>
                  {images.length === 0 ? "Dosya seçilmedi" : "Ekle"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Alt Checkbox */}
          <TouchableOpacity
            style={[m.checkboxRow, { marginTop: 12, marginBottom: 20 }]}
            onPress={() => setRecommend(!recommend)}
            activeOpacity={0.8}
          >
            <FontAwesome6
              name={recommend ? "check-square" : "square"}
              size={18}
              color={recommend ? Colors.orange : palette.muted}
              solid={recommend}
            />
            <Text
              style={[m.checkboxLabel, { fontSize: 13, color: palette.text }]}
            >
              Bu aracı başkalarının alması için tavsiye ediyorum
            </Text>
          </TouchableOpacity>
        </ScrollView>

        <View
          style={[
            m.footer,
            { backgroundColor: palette.background, borderTopColor: palette.border },
          ]}
        >
          <Text style={[m.footerNote, { color: palette.muted }]}>
            Deneyiminiz incelendikten sonra yayınlanacaktır.
          </Text>
          <TouchableOpacity
            style={[
              m.saveBtn,
              {
                backgroundColor: Colors.orange,
                opacity: !canSave || isSubmitting ? 0.55 : 1,
              },
            ]}
            disabled={!canSave || isSubmitting}
            onPress={handleSave}
          >
            {isSubmitting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={m.saveBtnText}>Gönder</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Marka Seçici Dropdown (Nested Modal) ── */}
      <Modal visible={isBrandDropdownVisible} animationType="slide" transparent>
        <Pressable
          style={m.overlay}
          onPress={() => setIsBrandDropdownVisible(false)}
        />
        <View style={[m.sheet, { backgroundColor: palette.background }]}>
          <View style={[m.handle, { backgroundColor: palette.border }]} />
          <View style={[m.header, { borderBottomColor: palette.border }]}>
            <Text style={[m.title, { color: palette.text }]}>Marka Seç</Text>
            <TouchableOpacity
              onPress={() => setIsBrandDropdownVisible(false)}
              style={m.closeBtn}
            >
              <FontAwesome6 name="xmark" size={16} color={palette.muted} />
            </TouchableOpacity>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={m.modalScroll}
          >
            {brandList.length === 0 && !isLoadingBrands ? (
              <Text style={[m.emptyText, { color: palette.muted }]}>
                Marka bulunamadı.
              </Text>
            ) : (
              brandList.map((brandItem) => (
                <TouchableOpacity
                  key={brandItem.value}
                  style={[m.modalListItem, { borderBottomColor: palette.border }]}
                  onPress={() => {
                    setSelectedBrandId(brandItem.value);
                    setIsBrandDropdownVisible(false);
                  }}
                >
                  <Text
                    style={[
                      m.modalListText,
                      { color: palette.text },
                      selectedBrandId === brandItem.value &&
                        m.modalListTextActive,
                    ]}
                  >
                    {brandItem.label}
                  </Text>
                  {selectedBrandId === brandItem.value && (
                    <FontAwesome6
                      name="check"
                      size={14}
                      color={Colors.orange}
                    />
                  )}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ── Model Seçici Dropdown (Nested Modal) ── */}
      <Modal visible={isModelDropdownVisible} animationType="slide" transparent>
        <Pressable
          style={m.overlay}
          onPress={() => setIsModelDropdownVisible(false)}
        />
        <View style={[m.sheet, { backgroundColor: palette.background }]}>
          <View style={[m.handle, { backgroundColor: palette.border }]} />
          <View style={[m.header, { borderBottomColor: palette.border }]}>
            <Text style={[m.title, { color: palette.text }]}>Model Seç</Text>
            <TouchableOpacity
              onPress={() => setIsModelDropdownVisible(false)}
              style={m.closeBtn}
            >
              <FontAwesome6 name="xmark" size={16} color={palette.muted} />
            </TouchableOpacity>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={m.modalScroll}
          >
            {modelList.length === 0 && !isLoadingModels ? (
              <Text style={[m.emptyText, { color: palette.muted }]}>
                Bu markaya ait model bulunamadı.
              </Text>
            ) : (
              modelList.map((modelItem) => (
                <TouchableOpacity
                  key={modelItem.value}
                  style={[m.modalListItem, { borderBottomColor: palette.border }]}
                  onPress={() => {
                    setSelectedModelId(modelItem.value);
                    setIsModelDropdownVisible(false);
                  }}
                >
                  <Text
                    style={[
                      m.modalListText,
                      { color: palette.text },
                      selectedModelId === modelItem.value &&
                        m.modalListTextActive,
                    ]}
                  >
                    {modelItem.label}
                  </Text>
                  {selectedModelId === modelItem.value && (
                    <FontAwesome6
                      name="check"
                      size={14}
                      color={Colors.orange}
                    />
                  )}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>

      <VehicleCatalogPicker
        visible={catalogPickerVisible}
        title="Deneyim aracını seç"
        onClose={() => setCatalogPickerVisible(false)}
        onSelect={handleCatalogSelection}
      />

    </Modal>
  );
}

// ─── Ana Ekran ─────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const router = useRouter();
  const { logout, user, updateAvatar, garageCarCount } = useAuth();
  const { reviews, addReview, refreshReviews } = useReviews();
  const { effectiveTheme, palette, preference, setPreference } = useAppTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [canOpenModerationPanel, setCanOpenModerationPanel] = useState(false);

  const [profileName, setProfileName] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [localAvatarPreview, setLocalAvatarPreview] = useState<string | null>(
    null,
  );
  const [profileAvatar, setProfileAvatar] = useState("");
  const [profileStats, setProfileStats] = useState<ProfileStats>(
    INITIAL_PROFILE_STATS,
  );
  const [profileCommunities, setProfileCommunities] = useState<
    ProfileCommunity[]
  >([]);

  useEffect(() => {
    const fetchRealUserProfile = async () => {
      setLoadingProfile(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        const { data, error } = await supabase
          .from("profiles")
          .select("full_name, display_name, avatar_url, created_at")
          .eq("id", session.user.id)
          .single();

        if (data) {
          setProfileAvatar(data.avatar_url || "");
          const exactFullName = data.display_name || data.full_name;

          if (exactFullName && exactFullName.trim().length > 0) {
            setProfileName(exactFullName.trim());
            setProfileStats((prev) => ({
              ...prev,
              joinedText: getJoinedText(
                data.created_at || session.user.created_at,
              ),
            }));
            setLoadingProfile(false);
            return;
          }
        }

        // Tabloda o an veri yoksa auth meta datasından kurtarmaya çalışıyoruz
        const metaName =
          session.user.user_metadata?.full_name ||
          session.user.user_metadata?.display_name;
        if (metaName && metaName.trim().length > 0) {
          setProfileName(metaName.trim());
          setProfileStats((prev) => ({
            ...prev,
            joinedText: getJoinedText(session.user.created_at),
          }));
          setLoadingProfile(false);
          return;
        }
      }

      setProfileName(getDisplayName(user?.name));
      setLoadingProfile(false);
    };

    fetchRealUserProfile();
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    const fetchProfileStats = async () => {
      if (!user?.id) {
        setProfileStats(INITIAL_PROFILE_STATS);
        return;
      }

      const [
        reviewsResult,
        postsResult,
        garageResult,
        membershipsResult,
        profileResult,
      ] =
        await Promise.all([
          supabase
            .from("reviews")
            .select("id,title,comment,car,helpful_votes,images,created_at")
            .eq("user_id", user.id),
          supabase
            .from("posts")
            .select("id,title,content,car,community_id,upvotes,created_at")
            .eq("user_id", user.id),
          supabase.from("garage_cars").select("id").eq("user_id", user.id),
          supabase
            .from("community_memberships")
            .select("id")
            .eq("user_id", user.id),
          supabase
            .from("profiles")
            .select("created_at")
            .eq("id", user.id)
            .maybeSingle(),
        ]);

      if (!isMounted) return;

      const supabaseReviews = reviewsResult.error
        ? []
        : reviewsResult.data || [];
      const supabasePosts = postsResult.error ? [] : postsResult.data || [];
      const profileNameLower = profileName.trim().toLocaleLowerCase("tr-TR");
      const userNameLower = (user.name || "").trim().toLocaleLowerCase("tr-TR");
      const contextReviews = reviews.filter((review) => {
        const reviewUser = (review.user || "")
          .trim()
          .toLocaleLowerCase("tr-TR");
        return (
          reviewUser.length > 0 &&
          (reviewUser === profileNameLower || reviewUser === userNameLower)
        );
      });
      const reviewMap = new Map<string, any>();
      const normalizeActivityValue = (value?: string | null) =>
        (value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
      const activitySignature = (
        title?: string | null,
        content?: string | null,
        car?: string | null,
      ) =>
        [
          normalizeActivityValue(title),
          normalizeActivityValue(content),
          normalizeActivityValue(car),
        ].join("|");
      const reviewSignatures = new Set(
        supabaseReviews.map((review: any) =>
          activitySignature(review.title, review.comment, review.car),
        ),
      );

      supabaseReviews.forEach((review: any) =>
        reviewMap.set(review.id, review),
      );
      supabasePosts.forEach((post: any) => {
        const isLegacyReviewCopy =
          !post.community_id &&
          reviewSignatures.has(
            activitySignature(post.title, post.content, post.car),
          );
        if (isLegacyReviewCopy) return;

        reviewMap.set(`post:${post.id}`, {
          ...post,
          helpful_votes: post.upvotes || 0,
          images: [],
        });
      });
      contextReviews.forEach((review) => reviewMap.set(review.id, review));
      const userReviews = Array.from(reviewMap.values());
      const garageCars = garageResult.error ? [] : garageResult.data || [];
      const memberships = membershipsResult.error
        ? []
        : membershipsResult.data || [];
      const joinedAt =
        profileResult.data?.created_at || userReviews[0]?.created_at || null;

      setProfileStats({
        joinedText: getJoinedText(joinedAt),
        reviewsCount: userReviews.length,
        helpfulVotesCount: userReviews.reduce(
          (sum: number, review: any) =>
            sum + Number(review.helpful_votes || review.helpfulVotes || 0),
          0,
        ),
        carsCount: garageCars.length || garageCarCount,
        reviewPhotosCount: userReviews.reduce((sum: number, review: any) => {
          const images = Array.isArray(review.images) ? review.images : [];
          return sum + images.length;
        }, 0),
        communitiesCount: memberships.length,
      });
    };

    fetchProfileStats();

    return () => {
      isMounted = false;
    };
  }, [garageCarCount, profileName, reviews, user?.id]);

  useEffect(() => {
    let isMounted = true;

    const fetchProfileCommunities = async () => {
      if (!user?.id) {
        setProfileCommunities([]);
        return;
      }

      const { data, error } = await supabase
        .from("community_memberships")
        .select(
          "community_id, show_on_profile, use_vehicle_badge, notifications_enabled, created_at",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        const missingSchema =
          error.message.includes("community_memberships") ||
          error.message.includes("schema cache");

        if (!missingSchema) {
          console.error("Profil toplulukları alınamadı:", error.message);
        }
        if (isMounted) setProfileCommunities([]);
        return;
      }

      const nextCommunities = (data || [])
        .map((membership: any) => {
          const definition = getCommunityById(membership.community_id);
          if (!definition) return null;

          return {
            id: definition.id,
            name: definition.name,
            icon: definition.icon,
            iconBg: definition.iconBg,
            iconColor: definition.iconColor,
            showOnProfile: membership.show_on_profile ?? true,
            useVehicleBadge: membership.use_vehicle_badge ?? true,
            notificationsEnabled: membership.notifications_enabled ?? true,
          };
        })
        .filter(Boolean) as ProfileCommunity[];

      if (isMounted) setProfileCommunities(nextCommunities);
    };

    fetchProfileCommunities();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    let isMounted = true;

    const fetchModeratorAccess = async () => {
      if (!user?.id) {
        setCanOpenModerationPanel(false);
        return;
      }

      const { data, error } = await supabase.rpc("is_moderator");
      if (!isMounted) return;
      setCanOpenModerationPanel(Boolean(data) && !error);
    };

    void fetchModeratorAccess();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const earnedBadges = useMemo(
    () =>
      BADGE_RULES.map((badge) => ({
        ...badge,
        disabled: !badge.isEarned(profileStats),
      })),
    [profileStats],
  );
  const earnedBadgeCount = earnedBadges.filter(
    (badge) => !badge.disabled,
  ).length;
  const reviewsCount = profileStats.reviewsCount;
  const helpfulVotesCount = profileStats.helpfulVotesCount;
  const carsCount = profileStats.carsCount;
  const visibleProfileCommunities = profileCommunities.filter(
    (community) => community.showOnProfile,
  );
  const vehicleBadgeCommunities = profileCommunities.filter(
    (community) => community.useVehicleBadge,
  );
  const visibleMenuItems = useMemo(
    () =>
      canOpenModerationPanel
        ? [...MENU_ITEMS, ADMIN_MENU_ITEM]
        : MENU_ITEMS,
    [canOpenModerationPanel],
  );
  const isDarkTheme = effectiveTheme === "dark";
  const avatarUri = localAvatarPreview || user?.avatar || profileAvatar || "";
  const hasProfileAvatar =
    avatarUri.length > 0 &&
    !avatarUri.includes("ui-avatars.com") &&
    !avatarUri.includes("placeholder") &&
    !avatarUri.includes("pravatar");

  const handleAvatarChange = () => {
    const saveAvatar = async (asset: ImagePicker.ImagePickerAsset) => {
      setLocalAvatarPreview(asset.uri);

      try {
        await updateAvatar(
          asset.uri,
          asset.base64 || null,
          asset.mimeType || null,
        );
        setLocalAvatarPreview(null);
      } catch (error: any) {
        setLocalAvatarPreview(null);
        console.error("Profil fotoğrafı güncellenemedi:", error);
        Alert.alert(
          "Profil fotoğrafı eklenemedi",
          error?.message?.includes("Bucket not found")
            ? "Görsel şu anda yüklenemiyor. Lütfen daha sonra tekrar dene."
            : "Fotoğraf yüklenirken bir sorun oluştu. Lütfen tekrar dene.",
        );
      }
    };

    Alert.alert("Profil Fotoğrafı", "Lütfen bir yöntem seçin", [
      {
        text: "Kamerayla Çek",
        onPress: async () => {
          const { granted } = await ImagePicker.requestCameraPermissionsAsync();
          if (!granted) {
            Alert.alert("Hata", "Kamera erişim izni gereklidir.");
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.45,
            base64: true,
          });
          if (!result.canceled) await saveAvatar(result.assets[0]);
        },
      },
      {
        text: "Galeriden Seç",
        onPress: async () => {
          const { granted } =
            await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!granted) {
            Alert.alert("Hata", "Galeri erişim izni gereklidir.");
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.45,
            base64: true,
          });
          if (!result.canceled) await saveAvatar(result.assets[0]);
        },
      },
      { text: "İptal", style: "cancel" },
    ]);
  };

  const handleSignOut = async () => {
    try {
      // 1. Supabase'e çıkış emri veriyoruz
      await supabase.auth.signOut();

      // 2. GARANTİ ADIM: Cihazın hafızasında kalmış olabilecek auth state'ini temizlemeye zorluyoruz
      // Bazı Expo versiyonlarında signOut sonrası state anlık düşmediği için bu tetikleme şarttır.
      if (typeof supabase.auth.setSession === "function") {
        await supabase.auth.setSession({ access_token: "", refresh_token: "" });
      }

      // 3. Kullanıcıyı Keşfet sayfasına fırlatıyoruz
      router.replace("/");
    } catch (error: any) {
      console.error("Çıkış hatası:", error);
      // Hata verse bile kullanıcıyı her halükarda ana sayfaya atıp oturumu yerelde bitiriyoruz:
      router.replace("/");
    }
  };

  const handleMenuPress = (id: string) => {
    if (id === "garage") {
      router.push({ pathname: "/garage", params: { from: "profile" } } as any);
    } else if (id === "saved") {
      router.push("/profile-routes/saved-cars");
    } else if (id === "reviews") {
      router.push("/profile-routes/my-reviews");
    } else if (id === "following") {
      router.push("/profile-routes/following" as any);
    } else if (id === "security") {
      router.push("/profile-routes/security");
    } else if (id === "notifications") {
      router.push("/profile-routes/notifications");
    } else if (id === "moderation") {
      router.push("/admin/moderation" as any);
    }
  };

  const themeOptions: Array<{
    id: ThemePreference;
    label: string;
    icon: React.ComponentProps<typeof FontAwesome6>["name"];
  }> = [
    { id: "system", label: "Sistem", icon: "mobile-screen-button" },
    { id: "light", label: "Açık", icon: "sun" },
    { id: "dark", label: "Koyu", icon: "moon" },
  ];

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: palette.background }]}
      edges={["top"]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ─── Üst Kısım: Kullanıcı Bilgileri ─── */}
        <View
          style={[
            styles.headerSection,
            {
              backgroundColor: palette.card,
              borderBottomColor: palette.border,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={handleAvatarChange}
            activeOpacity={0.8}
          >
            {hasProfileAvatar ? (
              <Image
                source={{ uri: avatarUri }}
                style={[
                  styles.avatarImage,
                  {
                    backgroundColor: palette.card,
                    borderColor: isDarkTheme ? Colors.white : Colors.orange,
                  },
                ]}
                onError={() => setLocalAvatarPreview(null)}
              />
            ) : loadingProfile || !profileName.trim() ? (
              <View
                style={[
                  styles.avatarInitialsContainer,
                  {
                    backgroundColor: palette.card,
                    borderColor: isDarkTheme ? Colors.white : Colors.orange,
                  },
                ]}
              >
                <ActivityIndicator size="small" color={Colors.orange} />
              </View>
            ) : (
              <View
                style={[
                  styles.avatarInitialsContainer,
                  {
                    backgroundColor: palette.card,
                    borderColor: isDarkTheme ? Colors.white : Colors.orange,
                  },
                ]}
              >
                <Text
                  style={[styles.avatarInitialsText, { color: palette.text }]}
                >
                  {getInitials(profileName)}
                </Text>
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <FontAwesome6 name="pen" size={11} color={Colors.white} solid />
            </View>
          </TouchableOpacity>

          {loadingProfile ? (
            <ActivityIndicator
              size="small"
              color={Colors.orange}
              style={{ marginVertical: 4 }}
            />
          ) : (
            <Text style={[styles.userName, { color: palette.text }]}>
              {profileName}
            </Text>
          )}
          <Text style={[styles.userJoined, { color: palette.muted }]}>
            {profileStats.joinedText}
          </Text>

          {/* İstatistikler */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: palette.text }]}>
                {reviewsCount}
              </Text>
              <Text style={[styles.statLabel, { color: palette.softText }]}>
                Yorum
              </Text>
            </View>
            <View
              style={[styles.statDivider, { backgroundColor: palette.border }]}
            />

            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: Colors.orange }]}>
                {helpfulVotesCount}
              </Text>
              <Text style={[styles.statLabel, { color: palette.softText }]}>
                Faydalı Oy
              </Text>
            </View>
            <View
              style={[styles.statDivider, { backgroundColor: palette.border }]}
            />

            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: palette.text }]}>
                {carsCount}
              </Text>
              <Text style={[styles.statLabel, { color: palette.softText }]}>
                Araç
              </Text>
            </View>
          </View>
        </View>

        {/* ─── İçerik Alanı ─── */}
        <View style={styles.contentSection}>
          {/* Rozetler */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>
                Kazanılan Rozetler
              </Text>
              <Text style={styles.seeAllText}>
                {earnedBadgeCount}/{earnedBadges.length}
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.badgesScroll}
            >
              {earnedBadges.map((badge) => (
                <View
                  key={badge.id}
                  style={[
                    styles.badgeCard,
                    {
                      backgroundColor: palette.card,
                      borderColor: palette.border,
                    },
                    badge.disabled && styles.badgeDisabled,
                  ]}
                >
                  {!badge.disabled && <View style={styles.badgeHighlight} />}
                  <FontAwesome6
                    name={badge.icon}
                    size={20}
                    color={badge.disabled ? Colors.gray300 : badge.color}
                    solid
                  />
                  <Text
                    style={[
                      styles.badgeText,
                      { color: palette.text },
                      badge.disabled && { color: Colors.gray300 },
                    ]}
                  >
                    {badge.title}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>

          {visibleProfileCommunities.length > 0 ? (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>
                  Topluluklarım
                </Text>
                <Text style={styles.seeAllText}>
                  {visibleProfileCommunities.length}
                </Text>
              </View>

              <View style={styles.communityGrid}>
                {visibleProfileCommunities.map((community) => (
                  <TouchableOpacity
                    key={community.id}
                    style={[
                      styles.profileCommunityCard,
                      { backgroundColor: palette.card, borderColor: palette.border },
                    ]}
                    activeOpacity={0.8}
                    onPress={() => router.push(`/community/${community.id}` as any)}
                  >
                    <View
                      style={[
                        styles.profileCommunityIcon,
                        { backgroundColor: community.iconBg },
                      ]}
                    >
                      <FontAwesome6
                        name={community.icon as any}
                        size={15}
                        color={community.iconColor}
                        solid
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.profileCommunityName,
                          { color: palette.text },
                        ]}
                        numberOfLines={1}
                      >
                        {community.name}
                      </Text>
                      <Text
                        style={[
                          styles.profileCommunityMeta,
                          { color: palette.muted },
                        ]}
                        numberOfLines={1}
                      >
                        {community.notificationsEnabled
                          ? "Bildirimler açık"
                          : "Bildirimler kapalı"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          {vehicleBadgeCommunities.length > 0 ? (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>
                  Araç Rozetleri
                </Text>
              </View>
              <View style={styles.vehicleBadgeRow}>
                {vehicleBadgeCommunities.map((community) => (
                  <View
                    key={community.id}
                    style={[
                      styles.vehicleBadgeChip,
                      { backgroundColor: palette.card, borderColor: palette.border },
                    ]}
                  >
                    <FontAwesome6
                      name={community.icon as any}
                      size={12}
                      color={community.iconColor}
                      solid
                    />
                    <Text
                      style={[styles.vehicleBadgeText, { color: palette.text }]}
                      numberOfLines={1}
                    >
                      {community.name}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>
                Görünüm
              </Text>
              <View style={styles.themeSwitchRow}>
                <FontAwesome6
                  name={isDarkTheme ? "moon" : "sun"}
                  size={12}
                  color={Colors.orange}
                  solid
                />
                <Switch
                  value={isDarkTheme}
                  onValueChange={(enabled) =>
                    setPreference(enabled ? "dark" : "light")
                  }
                  trackColor={{ false: palette.border, true: Colors.orange }}
                  thumbColor={Colors.white}
                />
              </View>
            </View>
            <View
              style={[
                styles.themeCard,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
            >
              {themeOptions.map((option) => {
                const isActive = preference === option.id;

                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.themeOption,
                      {
                        backgroundColor: isActive
                          ? Colors.orange
                          : palette.elevated,
                        borderColor: isActive ? Colors.orange : palette.border,
                      },
                    ]}
                    activeOpacity={0.85}
                    onPress={() => setPreference(option.id)}
                  >
                    <FontAwesome6
                      name={option.icon}
                      size={13}
                      color={isActive ? Colors.white : palette.muted}
                      solid
                    />
                    <Text
                      style={[
                        styles.themeOptionText,
                        { color: isActive ? Colors.white : palette.text },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Menü Seçenekleri */}
          <View style={styles.menuContainer}>
            {visibleMenuItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.menuItem,
                  { backgroundColor: palette.card, borderColor: palette.border },
                ]}
                activeOpacity={0.7}
                onPress={() => handleMenuPress(item.id)}
              >
                <View style={styles.menuItemLeft}>
                  <View
                    style={[
                      styles.menuIconBox,
                      { backgroundColor: palette.elevated },
                    ]}
                  >
                    <FontAwesome6
                      name={item.icon}
                      size={14}
                      color={palette.muted}
                      solid={item.isSolid}
                    />
                  </View>
                  <Text style={[styles.menuItemText, { color: palette.text }]}>
                    {item.title}
                  </Text>
                </View>
                <FontAwesome6
                  name="chevron-right"
                  size={12}
                  color={palette.muted}
                />
              </TouchableOpacity>
            ))}
          </View>

          {/* Çıkış Yap Butonu */}
          <TouchableOpacity
            style={[
              styles.logoutButton,
              {
                backgroundColor: isDarkTheme ? "rgba(239,68,68,0.1)" : "#fee2e2",
                borderColor: isDarkTheme ? "rgba(239,68,68,0.25)" : "#fecaca",
              },
            ]}
            activeOpacity={0.8}
            onPress={handleSignOut}
          >
            <FontAwesome6
              name="arrow-right-from-bracket"
              size={14}
              color="#ef4444"
            />
            <Text style={styles.logoutText}>Çıkış Yap</Text>
          </TouchableOpacity>

          {/* Versiyon Bilgisi */}
          <Text style={[styles.versionText, { color: palette.muted }]}>
            OtoRehber v1.0.0
          </Text>
        </View>
      </ScrollView>

      <AddReviewModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={(rev) => {
          addReview(rev);
          void refreshReviews();
          router.push("/profile-routes/my-reviews");
        }}
        userName={profileName}
        userAvatar={user?.avatar || ""}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)" },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.navyMain,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: "92%",
    borderTopWidth: 1,
    borderTopColor: Colors.navyBorder,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.navyBorder,
    alignSelf: "center",
    marginTop: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.navyBorder,
  },
  title: { fontSize: 18, fontWeight: "800", color: Colors.white },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.navyCard,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  form: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.white,
    marginBottom: 12,
    marginTop: 16,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  checkboxLabel: { color: Colors.textMuted, fontSize: 12, flex: 1 },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.gray300,
    marginBottom: 6,
    marginTop: 12,
  },
  required: { color: Colors.orange },
  charCount: { color: Colors.textMuted, fontSize: 10, fontWeight: "normal" },
  input: {
    backgroundColor: Colors.navyCard,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    color: Colors.white,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  disabledInput: { opacity: 0.72 },
  textArea: { height: 100, paddingTop: 12 },
  starsRow: { flexDirection: "row", gap: 12, marginTop: 4, marginBottom: 12 },
  row: { flexDirection: "row" },

  accordionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.navyCard,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    marginTop: 16,
  },
  accordionTitle: { fontSize: 13, fontWeight: "600", color: Colors.white },
  detailedContainer: {
    backgroundColor: Colors.navyMain,
    padding: 14,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    borderTopWidth: 0,
    marginTop: -4,
  },
  detailedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  detailedLabel: { color: Colors.gray300, fontSize: 12 },

  imagePickerBtn: {
    minHeight: 54,
    flex: 1,
    borderRadius: 10,
    backgroundColor: Colors.navyCard,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  imagePickerText: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 0,
    textAlign: "center",
    paddingHorizontal: 4,
  },
  imagePreviewCarousel: { marginTop: 8, marginBottom: 10 },
  imageActionRow: { paddingVertical: 8 },

  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.navyBorder,
    backgroundColor: Colors.navyMain,
  },
  footerNote: {
    color: Colors.textMuted,
    fontSize: 11,
    textAlign: "center",
    marginBottom: 12,
    fontStyle: "italic",
  },
  saveBtn: {
    backgroundColor: Colors.orange,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.55 },
  saveBtnText: { color: Colors.white, fontSize: 16, fontWeight: "800" },

  // Dropdown Stilleri
  dropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.navyCard,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  dropdownText: { color: Colors.textMuted, fontSize: 14 },
  dropdownTextActive: { color: Colors.white, fontSize: 14 },
  inlineDropdownBtnOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  inlineDropdownList: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: "hidden",
  },
  inlineDropdownItem: {
    minHeight: 44,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  inlineDropdownItemText: {
    fontSize: 14,
    fontWeight: "700",
  },
  modalScroll: { paddingHorizontal: 20, paddingBottom: 40 },
  modalListItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.navyBorder,
  },
  modalListText: { color: Colors.white, fontSize: 15 },
  modalListTextActive: { color: Colors.orange, fontWeight: "700" },
  emptyText: { color: Colors.textMuted, textAlign: "center", marginTop: 40 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.navyMain },
  scrollContent: { paddingBottom: 40 },

  // Üst Kısım
  headerSection: {
    backgroundColor: Colors.navyCard,
    paddingTop: 32,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: Colors.navyBorder,
    alignItems: "center",
  },
  avatarContainer: { position: "relative", marginBottom: 12 },
  avatarInitialsContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: Colors.white,
    backgroundColor: Colors.navyCard,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: Colors.white,
    backgroundColor: Colors.navyCard,
  },
  avatarInitialsText: {
    fontSize: 36,
    fontWeight: "bold",
    color: Colors.white,
  },
  avatarEditBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: Colors.orange,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: Colors.navyMain,
  },
  userName: { fontSize: 20, fontWeight: "800", color: Colors.white },
  userJoined: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },

  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    marginTop: 20,
    width: "100%",
  },
  statItem: { alignItems: "center" },
  statValue: { fontSize: 18, fontWeight: "900", color: Colors.white },
  statLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: Colors.gray300,
    marginTop: 2,
  },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.navyBorder },

  // İçerik Alanı
  contentSection: { paddingHorizontal: 20, paddingTop: 24 },

  // Rozetler
  sectionContainer: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: Colors.white },
  seeAllText: { fontSize: 12, fontWeight: "700", color: Colors.orange },
  badgesScroll: { gap: 12 },
  badgeCard: {
    backgroundColor: Colors.navyCard,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    borderRadius: 12,
    minWidth: 96,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  badgeDisabled: { opacity: 0.5 },
  badgeHighlight: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 32,
    height: 32,
    backgroundColor: "rgba(249,115,22,0.1)",
    borderBottomLeftRadius: 32,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    color: Colors.white,
    marginTop: 8,
    lineHeight: 16,
  },
  communityGrid: {
    gap: 10,
  },
  profileCommunityCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  profileCommunityIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  profileCommunityName: {
    fontSize: 13,
    fontWeight: "900",
  },
  profileCommunityMeta: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  vehicleBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  vehicleBadgeChip: {
    minHeight: 34,
    maxWidth: "100%",
    borderWidth: 1,
    borderRadius: 17,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  vehicleBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    maxWidth: 180,
  },
  themeSwitchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  themeCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 8,
    flexDirection: "row",
    gap: 8,
  },
  themeOption: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  themeOptionText: {
    fontSize: 12,
    fontWeight: "800",
  },

  // Menü
  menuContainer: { marginBottom: 24, gap: 8 },
  menuItem: {
    backgroundColor: Colors.navyCard,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  menuItemLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  menuIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.navyMain,
    justifyContent: "center",
    alignItems: "center",
  },
  menuItemText: { fontSize: 14, fontWeight: "600", color: Colors.white },

  // Çıkış
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(239,68,68,0.1)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.2)",
    borderRadius: 16,
    paddingVertical: 14,
    marginBottom: 24,
  },
  logoutText: { color: "#ef4444", fontSize: 14, fontWeight: "700" },
  versionText: { textAlign: "center", fontSize: 10, color: Colors.textMuted },
});
