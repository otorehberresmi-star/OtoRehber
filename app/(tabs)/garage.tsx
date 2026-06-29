// app/(tabs)/garage.tsx
// Garajım — "Dijital Ruhsat & Muhasebe"
// Boş state + isteğe bağlı deneyimli Araç Ekle modalı + dolu state

import Colors from "@/constants/Colors";
import { FontAwesome6 } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
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
import {
  resolvePrivateFileUrls,
  uploadPrivateFiles,
} from "../../utils/storageUpload";
import { useAuth } from "../../contexts/AuthContext";
import { useReviews } from "../../contexts/ReviewContext";
import { useAppTheme } from "../../contexts/ThemeContext";
import { validateCleanContent } from "../../utils/contentModeration";
import VehicleCatalogPicker from "../../components/VehicleCatalogPicker";
import { VehicleCatalogSelection } from "../../utils/vehicleCatalog";
import { loginRoute } from "../../utils/authRedirect";
import PhotoCarousel from "../../components/PhotoCarousel";

const { width } = Dimensions.get("window");
const CARD_WIDTH = width - 40; // Garaj kartının genişliği (20 + 20 padding)

// ─── Tipler ───────────────────────────────────────────────────────────────────
interface UserCar {
  id?: string;
  brandId?: string | null;
  modelId?: string | null;
  brand: string;
  model: string;
  year: string;
  trim: string;
  km: string;
  image: string;
  images?: string[];
  rating?: number;
  review?: string;
}

interface TimelineEntry {
  id: string;
  date: string;
  type: "fuel" | "service";
  icon: string;
  title: string;
  amount: string;
  detail: string;
  tag?: string;
  active: boolean;
  km?: string;
  rawAmount?: string;
  liters?: string;
  station?: string;
  garageCarId?: string | null;
}

const formatEntryDate = (value?: string) =>
  value
    ? new Date(value).toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : new Date().toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

const buildTimelineEntryFromRow = (row: any): TimelineEntry => {
  const metadata = row.metadata || {};

  return {
    id: row.id,
    date: row.entry_date ? formatEntryDate(row.entry_date) : formatEntryDate(row.created_at),
    type: row.type,
    icon: row.icon || (row.type === "fuel" ? "gas-pump" : "wrench"),
    title: row.title,
    amount: row.amount ? `₺ ${row.amount}` : "₺ 0",
    detail: row.detail || "",
    tag: row.tag || undefined,
    active: row.type === "fuel",
    km: row.km || undefined,
    rawAmount: row.amount ? String(row.amount) : undefined,
    liters: metadata.liters,
    station: metadata.station,
    garageCarId: row.garage_car_id || null,
  };
};

const buildTimelinePayload = (
  entry: TimelineEntry,
  userId: string,
  garageCarId?: string | null,
) => ({
  user_id: userId,
  garage_car_id: garageCarId || null,
  type: entry.type,
  title: entry.title,
  amount: entry.rawAmount || entry.amount.replace("₺", "").trim(),
  detail: entry.detail,
  tag: entry.tag || null,
  icon: entry.icon,
  km: entry.km || null,
  entry_date: new Date().toISOString(),
  date: new Date().toISOString(),
  metadata: {
    liters: entry.liters || null,
    station: entry.station || null,
  },
});

