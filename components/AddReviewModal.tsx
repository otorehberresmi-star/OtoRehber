import Colors from "@/constants/Colors";
import { FontAwesome6 } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
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

import { Review } from "../contexts/ReviewContext";
import { useAppTheme } from "../contexts/ThemeContext";
import { supabase } from "../supabaseClient";
import {
  CONTENT_MODERATION_MESSAGE,
  isBlockedLanguageError,
  validateCleanContent,
} from "../utils/contentModeration";
import { uploadPublicFiles } from "../utils/storageUpload";
import { VehicleCatalogSelection } from "../utils/vehicleCatalog";
import PhotoCarousel from "./PhotoCarousel";
import VehicleCatalogPicker from "./VehicleCatalogPicker";

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
      if (isBlockedLanguageError(err)) {
        Alert.alert("Uygunsuz içerik", CONTENT_MODERATION_MESSAGE);
        return;
      }
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
      <KeyboardAvoidingView
        style={m.keyboardAvoiding}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
        pointerEvents="box-none"
      >
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
            onPress={() => {
              Keyboard.dismiss();
              setCatalogPickerVisible(true);
            }}
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

      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Ana Ekran ─────────────────────────────────────────────────────────────────

const m = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  keyboardAvoiding: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    width: "100%",
    backgroundColor: Colors.navyMain,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "92%",
    borderTopWidth: 1,
    borderTopColor: Colors.navyBorder,
    overflow: "hidden",
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