// ─── Araç Ekle Modalı ─────────────────────────────────────────────────────────
function AddCarModal({
  visible,
  onClose,
  onSave,
  initialData,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (car: UserCar) => Promise<void> | void;
  initialData?: UserCar | null;
}) {
  const { palette } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [brand, setBrand] = useState("");
  const [brandList, setBrandList] = useState<
    { label: string; value: string }[]
  >([]);
  const [brandDropdownVisible, setBrandDropdownVisible] = useState(false);
  const [brandSearch, setBrandSearch] = useState("");
  const [isLoadingBrands, setIsLoadingBrands] = useState(false);

  const [modelId, setModelId] = useState<string | null>(null);
  const [model, setModel] = useState("");
  const [modelList, setModelList] = useState<
    { label: string; value: string }[]
  >([]);
  const [modelDropdownVisible, setModelDropdownVisible] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [catalogPickerVisible, setCatalogPickerVisible] = useState(false);

  const [year, setYear] = useState("");
  const [trim, setTrim] = useState("");
  const [km, setKm] = useState("");
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [images, setImages] = useState<string[]>([]);

	  useEffect(() => {
	    if (visible) {
	      if (initialData) {
	        setBrand(initialData.brand);
	        setModel(initialData.model);
          setBrandId(null);
          setModelId(null);
	        setYear(initialData.year);
        setTrim(initialData.trim);
        setKm(initialData.km);
        setRating(initialData.rating || 0);
        setReview(initialData.review || "");
        setImages(initialData.images || [initialData.image]);
	      } else {
          setBrandId(null);
	        setBrand("");
          setModelId(null);
	        setModel("");
        setYear("");
        setTrim("");
        setKm("");
        setRating(0);
        setReview("");
	        setImages([]);
	      }
        setBrandDropdownVisible(false);
        setModelDropdownVisible(false);
        setBrandSearch("");
        setModelSearch("");
	    }
	  }, [visible, initialData]);

  useEffect(() => {
    if (!visible) return;

    const fetchBrands = async () => {
      setIsLoadingBrands(true);
      const { data, error } = await supabase
        .from("brands")
        .select("id, name")
        .order("name", { ascending: true });

      if (error) {
        console.error("Garaj marka listesi alınamadı:", error.message);
      } else {
        setBrandList(
          (data || []).map((item: any) => ({
            label: item.name,
            value: item.id,
          })),
        );
      }
      setIsLoadingBrands(false);
    };

    fetchBrands();
  }, [visible]);

  useEffect(() => {
    if (!visible || !initialData || brandId || brandList.length === 0) return;

    const matchedBrand = brandList.find(
      (item) =>
        item.label.trim().toLocaleLowerCase("tr-TR") ===
        initialData.brand.trim().toLocaleLowerCase("tr-TR"),
    );

    if (matchedBrand) setBrandId(matchedBrand.value);
  }, [brandId, brandList, initialData, visible]);

  useEffect(() => {
    if (!brandId) {
      setModelList([]);
      return;
    }

    const fetchModels = async () => {
      setIsLoadingModels(true);
      const { data, error } = await supabase
        .from("models")
        .select("id, name")
        .eq("brand_id", brandId)
        .order("name", { ascending: true });

      if (error) {
        console.error("Garaj model listesi alınamadı:", error.message);
      } else {
        setModelList(
          (data || []).map((item: any) => ({
            label: item.name,
            value: item.id,
          })),
        );
      }
      setIsLoadingModels(false);
    };

    fetchModels();
  }, [brandId]);

  useEffect(() => {
    if (!visible || !initialData || modelId || modelList.length === 0) return;

    const matchedModel = modelList.find(
      (item) =>
        item.label.trim().toLocaleLowerCase("tr-TR") ===
        initialData.model.trim().toLocaleLowerCase("tr-TR"),
    );

    if (matchedModel) setModelId(matchedModel.value);
  }, [initialData, modelId, modelList, visible]);

  const filteredBrandList = useMemo(() => {
    const query = brandSearch.trim().toLocaleLowerCase("tr-TR");
    if (!query) return brandList;
    return brandList.filter((item) =>
      item.label.toLocaleLowerCase("tr-TR").includes(query),
    );
  }, [brandList, brandSearch]);

  const filteredModelList = useMemo(() => {
    const query = modelSearch.trim().toLocaleLowerCase("tr-TR");
    if (!query) return modelList;
    return modelList.filter((item) =>
      item.label.toLocaleLowerCase("tr-TR").includes(query),
    );
  }, [modelList, modelSearch]);

  // Garaja araç eklemek için yalnızca temel araç bilgileri zorunludur.
  // Puan ve yorum girilirse ayrıca kullanıcı adına bir deneyim oluşturulur.
  const canSave =
    brand.trim().length > 0 &&
    model.trim().length > 0 &&
    year.trim().length > 0;

  const handleImagePick = () => {
    Alert.alert("Fotoğraf Ekle", "Lütfen bir yöntem seçin", [
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
            aspect: [4, 3],
            quality: 0.8,
          });
          if (!result.canceled) {
            setImages((prev) => [...prev, result.assets[0].uri].slice(0, 5));
          }
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
            allowsMultipleSelection: true,
            selectionLimit: 5 - images.length,
            quality: 0.8,
          });
          if (!result.canceled) {
            const newUris = result.assets.map((a) => a.uri);
            setImages((prev) => [...prev, ...newUris].slice(0, 5));
          }
        },
      },
      { text: "İptal", style: "cancel" },
    ]);
  };

  const handleSave = async () => {
    try {
      await onSave({
        id: initialData?.id,
        brandId,
        modelId,
        brand,
        model,
        year,
        trim: trim || `${year} ${brand} ${model}`,
        km: km || "0",
        rating,
        review,
        image: images[0] || "",
        images,
      });
      // Formu Sıfırla
      setBrand("");
      setModel("");
      setYear("");
      setTrim("");
      setKm("");
      setRating(0);
      setReview("");
      setImages([]);
      onClose();
    } catch (error) {
      console.error("Araç kaydetme tamamlanamadı:", error);
    }
  };

  const handleCatalogSelection = async (
    selection: VehicleCatalogSelection,
  ) => {
    setBrand(selection.brand);
    setModel(selection.model);
    setTrim(selection.trim);

    const { data: brandRow } = await supabase
      .from("brands")
      .select("id")
      .ilike("name", selection.brand)
      .maybeSingle();
    setBrandId(brandRow?.id || null);

    if (brandRow?.id) {
      const { data: modelRow } = await supabase
        .from("models")
        .select("id")
        .eq("brand_id", brandRow.id)
        .ilike("name", selection.model)
        .maybeSingle();
      setModelId(modelRow?.id || null);
    } else {
      setModelId(null);
    }
  };

  const scrollToReviewInput = () => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 250);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={() => {
        if (brandDropdownVisible) {
          setBrandDropdownVisible(false);
        } else if (modelDropdownVisible) {
          setModelDropdownVisible(false);
        } else {
          onClose();
        }
      }}
    >
      <Pressable style={m.overlay} onPress={onClose} />
      <KeyboardAvoidingView
        style={m.keyboardAvoiding}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
      <View style={[m.sheet, { backgroundColor: palette.background }]}>
        <View style={[m.handle, { backgroundColor: palette.border }]} />

        {/* Başlık */}
        <View style={[m.header, { borderBottomColor: palette.border }]}>
          <View>
            <Text style={[m.title, { color: palette.text }]}>
              {initialData ? "Aracını Düzenle" : "Aracını Ekle"}
            </Text>
            <Text style={[m.subtitle, { color: palette.muted }]}>
              {initialData
                ? "Araç bilgilerini ve deneyimini güncelle"
                : "Topluluğa katıl ve deneyimini paylaş"}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={m.closeBtn}>
            <FontAwesome6 name="xmark" size={16} color={palette.muted} />
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={m.form}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        >
          {/* Araç Bilgileri */}
          <Text style={[m.sectionTitle, { color: palette.text }]}>
            1. Araç Bilgileri
          </Text>

          <Text style={[m.label, { marginTop: 12, color: palette.softText }]}>
            Araç Fotoğrafları (İsteğe Bağlı, {images.length}/5)
          </Text>

          {images.length > 0 ? (
            <PhotoCarousel
              images={images}
              height={230}
              style={m.imagePreviewCarousel}
              onRemoveImage={(index) =>
                setImages((prev) => prev.filter((_, i) => i !== index))
              }
            />
          ) : null}
          <View style={m.imageActionRow}>
            {images.length < 5 && (
              <TouchableOpacity
                style={[
                  m.addMultipleImageBtn,
                  { backgroundColor: palette.card, borderColor: palette.border },
                ]}
                activeOpacity={0.8}
                onPress={handleImagePick}
              >
                <FontAwesome6
                  name="camera"
                  size={24}
                  color={palette.muted}
                />
                <Text style={[m.addMultipleImageText, { color: palette.muted }]}>
                  {images.length === 0 ? "Fotoğraf Ekle" : "Ekle"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={[m.label, { color: palette.softText }]}>
            Araç <Text style={m.required}>*</Text>
          </Text>
          <TouchableOpacity
            style={[
              m.vehicleSelector,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
            activeOpacity={0.8}
            onPress={() => setCatalogPickerVisible(true)}
          >
            <View style={m.vehicleSelectorIcon}>
              <FontAwesome6 name="copyright" size={16} color={Colors.orange} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[m.vehicleSelectorCaption, { color: palette.muted }]}>
                Marka, model, motor ve donanım
              </Text>
              <Text
                style={[
                  m.vehicleSelectorValue,
                  { color: brand ? palette.text : palette.muted },
                ]}
                numberOfLines={1}
              >
                {brand && model ? `${brand} ${model}` : "Araç seç"}
              </Text>
            </View>
            <FontAwesome6 name="chevron-right" size={13} color={palette.muted} />
          </TouchableOpacity>

          <View style={m.row}>
            <View style={{ flex: 1 }}>
              <Text style={[m.label, { color: palette.softText }]}>
                Yıl <Text style={m.required}>*</Text>
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
                value={year}
                onChangeText={setYear}
                placeholder="ör. 2021"
                placeholderTextColor={palette.muted}
                keyboardType="numeric"
                maxLength={4}
              />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={[m.label, { color: palette.softText }]}>
                Kilometre
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
                placeholder="ör. 68450"
                placeholderTextColor={palette.muted}
                keyboardType="numeric"
              />
            </View>
          </View>

          <Text style={[m.label, { color: palette.softText }]}>
            Donanım / Motor
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
            value={trim}
            onChangeText={setTrim}
            placeholder="ör. 1.6 TDI Style DSG"
            placeholderTextColor={palette.muted}
          />

          {/* Deneyim ve Puanlama (İsteğe bağlı) */}
          <View style={[m.divider, { backgroundColor: palette.border }]} />
          <Text style={[m.sectionTitle, { color: palette.text }]}>
            2. Deneyimin (İsteğe bağlı)
          </Text>
          <Text style={[m.sectionDesc, { color: palette.muted }]}>
            İstersen aracını değerlendir; boş bırakırsan yalnızca garajına eklenir.
          </Text>

          <View style={m.ratingContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => setRating(star)}
                activeOpacity={0.7}
                style={m.starBtn}
              >
                <FontAwesome6
                  name="star"
                  solid={rating >= star}
                  size={28}
                  color={rating >= star ? Colors.orange : palette.border}
                />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[m.label, { color: palette.softText }]}>
            Yorumun
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
            value={review}
            onChangeText={setReview}
            onFocus={scrollToReviewInput}
            placeholder="Aracın en sevdiğin ve sevmediğin yanları neler?"
            placeholderTextColor={palette.muted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          {/* Bilgi kutusu */}
          <View
            style={[
              m.infoBox,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <FontAwesome6
              name="bullhorn"
              size={13}
              color={Colors.orange}
              style={{ marginTop: 2 }}
            />
            <Text style={[m.infoText, { color: palette.muted }]}>
              Yorum yazarsan bu inceleme "Keşfet" sayfasında{" "}
              <Text style={{ fontWeight: "bold", color: palette.text }}>
                Son Deneyimler
              </Text>{" "}
              bölümünde toplulukla paylaşılacaktır.
            </Text>
          </View>
        </ScrollView>

        {/* Kaydet */}
        <View
          style={[
            m.footer,
            { backgroundColor: palette.background, borderTopColor: palette.border },
          ]}
        >
          <TouchableOpacity
            style={[m.saveBtn, !canSave && m.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave}
            activeOpacity={0.85}
          >
            <FontAwesome6
              name="car-side"
              size={14}
              color={Colors.white}
              solid
            />
            <Text style={m.saveBtnText}>
              {initialData ? "Değişiklikleri Kaydet" : "Garaja Ekle"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
        </KeyboardAvoidingView>

      {brandDropdownVisible ? (
        <View style={m.selectorLayer}>
        <Pressable
          style={m.selectorOverlay}
          onPress={() => setBrandDropdownVisible(false)}
        />
        <View
          style={[
            m.selectorSheet,
            { backgroundColor: palette.background, borderColor: palette.border },
          ]}
        >
          <View style={[m.selectorHeader, { borderBottomColor: palette.border }]}>
            <View>
              <Text style={[m.selectorTitle, { color: palette.text }]}>
                Marka Seç
              </Text>
              <Text style={[m.selectorSubtitle, { color: palette.muted }]}>
                Garajına ekleyeceğin aracın markası
              </Text>
            </View>
            <TouchableOpacity
              style={m.closeBtn}
              onPress={() => setBrandDropdownVisible(false)}
            >
              <FontAwesome6 name="xmark" size={16} color={palette.muted} />
            </TouchableOpacity>
          </View>

          <View
            style={[
              m.selectorSearch,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <FontAwesome6
              name="magnifying-glass"
              size={14}
              color={palette.muted}
            />
            <TextInput
              value={brandSearch}
              onChangeText={setBrandSearch}
              placeholder="Marka ara..."
              placeholderTextColor={palette.muted}
              style={[m.selectorSearchInput, { color: palette.text }]}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {brandSearch.length > 0 ? (
              <TouchableOpacity onPress={() => setBrandSearch("")} hitSlop={8}>
                <FontAwesome6 name="xmark" size={14} color={palette.muted} />
              </TouchableOpacity>
            ) : null}
          </View>

          {isLoadingBrands ? (
            <View style={m.selectorLoading}>
              <ActivityIndicator size="small" color={Colors.orange} />
            </View>
          ) : (
            <FlatList
              data={filteredBrandList}
              keyExtractor={(item) => item.value}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={m.selectorList}
              ListEmptyComponent={
                <Text style={[m.selectorEmptyText, { color: palette.muted }]}>
                  Marka bulunamadı.
                </Text>
              }
              renderItem={({ item }) => {
                const isSelected = brandId === item.value;
                return (
                  <TouchableOpacity
                    style={[
                      m.selectorItem,
                      { borderBottomColor: palette.border },
                    ]}
                    onPress={() => {
                      setBrandId(item.value);
                      setBrand(item.label);
                      setModelId(null);
                      setModel("");
                      setBrandDropdownVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        m.selectorItemText,
                        { color: isSelected ? Colors.orange : palette.text },
                      ]}
                    >
                      {item.label}
                    </Text>
                    {isSelected ? (
                      <FontAwesome6
                        name="check"
                        size={14}
                        color={Colors.orange}
                      />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
        </View>
      ) : null}

      {modelDropdownVisible ? (
        <View style={m.selectorLayer}>
        <Pressable
          style={m.selectorOverlay}
          onPress={() => setModelDropdownVisible(false)}
        />
        <View
          style={[
            m.selectorSheet,
            { backgroundColor: palette.background, borderColor: palette.border },
          ]}
        >
          <View style={[m.selectorHeader, { borderBottomColor: palette.border }]}>
            <View>
              <Text style={[m.selectorTitle, { color: palette.text }]}>
                Model Seç
              </Text>
              <Text style={[m.selectorSubtitle, { color: palette.muted }]}>
                {brand || "Seçili marka"} modelleri
              </Text>
            </View>
            <TouchableOpacity
              style={m.closeBtn}
              onPress={() => setModelDropdownVisible(false)}
            >
              <FontAwesome6 name="xmark" size={16} color={palette.muted} />
            </TouchableOpacity>
          </View>

          <View
            style={[
              m.selectorSearch,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <FontAwesome6
              name="magnifying-glass"
              size={14}
              color={palette.muted}
            />
            <TextInput
              value={modelSearch}
              onChangeText={setModelSearch}
              placeholder="Model ara..."
              placeholderTextColor={palette.muted}
              style={[m.selectorSearchInput, { color: palette.text }]}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {modelSearch.length > 0 ? (
              <TouchableOpacity onPress={() => setModelSearch("")} hitSlop={8}>
                <FontAwesome6 name="xmark" size={14} color={palette.muted} />
              </TouchableOpacity>
            ) : null}
          </View>

          {isLoadingModels ? (
            <View style={m.selectorLoading}>
              <ActivityIndicator size="small" color={Colors.orange} />
            </View>
          ) : (
            <FlatList
              data={filteredModelList}
              keyExtractor={(item) => item.value}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={m.selectorList}
              ListEmptyComponent={
                <Text style={[m.selectorEmptyText, { color: palette.muted }]}>
                  Bu markaya ait model bulunamadı.
                </Text>
              }
              renderItem={({ item }) => {
                const isSelected = modelId === item.value;
                return (
                  <TouchableOpacity
                    style={[
                      m.selectorItem,
                      { borderBottomColor: palette.border },
                    ]}
                    onPress={() => {
                      setModelId(item.value);
                      setModel(item.label);
                      setModelDropdownVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        m.selectorItemText,
                        { color: isSelected ? Colors.orange : palette.text },
                      ]}
                    >
                      {item.label}
                    </Text>
                    {isSelected ? (
                      <FontAwesome6
                        name="check"
                        size={14}
                        color={Colors.orange}
                      />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
        </View>
      ) : null}

      <VehicleCatalogPicker
        visible={catalogPickerVisible}
        title="Garaja araç ekle"
        onClose={() => setCatalogPickerVisible(false)}
        onSelect={handleCatalogSelection}
      />
    </Modal>
  );
}

// ─── Yakıt Fişi Ekle Modal ───────────────────────────────────────────────────
function AddFuelModal({
  visible,
  onClose,
  onSave,
  initialData,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (entry: TimelineEntry) => Promise<void> | void;
  initialData?: TimelineEntry | null;
}) {
  const { palette } = useAppTheme();
  const [km, setKm] = useState("");
  const [liters, setLiters] = useState("");
  const [amount, setAmount] = useState("");
  const [fuelType, setFuelType] = useState("Benzin");
  const [station, setStation] = useState("Shell");

  useEffect(() => {
    if (visible) {
      if (initialData) {
        setKm(initialData.km || "");
        setAmount(
          initialData.rawAmount || initialData.amount.replace("₺ ", ""),
        );
        setLiters(initialData.liters || "");
        setStation(initialData.station || "Shell");
        setFuelType(initialData.tag || "Benzin");
      } else {
        setKm("");
        setLiters("");
        setAmount("");
        setFuelType("Benzin");
        setStation("Shell");
      }
    }
  }, [visible, initialData]);

  const FUEL_TYPES = ["Benzin", "Motorin", "LPG"];
  const STATIONS = ["Shell", "Opet", "BP", "Petrol Ofisi", "Diğer"];

  const hasChanges = initialData
    ? km !== (initialData.km || "") ||
      liters !== (initialData.liters || "") ||
      amount !==
        (initialData.rawAmount || initialData.amount.replace("₺ ", "")) ||
      fuelType !== (initialData.tag || "Benzin") ||
      station !== (initialData.station || "Shell")
    : true;

  const canSave = Boolean(km && liters && amount && hasChanges);

  const handleSave = () => {
    onSave({
      id: initialData ? initialData.id : Math.random().toString(),
      date: initialData
        ? initialData.date
        : new Date().toLocaleDateString("tr-TR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
      type: "fuel",
      icon: "gas-pump",
      title: "Yakıt Alımı",
      amount: `₺ ${amount}`,
      detail: `${liters} Litre • ${station} • ${km} km`,
      tag: fuelType,
      active: true,
      km,
      rawAmount: amount,
      liters,
      station,
    });
    setKm("");
    setLiters("");
    setAmount("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={m.overlay} onPress={onClose} />
      <View
        style={[
          m.sheet,
          { height: "85%", backgroundColor: palette.background },
        ]}
      >
        <View style={[m.handle, { backgroundColor: palette.border }]} />
        <View style={[m.header, { borderBottomColor: palette.border }]}>
          <View>
            <Text style={[m.title, { color: palette.text }]}>
              {initialData ? "Yakıt Fişini Düzenle" : "Yakıt Fişi Ekle"}
            </Text>
            <Text style={[m.subtitle, { color: palette.muted }]}>
              Güncel tüketimini ve masrafını takip et
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={m.closeBtn}>
            <FontAwesome6 name="xmark" size={16} color={palette.muted} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={m.form}
          showsVerticalScrollIndicator={false}
        >
          <View style={m.row}>
            <View style={{ flex: 1 }}>
              <Text style={[m.label, { color: palette.softText }]}>
                Güncel Kilometre <Text style={m.required}>*</Text>
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
                placeholder="ör. 68500"
                keyboardType="numeric"
                placeholderTextColor={palette.muted}
              />
            </View>
          </View>

          <View style={m.row}>
            <View style={{ flex: 1 }}>
              <Text style={[m.label, { color: palette.softText }]}>
                Alınan Yakıt (Litre) <Text style={m.required}>*</Text>
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
                value={liters}
                onChangeText={setLiters}
                placeholder="ör. 45.2"
                keyboardType="numeric"
                placeholderTextColor={palette.muted}
              />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={[m.label, { color: palette.softText }]}>
                Toplam Tutar (₺) <Text style={m.required}>*</Text>
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
                value={amount}
                onChangeText={setAmount}
                placeholder="ör. 1850"
                keyboardType="numeric"
                placeholderTextColor={palette.muted}
              />
            </View>
          </View>

          <Text style={[m.label, { color: palette.softText }]}>Yakıt Tipi</Text>
          <View style={m.chipRow}>
            {FUEL_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[
                  m.chip,
                  { backgroundColor: palette.card, borderColor: palette.border },
                  fuelType === t && m.chipActive,
                ]}
                onPress={() => setFuelType(t)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    m.chipText,
                    { color: fuelType === t ? Colors.white : palette.muted },
                    fuelType === t && m.chipTextActive,
                  ]}
                >
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[m.label, { color: palette.softText }]}>
            İstasyon / Marka
          </Text>
          <View style={m.chipRow}>
            {STATIONS.map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  m.chip,
                  { backgroundColor: palette.card, borderColor: palette.border },
                  station === s && m.chipActive,
                ]}
                onPress={() => setStation(s)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    m.chipText,
                    { color: station === s ? Colors.white : palette.muted },
                    station === s && m.chipTextActive,
                  ]}
                >
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <View
          style={[
            m.footer,
            { backgroundColor: palette.background, borderTopColor: palette.border },
          ]}
        >
          <TouchableOpacity
            style={[m.saveBtn, !canSave && m.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave}
            activeOpacity={0.85}
          >
            <FontAwesome6 name="check" size={14} color={Colors.white} solid />
            <Text style={m.saveBtnText}>
              {initialData ? "Değişiklikleri Kaydet" : "Fişi Kaydet"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Servis Ekle Modal ───────────────────────────────────────────────────────
function AddServiceModal({
  visible,
  onClose,
  onSave,
  initialData,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (entry: TimelineEntry) => Promise<void> | void;
  initialData?: TimelineEntry | null;
}) {
  const { palette } = useAppTheme();
  const [km, setKm] = useState("");
  const [type, setType] = useState("Periyodik Bakım");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [mechanic, setMechanic] = useState("");

  useEffect(() => {
    if (visible) {
      if (initialData) {
        setType(initialData.title);
        setAmount(
          initialData.rawAmount || initialData.amount.replace("₺ ", ""),
        );
        setKm(initialData.km || "");
        setNotes(initialData.detail);
        setMechanic(initialData.tag || "");
      } else {
        setKm("");
        setType("Periyodik Bakım");
        setAmount("");
        setNotes("");
        setMechanic("");
      }
    }
  }, [visible, initialData]);

  const SERVICE_TYPES = [
    "Periyodik Bakım",
    "Arıza / Onarım",
    "Muayene",
    "Lastik Değişimi",
    "Kaporta / Boya",
  ];

  const hasChanges = initialData
    ? km !== (initialData.km || "") ||
      type !== initialData.title ||
      amount !==
        (initialData.rawAmount || initialData.amount.replace("₺ ", "")) ||
      notes !== initialData.detail ||
      mechanic !== (initialData.tag || "")
    : true;

  const canSave = Boolean(km && amount && notes && hasChanges);

  const handleSave = () => {
    let iconName = "wrench";
    if (type === "Muayene") iconName = "clipboard-check";
    else if (type === "Lastik Değişimi") iconName = "dharmachakra";
    else if (type === "Kaporta / Boya") iconName = "spray-can";

    onSave({
      id: initialData ? initialData.id : Math.random().toString(),
      date: initialData
        ? initialData.date
        : new Date().toLocaleDateString("tr-TR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
      type: "service",
      icon: iconName,
      title: type,
      amount: `₺ ${amount}`,
      detail: notes,
      tag: mechanic || undefined,
      active: false,
      km,
      rawAmount: amount,
    });
    setKm("");
    setAmount("");
    setNotes("");
    setMechanic("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={m.overlay} onPress={onClose} />
      <View
        style={[
          m.sheet,
          { height: "92%", backgroundColor: palette.background },
        ]}
      >
        <View style={[m.handle, { backgroundColor: palette.border }]} />
        <View style={[m.header, { borderBottomColor: palette.border }]}>
          <View>
            <Text style={[m.title, { color: palette.text }]}>
              {initialData ? "Servis Kaydını Düzenle" : "Servis Kaydı Ekle"}
            </Text>
            <Text style={[m.subtitle, { color: palette.muted }]}>
              Bakım ve onarım geçmişini oluştur
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={m.closeBtn}>
            <FontAwesome6 name="xmark" size={16} color={palette.muted} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={m.form}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[m.label, { color: palette.softText }]}>Servis Tipi</Text>
          <View style={m.chipRow}>
            {SERVICE_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[
                  m.chip,
                  { backgroundColor: palette.card, borderColor: palette.border },
                  type === t && m.chipActive,
                ]}
                onPress={() => setType(t)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    m.chipText,
                    { color: type === t ? Colors.white : palette.muted },
                    type === t && m.chipTextActive,
                  ]}
                >
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={m.row}>
            <View style={{ flex: 1 }}>
              <Text style={[m.label, { color: palette.softText }]}>
                Servis Kilometresi <Text style={m.required}>*</Text>
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
                placeholder="ör. 68500"
                keyboardType="numeric"
                placeholderTextColor={palette.muted}
              />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={[m.label, { color: palette.softText }]}>
                Toplam Tutar (₺) <Text style={m.required}>*</Text>
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
                value={amount}
                onChangeText={setAmount}
                placeholder="ör. 6500"
                keyboardType="numeric"
                placeholderTextColor={palette.muted}
              />
            </View>
          </View>

          <Text style={[m.label, { color: palette.softText }]}>
            Servis Yeri / Usta
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
            value={mechanic}
            onChangeText={setMechanic}
            placeholder="ör. Özen Oto Sanayi"
            placeholderTextColor={palette.muted}
          />

          <Text style={[m.label, { color: palette.softText }]}>
            Yapılan İşlemler <Text style={m.required}>*</Text>
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
            value={notes}
            onChangeText={setNotes}
            placeholder="10 bin bakımı yapıldı, ön balatalar değişti..."
            placeholderTextColor={palette.muted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </ScrollView>

        <View
          style={[
            m.footer,
            { backgroundColor: palette.background, borderTopColor: palette.border },
          ]}
        >
          <TouchableOpacity
            style={[m.saveBtn, !canSave && m.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave}
            activeOpacity={0.85}
          >
            <FontAwesome6 name="check" size={14} color={Colors.white} solid />
            <Text style={m.saveBtnText}>
              {initialData ? "Değişiklikleri Kaydet" : "Kaydet"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Boş State ────────────────────────────────────────────────────────────────
function EmptyGarage({ onAdd }: { onAdd: () => void }) {
  const { palette } = useAppTheme();

  return (
    <View style={styles.emptyWrapper}>
      <View style={styles.emptyIconRing}>
        <View style={styles.emptyIconInner}>
          <FontAwesome6 name="warehouse" size={32} color={Colors.orange} />
        </View>
      </View>

      <Text style={[styles.emptyTitle, { color: palette.text }]}>
        Garajın Boş
      </Text>
      <Text style={[styles.emptyDesc, { color: palette.muted }]}>
        Şu an bindiğin aracı ekle.{"\n"}
        Yakıt fişleri, bakım masrafları ve kronik{"\n"}
        sorunlarını burada takip edebilirsin.
      </Text>

      {[
        { icon: "gas-pump", color: "#facc15", text: "Yakıt & masraf takibi" },
        { icon: "wrench", color: "#60a5fa", text: "Servis geçmişi kaydı" },
        {
          icon: "star",
          color: Colors.orange,
          text: "Topluluğa deneyim aktarımı",
        },
      ].map((f) => (
        <View key={f.text} style={styles.featureRow}>
          <View
            style={[styles.featureIcon, { backgroundColor: f.color + "22" }]}
          >
            <FontAwesome6 name={f.icon} size={13} color={f.color} solid />
          </View>
          <Text style={[styles.featureText, { color: palette.softText }]}>
            {f.text}
          </Text>
        </View>
      ))}

      <TouchableOpacity
        style={styles.addCarBtn}
        onPress={onAdd}
        activeOpacity={0.85}
      >
        <FontAwesome6 name="plus" size={14} color={Colors.white} />
        <Text style={styles.addCarBtnText}>Aracımı Ekle</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Dolu State ───────────────────────────────────────────────────────────────
function FilledGarage({
  car,
  timeline,
  onAddFuel,
  onAddService,
  onEditCar,
  onEditEntry,
}: {
  car: UserCar;
  timeline: TimelineEntry[];
  onAddFuel: () => void;
  onAddService: () => void;
  onEditCar: () => void;
  onEditEntry: (entry: TimelineEntry) => void;
}) {
  const { palette } = useAppTheme();
  const rawDisplayImages = useMemo(
    () =>
      (car.images && car.images.length > 0 ? car.images : [car.image]).filter(
        Boolean,
      ),
    [car.image, car.images],
  );
  const rawDisplayImagesKey = useMemo(
    () => rawDisplayImages.join("|"),
    [rawDisplayImages],
  );
  const [displayImages, setDisplayImages] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;

    const resolveImages = async () => {
      const resolved = await resolvePrivateFileUrls(rawDisplayImages);
      if (isMounted) {
        setDisplayImages(resolved.filter(Boolean));
      }
    };

    resolveImages();

    return () => {
      isMounted = false;
    };
  }, [rawDisplayImages, rawDisplayImagesKey]);

  // Eklenen kayıtlara göre toplam masrafları hesapla
  const totalFuelExpense = timeline
    .filter((t) => t.type === "fuel")
    .reduce((sum, t) => sum + (parseFloat(t.rawAmount || "0") || 0), 0);

  const totalServiceExpense = timeline
    .filter((t) => t.type === "service")
    .reduce((sum, t) => sum + (parseFloat(t.rawAmount || "0") || 0), 0);

  return (
    <>
      <View
        style={[
          styles.carCard,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        <View style={styles.carImageWrapper}>
          {displayImages.length > 0 ? (
            <PhotoCarousel images={displayImages} height={210} />
          ) : (
            <View
              style={[
                styles.carImageFallback,
                { backgroundColor: palette.elevated },
              ]}
            >
              <FontAwesome6 name="car-side" size={34} color={Colors.orange} />
            </View>
          )}
        </View>

        <View style={styles.carInfo}>
          <View style={styles.carInfoTop}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                  marginBottom: 2,
                }}
              >
                <Text style={[styles.carName, { color: palette.text }]}>
                  {car.year} {car.brand} {car.model}
                </Text>
                <TouchableOpacity
                  onPress={onEditCar}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <FontAwesome6
                    name="pen-to-square"
                    size={14}
                    color={Colors.orange}
                  />
                </TouchableOpacity>
              </View>
              <Text style={[styles.carTrim, { color: palette.muted }]}>
                {car.trim}
              </Text>
            </View>
            <View style={styles.kmBox}>
              <Text style={[styles.kmLabel, { color: palette.softText }]}>
                Güncel KM
              </Text>
              <Text style={styles.kmValue}>{car.km} km</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View
              style={[
                styles.statBox,
                { backgroundColor: palette.elevated, borderColor: palette.border },
              ]}
            >
              <View style={styles.statBoxHeader}>
                <FontAwesome6
                  name="gas-pump"
                  size={11}
                  color={palette.muted}
                />
                <Text style={[styles.statBoxLabel, { color: palette.softText }]}>
                  Yakıt Masrafı
                </Text>
              </View>
              <Text style={[styles.statBoxValue, { color: palette.text }]}>
                ₺ {totalFuelExpense.toLocaleString("tr-TR")}
              </Text>
            </View>
            <View
              style={[
                styles.statBox,
                { backgroundColor: palette.elevated, borderColor: palette.border },
              ]}
            >
              <View style={styles.statBoxHeader}>
                <FontAwesome6
                  name="wrench"
                  size={11}
                  color={palette.muted}
                />
                <Text style={[styles.statBoxLabel, { color: palette.softText }]}>
                  Servis Masrafı
                </Text>
              </View>
              <Text style={[styles.statBoxValue, { color: palette.text }]}>
                ₺ {totalServiceExpense.toLocaleString("tr-TR")}
              </Text>
            </View>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.primaryBtn}
              activeOpacity={0.8}
              onPress={onAddFuel}
            >
              <FontAwesome6 name="plus" size={11} color={Colors.white} />
              <Text style={styles.primaryBtnText}>Yakıt Fişi Ekle</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.secondaryBtn,
                { backgroundColor: palette.elevated, borderColor: palette.border },
              ]}
              activeOpacity={0.8}
              onPress={onAddService}
            >
              <FontAwesome6 name="wrench" size={11} color={Colors.white} />
              <Text style={[styles.secondaryBtnText, { color: palette.text }]}>
                Servis Ekle
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.timelineSection}>
        <Text style={[styles.timelineSectionTitle, { color: palette.text }]}>
          Son Kayıtlar
        </Text>
        <View style={styles.timelineWrapper}>
          {timeline.length > 0 ? (
            <>
              <View
                style={[
                  styles.timelineLine,
                  { backgroundColor: palette.border },
                ]}
              />
              {timeline.map((item) => (
                <View key={item.id} style={styles.timelineItem}>
                  <View
                    style={[
                      styles.timelineDot,
                      {
                        backgroundColor: item.active
                          ? Colors.orange
                          : palette.border,
                        borderColor: palette.background,
                      },
                    ]}
                  />
                  <View style={styles.timelineContent}>
                    <Text
                      style={[
                        styles.timelineDate,
                        {
                          color: item.active ? Colors.orange : palette.muted,
                        },
                      ]}
                    >
                      {item.date}
                    </Text>
                    <View
                      style={[
                        styles.timelineCard,
                        {
                          backgroundColor: palette.card,
                          borderColor: palette.border,
                        },
                      ]}
                    >
                      <View style={styles.timelineCardTop}>
                        <View style={styles.timelineCardLeft}>
                          <FontAwesome6
                            name={item.icon}
                            size={11}
                            color={palette.muted}
                            solid
                          />
                          <Text
                            style={[
                              styles.timelineTitle,
                              { color: palette.text },
                            ]}
                          >
                            {item.title}
                          </Text>
                        </View>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <Text
                            style={[
                              styles.timelineAmount,
                              { color: palette.text },
                            ]}
                          >
                            {item.amount}
                          </Text>
                          <TouchableOpacity
                            onPress={() => onEditEntry(item)}
                            hitSlop={{
                              top: 10,
                              bottom: 10,
                              left: 10,
                              right: 10,
                            }}
                          >
                            <FontAwesome6
                              name="pen-to-square"
                              size={12}
                              color={Colors.orange}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                      <Text
                        style={[
                          styles.timelineDetail,
                          { color: palette.muted },
                        ]}
                      >
                        {item.detail}
                      </Text>
                      {item.tag && (
                        <View
                          style={[
                            styles.timelineTag,
                            {
                              backgroundColor: palette.elevated,
                              borderColor: palette.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.timelineTagText,
                              { color: palette.softText },
                            ]}
                          >
                            {item.tag}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              ))}
            </>
          ) : (
            <View style={{ alignItems: "center", paddingVertical: 20 }}>
              <FontAwesome6
                name="file-invoice"
                size={24}
                color={palette.border}
                style={{ marginBottom: 12 }}
              />
              <Text
                style={{
                  fontSize: 13,
                  color: palette.muted,
                  fontStyle: "italic",
                  textAlign: "center",
                  lineHeight: 18,
                }}
              >
                Henüz bir kayıt eklemediniz.{"\n"}Yakıt veya servis masraflarını
                buradan takip edebilirsiniz.
              </Text>
            </View>
          )}
        </View>
      </View>
    </>
  );
}

// ─── Ana Ekran ────────────────────────────────────────────────────────────────
export default function GarageScreen() {
  const { palette } = useAppTheme();
  const [cars, setCars] = useState<UserCar[]>([]);
  const [car, setCar] = useState<UserCar | null>(null);
  const [loadingGarage, setLoadingGarage] = useState(false);
  const [modalVisible, setModal] = useState(false);
  const [editingCar, setEditingCar] = useState<UserCar | null>(null);
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [fuelModal, setFuelModal] = useState(false);
  const [serviceModal, setServiceModal] = useState(false);
  const [editingService, setEditingService] = useState<TimelineEntry | null>(
    null,
  );
  const [editingFuel, setEditingFuel] = useState<TimelineEntry | null>(null);
  const { addReview } = useReviews();
  const { setGarageCarCount, user, isAuthReady } = useAuth();
  const displayName = user?.name?.trim() || "Sürücü";
  const displayAvatar = user?.avatar || "";

  useEffect(() => {
    if (isAuthReady && !user?.id) {
      router.replace(loginRoute("/garage") as any);
    }
  }, [isAuthReady, router, user?.id]);

  useEffect(() => {
    setGarageCarCount(cars.length);
  }, [cars.length, setGarageCarCount]);

  const fetchGarageCars = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const currentUserId = session?.user?.id || user?.id;

    if (!currentUserId) {
      setCars([]);
      setCar(null);
      setTimeline([]);
      setLoadingGarage(false);
      return;
    }

    setLoadingGarage(true);
    const { data, error } = await supabase
      .from("garage_cars")
      .select("id,brand,model,year,trim,km,image,images,rating,review,created_at")
      .eq("user_id", currentUserId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Garaj aracı alınamadı:", error.message);
      setLoadingGarage(false);
      return;
    }

    if (data?.length) {
      const nextCars: UserCar[] = data.map((item: any) => {
        const image =
          item.image ||
          (Array.isArray(item.images) && item.images[0]) ||
          "";

        return {
          id: item.id,
          brand: item.brand,
          model: item.model,
          year: item.year,
          trim: item.trim || `${item.year} ${item.brand} ${item.model}`,
          km: item.km || "0",
          image,
          images: Array.isArray(item.images)
            ? item.images
            : image
              ? [image]
              : [],
          rating: item.rating ? Number(item.rating) : undefined,
          review: item.review || "",
        };
      });

      setCars(nextCars);
      setCar((current) =>
        nextCars.find((item) => item.id === current?.id) || nextCars[0],
      );
    } else {
      setCars([]);
      setCar(null);
      setTimeline([]);
    }

    setLoadingGarage(false);
  }, [user?.id]);

  useEffect(() => {
    void fetchGarageCars();
  }, [fetchGarageCars]);

  useFocusEffect(
    useCallback(() => {
      void fetchGarageCars();
    }, [fetchGarageCars]),
  );

  useEffect(() => {
    let isMounted = true;

    const fetchTimeline = async () => {
      if (!user?.id || !car?.id) {
        setTimeline([]);
        return;
      }

      const { data, error } = await supabase
        .from("timeline_entries")
        .select(
          "id,user_id,garage_car_id,type,title,amount,detail,tag,icon,km,metadata,entry_date,created_at",
        )
        .eq("user_id", user.id)
        .eq("garage_car_id", car.id)
        .order("entry_date", { ascending: false });

      if (error) {
        const missingGarageCarColumn = error.message.includes(
          "timeline_entries.garage_car_id",
        );

        if (missingGarageCarColumn) {
          if (isMounted) setTimeline([]);
        } else {
          console.error("Garaj masrafları alınamadı:", error.message);
        }
        return;
      }

      if (isMounted) {
        setTimeline((data || []).map(buildTimelineEntryFromRow));
      }
    };

    fetchTimeline();

    return () => {
      isMounted = false;
    };
  }, [user?.id, car?.id]);

  const handleAddFuelPress = () => {
    setEditingFuel(null);
    setFuelModal(true);
  };

  const handleAddServicePress = () => {
    setEditingService(null);
    setServiceModal(true);
  };

  const handleEditEntry = (entry: TimelineEntry) => {
    if (entry.type === "service") {
      setEditingService(entry);
      setServiceModal(true);
    } else if (entry.type === "fuel") {
      setEditingFuel(entry);
      setFuelModal(true);
    }
  };

  const openAddCarModal = () => {
    setEditingCar(null);
    setModal(true);
  };

  const openEditCarModal = () => {
    setEditingCar(car);
    setModal(true);
  };

  const selectGarageCar = (nextCar: UserCar) => {
    if (nextCar.id === car?.id) return;
    setTimeline([]);
    setCar(nextCar);
  };

  const persistTimelineEntry = async (entry: TimelineEntry) => {
    if (!user?.id || !car?.id) {
      Alert.alert("Hata", "Masraf kaydı için önce garaja araç ekleyin.");
      return null;
    }

    const payload = buildTimelinePayload(entry, user.id, car.id);
    const isExisting = Boolean(
      (entry.type === "fuel" && editingFuel) ||
        (entry.type === "service" && editingService),
    );

    const query = isExisting
      ? supabase
          .from("timeline_entries")
          .update(payload)
          .eq("id", entry.id)
          .select()
          .single()
      : supabase.from("timeline_entries").insert(payload).select().single();

    const { data, error } = await query;

    if (error) {
      const missingTimelineColumn =
        error.message.includes("timeline_entries.garage_car_id") ||
        error.message.includes("garage_car_id");

      if (missingTimelineColumn) {
        Alert.alert(
          "Garaj geçmişi şu anda kullanılamıyor",
          "Masraf kaydın şu anda oluşturulamıyor. Lütfen daha sonra tekrar dene.",
        );
        return null;
      }

      Alert.alert("Hata", "Masraf kaydı kaydedilemedi: " + error.message);
      return null;
    }

    return buildTimelineEntryFromRow(data);
  };

  const handleSaveService = async (entry: TimelineEntry) => {
    const savedEntry = await persistTimelineEntry(entry);
    if (!savedEntry) return;

    if (editingService) {
      setTimeline((prev) =>
        prev.map((t) => (t.id === savedEntry.id ? savedEntry : t)),
      );
      setEditingService(null);
    } else {
      setTimeline((prev) => [savedEntry, ...prev]);
    }
  };

  const handleSaveFuel = async (entry: TimelineEntry) => {
    const savedEntry = await persistTimelineEntry(entry);
    if (!savedEntry) return;

    if (editingFuel) {
      setTimeline((prev) =>
        prev.map((t) => (t.id === savedEntry.id ? savedEntry : t)),
      );
      setEditingFuel(null);
    } else {
      setTimeline((prev) => [savedEntry, ...prev]);
    }
  };

  const handleDeleteCar = async () => {
    if (car?.id) {
      await supabase.from("timeline_entries").delete().eq("garage_car_id", car.id);

      const { error } = await supabase
        .from("garage_cars")
        .delete()
        .eq("id", car.id);

      if (error) {
        Alert.alert("Hata", "Araç silinemedi: " + error.message);
        return;
      }
    }

    const remainingCars = cars.filter((item) => item.id !== car?.id);
    setCars(remainingCars);
    setCar(remainingCars[0] || null);
    setTimeline([]);
  };

  const handleBackPress = () => {
    const source = Array.isArray(from) ? from[0] : from;
    if (source === "profile") {
      router.replace("/profile");
      return;
    }

    router.back();
  };

  const handleSaveCar = async (nextCar: UserCar) => {
    const reviewText = nextCar.review?.trim() || "";

    if (reviewText) {
      const moderation = validateCleanContent([
        { label: "Araç yorumu", value: reviewText },
      ]);

      if (!moderation.ok) {
        Alert.alert("Uygunsuz içerik", moderation.message);
        throw new Error("Uygunsuz içerik engellendi.");
      }
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const currentUserId = session?.user?.id || user?.id;

    if (!currentUserId) {
      Alert.alert("Hata", "Garaja araç eklemek için lütfen giriş yapın.");
      throw new Error("Kullanıcı oturumu bulunamadı.");
    }

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: currentUserId,
      display_name: displayName,
      full_name: displayName,
      avatar_url: user?.avatar || null,
    });

    if (profileError) {
      Alert.alert(
        "Hata",
        "Profil kaydı hazırlanamadı: " + profileError.message,
      );
      throw profileError;
    }

    const uploadedImages = await uploadPrivateFiles(
      (nextCar.images || [nextCar.image]).filter(Boolean),
      currentUserId,
      "garage",
    );
    const primaryImage = uploadedImages[0] || nextCar.image || "";

    const payload = {
      user_id: currentUserId,
      brand: nextCar.brand,
      model: nextCar.model,
      year: nextCar.year,
      trim: nextCar.trim,
      km: nextCar.km,
      image: primaryImage,
      images:
        uploadedImages.length > 0
          ? uploadedImages
          : primaryImage
            ? [primaryImage]
            : [],
      rating: nextCar.rating ?? null,
      review: reviewText || null,
    };

    const existingCarId = nextCar.id;
    const query = existingCarId
      ? supabase
          .from("garage_cars")
          .update(payload)
          .eq("id", existingCarId)
          .select()
          .single()
      : supabase.from("garage_cars").insert(payload).select().single();

    const { data, error } = await query;

    if (error) {
      Alert.alert("Hata", "Araç garaja kaydedilemedi: " + error.message);
      throw error;
    }

    const savedCar: UserCar = {
      ...nextCar,
      image: primaryImage,
      images:
        uploadedImages.length > 0
          ? uploadedImages
          : primaryImage
            ? [primaryImage]
            : [],
      id: data.id,
    };

    setCars((current) => {
      if (existingCarId) {
        return current.map((item) =>
          item.id === existingCarId ? savedCar : item,
        );
      }
      return [savedCar, ...current];
    });
    setCar(savedCar);

    if (!existingCarId && reviewText) {
      const reviewPayload = {
        user_id: currentUserId,
        user: displayName,
        avatar: displayAvatar,
        brand_id: savedCar.brandId || null,
        model_id: savedCar.modelId || null,
        brand: savedCar.brand,
        car: `${savedCar.year} ${savedCar.brand} ${savedCar.model}`,
        title: `${savedCar.brand} ${savedCar.model} deneyimim`,
        comment: reviewText,
        rating: savedCar.rating ?? null,
        images: [],
        date: "Şimdi",
      };

      const { data: reviewData, error: reviewError } = await supabase
        .from("reviews")
        .insert(reviewPayload)
        .select()
        .single();

      if (reviewError) {
        console.error("Garaj incelemesi kaydedilemedi:", reviewError.message);
      } else {
        addReview({
          id: reviewData.id,
          user: displayName,
          brand: savedCar.brand,
          car: `${savedCar.year} ${savedCar.brand} ${savedCar.model}`,
          rating: savedCar.rating,
          comment: reviewText,
          date: "Şimdi",
          avatar: displayAvatar,
        });
      }
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: palette.background }]}
      edges={["top"]}
    >
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          <TouchableOpacity
            onPress={handleBackPress}
            style={{ marginRight: 16, padding: 4 }}
          >
            <FontAwesome6 name="arrow-left" size={20} color={palette.text} />
          </TouchableOpacity>
          <View>
            <Text style={[styles.headerTitle, { color: palette.text }]}>
              Benim <Text style={styles.headerAccent}>Garajım</Text>
            </Text>
            <Text style={[styles.headerSub, { color: palette.muted }]}>
              Dijital ruhsat & muhasebe
            </Text>
          </View>
        </View>
        {cars.length > 0 && (
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={openAddCarModal}
              activeOpacity={0.8}
            >
              <FontAwesome6 name="plus" size={14} color={Colors.white} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addBtn, styles.deleteBtn]}
              onPress={() =>
                Alert.alert(
                  "Aracı Sil",
                  "Aracı ve tüm kayıtlarını garajdan silmek istediğinize emin misiniz?",
                  [
                    { text: "İptal", style: "cancel" },
                    {
                      text: "Sil",
                      style: "destructive",
                      onPress: handleDeleteCar,
                    },
                  ],
                )
              }
              activeOpacity={0.8}
            >
              <FontAwesome6 name="trash" size={14} color="#ef4444" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {loadingGarage ? (
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <Text style={{ color: palette.muted }}>Garaj yükleniyor...</Text>
          </View>
        ) : car ? (
          <>
            <View style={styles.garageListHeader}>
              <View>
                <Text style={[styles.garageListTitle, { color: palette.text }]}>
                  Araçlarım
                </Text>
                <Text style={[styles.garageListCount, { color: palette.muted }]}>
                  {cars.length} araç kayıtlı
                </Text>
              </View>
              <Text style={[styles.garageListHint, { color: palette.muted }]}>
                Detaylarını görmek için seç
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.garageCarList}
            >
              {cars.map((item) => {
                const isSelected = item.id === car.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.garageCarChip,
                      {
                        backgroundColor: palette.card,
                        borderColor: isSelected
                          ? Colors.orange
                          : palette.border,
                      },
                    ]}
                    onPress={() => selectGarageCar(item)}
                    activeOpacity={0.82}
                  >
                    <View
                      style={[
                        styles.garageCarChipIcon,
                        {
                          backgroundColor: isSelected
                            ? "rgba(249, 115, 22, 0.16)"
                            : palette.elevated,
                        },
                      ]}
                    >
                      <FontAwesome6
                        name="car-side"
                        size={15}
                        color={isSelected ? Colors.orange : palette.muted}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.garageCarChipName,
                          { color: palette.text },
                        ]}
                        numberOfLines={1}
                      >
                        {item.brand} {item.model}
                      </Text>
                      <Text
                        style={[
                          styles.garageCarChipMeta,
                          { color: palette.muted },
                        ]}
                        numberOfLines={1}
                      >
                        {item.year} · {item.km || "0"} km
                      </Text>
                    </View>
                    {isSelected ? (
                      <FontAwesome6
                        name="circle-check"
                        size={14}
                        color={Colors.orange}
                        solid
                      />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[
                  styles.garageCarAddChip,
                  { borderColor: palette.border },
                ]}
                onPress={openAddCarModal}
              >
                <FontAwesome6 name="plus" size={15} color={Colors.orange} />
                <Text style={styles.garageCarAddText}>Araç ekle</Text>
              </TouchableOpacity>
            </ScrollView>

            <FilledGarage
              car={car}
              timeline={timeline}
              onAddFuel={handleAddFuelPress}
              onAddService={handleAddServicePress}
              onEditCar={openEditCarModal}
              onEditEntry={handleEditEntry}
            />
          </>
        ) : (
          <EmptyGarage onAdd={openAddCarModal} />
        )}
      </ScrollView>

	      <AddCarModal
	        visible={modalVisible}
	        onClose={() => {
          setModal(false);
          setEditingCar(null);
        }}
        onSave={handleSaveCar}
	        initialData={editingCar}
	      />
      <AddFuelModal
        visible={fuelModal}
        onClose={() => setFuelModal(false)}
        onSave={handleSaveFuel}
        initialData={editingFuel}
      />
      <AddServiceModal
        visible={serviceModal}
        onClose={() => setServiceModal(false)}
        onSave={handleSaveService}
        initialData={editingService}
      />
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────
const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  keyboardAvoiding: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.navyMain || "#0B132B",
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
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.navyBorder,
  },
  title: { fontSize: 18, fontWeight: "800", color: Colors.white },
  subtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 3 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.navyCard,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  form: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.white,
    marginBottom: 4,
  },
  sectionDesc: { fontSize: 12, color: Colors.textMuted, marginBottom: 12 },
  divider: {
    height: 1,
    backgroundColor: Colors.navyBorder,
    marginVertical: 20,
  },
  row: { flexDirection: "row" },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.gray300,
    marginBottom: 6,
    marginTop: 14,
  },
  required: { color: Colors.orange },
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
  dropdownButton: {
    minHeight: 46,
    backgroundColor: Colors.navyCard,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  dropdownButtonText: {
    flex: 1,
    color: Colors.white,
    fontSize: 14,
    fontWeight: "600",
  },
  dropdownMenu: {
    position: "absolute",
    top: 80,
    left: 0,
    right: 0,
    maxHeight: 210,
    backgroundColor: Colors.navyCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    overflow: "hidden",
    zIndex: 50,
    elevation: 12,
  },
  dropdownScroll: { maxHeight: 210 },
  dropdownItem: {
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.navyBorder,
    justifyContent: "center",
  },
  dropdownItemText: {
    color: Colors.gray300,
    fontSize: 14,
    fontWeight: "600",
  },
  vehicleSelector: {
    minHeight: 62,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  vehicleSelectorIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "rgba(255,101,0,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  vehicleSelectorCaption: {
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 3,
  },
  vehicleSelectorValue: {
    fontSize: 14,
    fontWeight: "800",
  },
  selectorOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  selectorLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    elevation: 100,
  },
  selectorSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "82%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    overflow: "hidden",
  },
  selectorHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  selectorTitle: {
    fontSize: 18,
    fontWeight: "900",
  },
  selectorSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 3,
  },
  selectorSearch: {
    marginHorizontal: 20,
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  selectorSearchInput: {
    flex: 1,
    fontSize: 14,
  },
  selectorLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  selectorList: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 32,
  },
  selectorItem: {
    minHeight: 52,
    borderBottomWidth: 1,
    paddingHorizontal: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  selectorItemText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
  },
  selectorEmptyText: {
    textAlign: "center",
    fontSize: 13,
    marginTop: 32,
  },
  imagePreviewCarousel: { marginTop: 8, marginBottom: 10 },
  imageActionRow: { paddingVertical: 8 },
  addMultipleImageBtn: {
    minHeight: 56,
    width: "100%",
    backgroundColor: Colors.navyCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  addMultipleImageText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 0,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    backgroundColor: Colors.navyCard,
  },
  chipActive: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  chipText: { fontSize: 13, color: Colors.textMuted, fontWeight: "600" },
  chipTextActive: { color: Colors.white },
  textArea: { height: 90, paddingTop: 12 },
  ratingContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    marginVertical: 10,
  },
  starBtn: { padding: 5 },
  errorText: {
    color: "#f87171",
    fontSize: 11,
    textAlign: "center",
    marginTop: 4,
  },
  infoBox: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: "rgba(255, 101, 0, 0.08)",
    borderRadius: 14,
    padding: 14,
    marginTop: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 101, 0, 0.2)",
  },
  infoText: { flex: 1, fontSize: 12, color: Colors.textMuted, lineHeight: 18 },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.navyBorder,
    backgroundColor: Colors.navyMain,
  },
  saveBtn: {
    backgroundColor: Colors.orange,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveBtnDisabled: { backgroundColor: Colors.navyBorder, opacity: 0.5 },
  saveBtnText: { color: Colors.white, fontSize: 15, fontWeight: "800" },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.navyMain || "#0B132B" },
  scroll: { paddingBottom: 100 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.navyBorder,
  },
  headerTitle: { fontSize: 20, fontWeight: "800", color: Colors.white },
  headerAccent: { color: Colors.orange },
  headerSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.orange,
    justifyContent: "center",
    alignItems: "center",
    boxShadow: "0 3px 6px rgba(249, 115, 22, 0.28)",
    elevation: 4,
  },
  deleteBtn: {
    backgroundColor: "rgba(239,68,68,0.15)",
    boxShadow: "0 3px 6px rgba(239, 68, 68, 0.28)",
  },
  emptyWrapper: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingTop: 60,
    paddingBottom: 40,
  },
  emptyIconRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255,101,0,0.08)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(255,101,0,0.15)",
  },
  emptyIconInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,101,0,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.white,
    marginBottom: 10,
  },
  emptyDesc: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 28,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "100%",
    marginBottom: 12,
  },
  featureIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  featureText: { fontSize: 13, color: Colors.gray300, fontWeight: "500" },
  addCarBtn: {
    marginTop: 28,
    backgroundColor: Colors.orange,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addCarBtnText: { color: Colors.white, fontSize: 15, fontWeight: "800" },
  garageListHeader: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  garageListTitle: {
    fontSize: 16,
    fontWeight: "900",
  },
  garageListCount: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  garageListHint: {
    fontSize: 10,
    fontWeight: "600",
    textAlign: "right",
  },
  garageCarList: {
    paddingHorizontal: 20,
    paddingBottom: 2,
    gap: 10,
  },
  garageCarChip: {
    width: 220,
    minHeight: 68,
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  garageCarChipIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  garageCarChipName: {
    fontSize: 13,
    fontWeight: "800",
  },
  garageCarChipMeta: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 3,
  },
  garageCarAddChip: {
    width: 104,
    minHeight: 68,
    borderRadius: 15,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  garageCarAddText: {
    color: Colors.orange,
    fontSize: 11,
    fontWeight: "800",
  },
  carCard: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: Colors.navyCard,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  carImageWrapper: { height: 210, position: "relative" },
  carImageFallback: {
    width: CARD_WIDTH,
    height: 210,
    backgroundColor: Colors.navyMain,
    alignItems: "center",
    justifyContent: "center",
  },
  carInfo: { padding: 16 },
  carInfoTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  carName: {
    fontSize: 18,
    fontWeight: "900",
    color: Colors.white,
    letterSpacing: -0.4,
  },
  carTrim: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  kmBox: { alignItems: "flex-end" },
  kmLabel: { fontSize: 10, color: Colors.gray300 },
  kmValue: {
    fontWeight: "700",
    color: Colors.orange,
    fontFamily: "monospace",
    fontSize: 13,
  },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 14 },
  statBox: {
    flex: 1,
    backgroundColor: Colors.navyMain,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  statBoxHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  statBoxLabel: { fontSize: 10, color: Colors.gray300 },
  statBoxValue: { fontSize: 14, fontWeight: "700", color: Colors.white },
  statBoxUnit: { fontSize: 10, fontWeight: "400", color: Colors.gray300 },
  actionsRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.orange,
    borderRadius: 10,
    paddingVertical: 11,
  },
  primaryBtnText: { color: Colors.white, fontSize: 12, fontWeight: "700" },
  secondaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.navyMain,
    borderRadius: 10,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  secondaryBtnText: { color: Colors.white, fontSize: 12, fontWeight: "700" },
  timelineSection: { paddingHorizontal: 20, marginTop: 28 },
  timelineSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.white,
    marginBottom: 20,
  },
  timelineWrapper: { position: "relative", paddingLeft: 12 },
  timelineLine: {
    position: "absolute",
    left: 12,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: Colors.navyBorder,
  },
  timelineItem: {
    flexDirection: "row",
    marginBottom: 24,
    alignItems: "flex-start",
  },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: Colors.navyMain,
    marginLeft: -7,
    marginRight: 16,
    marginTop: 2,
    zIndex: 1,
  },
  timelineContent: { flex: 1 },
  timelineDate: { fontSize: 10, fontWeight: "700", marginBottom: 6 },
  timelineCard: {
    backgroundColor: Colors.navyCard,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  timelineCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  timelineCardLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  timelineTitle: { fontSize: 12, fontWeight: "700", color: Colors.white },
  timelineAmount: { fontSize: 12, fontWeight: "700", color: Colors.white },
  timelineDetail: { fontSize: 10, color: Colors.textMuted, marginBottom: 6 },
  timelineTag: {
    alignSelf: "flex-start",
    backgroundColor: Colors.navyMain,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  timelineTagText: { fontSize: 9, color: Colors.gray300 },
});
