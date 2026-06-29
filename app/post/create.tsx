import Colors from "@/constants/Colors";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useAuth } from "../../contexts/AuthContext";
import { uploadPublicFiles } from "../../utils/storageUpload";
import { useAppTheme } from "../../contexts/ThemeContext";
import { communities } from "../../utils/communities";
import { validateCleanContent } from "../../utils/contentModeration";
import VehicleCatalogPicker from "../../components/VehicleCatalogPicker";
import { VehicleCatalogSelection } from "../../utils/vehicleCatalog";
import { loginRoute, withSearchParams } from "../../utils/authRedirect";
import PhotoCarousel from "../../components/PhotoCarousel";

const TAGS = ["🔧 Kronik Sorun", "💰 Maliyet", "📍 Tavsiye", "📸 İnceleme"];

export default function CreatePostScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { palette } = useAppTheme();
  const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const initialModelId = Array.isArray(params.modelId)
    ? params.modelId[0]
    : params.modelId;
  const initialCarName = Array.isArray(params.carName)
    ? params.carName[0]
    : params.carName;
  const isVehicleQuestion = mode === "vehicle-question";
  const initialCommunityId = Array.isArray(params.communityId)
    ? params.communityId[0]
    : params.communityId;
  const isCommunityPost = Boolean(initialCommunityId) && !isVehicleQuestion;
  const createReturnTo = withSearchParams("/post/create", {
    mode,
    modelId: initialModelId,
    carName: initialCarName,
    communityId: initialCommunityId,
  });

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedCommunity, setSelectedCommunity] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // Marka ve Model State'leri
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [brandList, setBrandList] = useState<
    { label: string; value: string }[]
  >([]);
  const [modelList, setModelList] = useState<
    { label: string; value: string }[]
  >([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isBrandDropdownVisible, setIsBrandDropdownVisible] = useState(false);
  const [isModelDropdownVisible, setIsModelDropdownVisible] = useState(false);
  const [catalogPickerVisible, setCatalogPickerVisible] = useState(false);
  const [selectedVehicleTrim, setSelectedVehicleTrim] = useState("");

  // Markaları Çek
  useEffect(() => {
    const fetchBrands = async () => {
      const { data } = await supabase
        .from("brands")
        .select("id, name")
        .order("name", { ascending: true });
      if (data) {
        setBrandList(
          data.map((b: any) => ({
            label: b.name || b.brand_name || "Bilinmiyor",
            value: b.id,
          })),
        );
      }
    };
    fetchBrands();
  }, []);

  // Seçili Markaya Göre Modelleri Çek
  useEffect(() => {
    const fetchModels = async () => {
      if (!selectedBrandId) {
        setModelList([]);
        setSelectedModelId(null);
        return;
      }
      setIsLoadingModels(true);
      try {
        const { data, error } = await supabase
          .from("models")
          .select("id, name")
          .eq("brand_id", selectedBrandId)
          .order("name", { ascending: true });

        if (data) {
          setModelList(
            data.map((item: any) => ({
              label: item.name || item.model_name || "Bilinmiyor",
              value: item.id,
            })),
          );
        }
      } catch (err) {
        console.error("Beklenmeyen hata:", err);
      } finally {
        setIsLoadingModels(false);
      }
    };
    fetchModels();
  }, [selectedBrandId]);

  // Eğer topluluk içinden gelindiyse topluluğu seç; araç sorusunda topluluk opsiyoneldir.
  useEffect(() => {
    const communityId = Array.isArray(params.communityId)
      ? params.communityId[0]
      : params.communityId;

    if (communityId && communities.some((community) => community.id === communityId)) {
      setSelectedCommunity(communityId);
    } else if (!isVehicleQuestion) {
      setSelectedCommunity(communities[0]?.id || null);
    } else {
      setSelectedCommunity(null);
    }
  }, [isVehicleQuestion, params.communityId]);

  useEffect(() => {
    if (!initialModelId) return;

    const fetchInitialVehicle = async () => {
      const { data, error } = await supabase
        .from("models")
        .select("id, name, brand_id, brands(id, name)")
        .eq("id", initialModelId)
        .maybeSingle();

      if (error || !data) return;

      const brandId = data.brand_id || (data.brands as any)?.id;
      if (brandId) setSelectedBrandId(brandId);
      setSelectedModelId(data.id);
    };

    fetchInitialVehicle();
  }, [initialModelId]);

  const missingCommunity = !isVehicleQuestion && !selectedCommunity;
  const missingBrand = !isCommunityPost && !selectedBrandId;
  const hasModelOptions = modelList.length > 0;
  const missingModel = !isCommunityPost && hasModelOptions && !selectedModelId;
  const canPublishWithoutModel =
    Boolean(selectedBrandId) && !isLoadingModels && !hasModelOptions;
  const missingTitle = !isCommunityPost && !title.trim();
  const missingContent = !content.trim();
  const hasValidationError =
    missingCommunity ||
    missingBrand ||
    missingModel ||
    missingTitle ||
    missingContent;

  const handleImagePick = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) return;

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

  const handleCameraPick = async () => {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) {
      Alert.alert("Hata", "Kamera izni reddedildi.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled) {
      setImages((prev) => [...prev, result.assets[0].uri].slice(0, 5));
    }
  };

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags((prev) => prev.filter((t) => t !== tag));
    } else {
      setSelectedTags((prev) => [...prev, tag]);
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

  // ─── 1. VERİTABANI INSERT ZIRHI & OTURUM KONTROLÜ ───
  const handlePublish = async () => {
    setSubmitAttempted(true);
    if (isPublishing) return;
    if (hasValidationError) return;

    const moderation = validateCleanContent(
      isCommunityPost
        ? [{ label: "Gönderi", value: content }]
        : [
            { label: "Başlık", value: title },
            { label: "Gönderi", value: content },
          ],
    );

    if (!moderation.ok) {
      Alert.alert("Uygunsuz içerik", moderation.message);
      return;
    }

    setIsPublishing(true);

    try {
      // 2. Oturum Kontrolü: Supabase'den dinamik oturum alıyoruz
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session || !session.user?.id) {
        router.push(loginRoute(createReturnTo) as any);
        return;
      }

      const userId = session.user.id;
      const userName =
        user?.name ||
        session.user.user_metadata?.display_name ||
        session.user.email?.split("@")[0] ||
        "Anonim Üye";
      const userAvatar =
        user?.avatar ||
        session.user.user_metadata?.avatar_url ||
        "";

      // Opsiyonel olarak seçildiyse Marka/Model metinlerini birleştir
      const brandName = selectedBrandId
        ? brandList.find((b) => b.value === selectedBrandId)?.label
        : "";
      const modelName = selectedModelId
        ? modelList.find((m) => m.value === selectedModelId)?.label
        : "";
      const carName =
        brandName && modelName
          ? [brandName, modelName, selectedVehicleTrim]
              .filter(Boolean)
              .join(" · ")
          : brandName || initialCarName || null;
      const uploadedImages = await uploadPublicFiles(images, userId, "posts");
      const generatedCommunityTitle =
        content.trim().replace(/\s+/g, " ").slice(0, 80) || "Topluluk paylaşımı";

      // ─── KRİTİK DÜZELTME: FK (posts_user_id_fkey) Hatasını Önleme ───
      // Eğer kullanıcının 'profiles' tablosunda kaydı yoksa (eski kayıt vb.),
      // post eklerken hata vermemesi için profili garanti altına alıyoruz.
      if (userId) {
        await supabase.from("profiles").upsert({
          id: userId,
          display_name: userName,
        });
      }

      const postPayload: any = {
        title: isCommunityPost ? generatedCommunityTitle : title.trim(),
        content: content.trim(),
        community_id: selectedCommunity || null,
        user_id: userId,
        user: userName,
        avatar: userAvatar,
        brand_id: selectedBrandId || null,
        model_id: selectedModelId || null,
        car: carName,
        images: uploadedImages,
        ...(selectedTags.length > 0 ? { topic_tags: selectedTags } : {}),
        upvotes: 0,
        comments: 0,
      };

      const { error } = await supabase.from("posts").insert(postPayload);

      if (error) throw error;

      // 4. Modal Kapanma ve Temizlik
      setTitle("");
      setContent("");
      setSelectedBrandId(null);
      setSelectedModelId(null);
      setSelectedVehicleTrim("");
      setImages([]);
      setSelectedTags([]);
      setSubmitAttempted(false);

      // 3. Otomatik Akış Yenileme: Realtime listener bu insert'i yakalayacak!
      router.back();
    } catch (error: any) {
      // 5. Konsol Hata Takibi
      console.error("Topluluk gönderi paylaşma hatası:", error.message);
      const isMissingTopicTags =
        error?.message?.includes("topic_tags") &&
        error?.message?.includes("schema cache");

      Alert.alert(
        isMissingTopicTags ? "Paylaşım şu anda kullanılamıyor" : "Hata",
        isMissingTopicTags
          ? "Gönderin şu anda kaydedilemiyor. Lütfen daha sonra tekrar dene."
          : "Gönderi paylaşılamadı: " + error.message,
      );
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: palette.background }]}
      edges={["top"]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      {/* ─── Üst Menü ─── */}
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerBtn}
        >
          <FontAwesome6 name="xmark" size={20} color={palette.text} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: palette.text }]}>
          {isVehicleQuestion
            ? "Araç Sorusu"
            : isCommunityPost
              ? "Toplulukta Paylaş"
              : "Yeni Gönderi"}
        </Text>

        <TouchableOpacity
          style={[
            styles.publishBtn,
            {
              backgroundColor: Colors.orange,
              borderColor: Colors.orange,
              opacity: isPublishing ? 0.65 : 1,
            },
          ]}
          disabled={isPublishing}
          onPress={handlePublish}
        >
          {isPublishing ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Text
              style={[
                styles.publishBtnText,
                { color: Colors.white },
                styles.publishBtnTextActive,
              ]}
            >
              Paylaş
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: palette.background }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        {/* ─── Kompakt Seçiciler (Native Tags) ─── */}
        {!isCommunityPost ? (
        <View style={styles.selectorsWrapper}>
          {isVehicleQuestion && initialCarName ? (
            <View
              style={[
                styles.vehicleQuestionBanner,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
            >
              <FontAwesome6 name="car-side" size={14} color={Colors.orange} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.vehicleQuestionTitle, { color: palette.text }]}>
                  {initialCarName}
                </Text>
                <Text style={[styles.vehicleQuestionText, { color: palette.muted }]}>
                  Sorun bu araca bağlı paylaşılacak. Topluluk seçimi isteğe bağlı.
                </Text>
              </View>
            </View>
          ) : null}
          <Text style={[styles.selectorLabel, { color: palette.muted }]}>
            {isVehicleQuestion
              ? "Toplulukta da paylaşmak istersen seç"
              : "Topluluk seç"}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {isVehicleQuestion && (
              <TouchableOpacity
                style={[
                  styles.chip,
                  { backgroundColor: palette.card, borderColor: palette.border },
                  !selectedCommunity && styles.chipActive,
                ]}
                onPress={() => setSelectedCommunity(null)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: palette.softText },
                    !selectedCommunity && styles.chipTextActive,
                  ]}
                >
                  Sadece araç sorusu
                </Text>
                {!selectedCommunity && (
                  <FontAwesome6
                    name="check"
                    size={10}
                    color={Colors.white}
                    style={{ marginLeft: 6 }}
                  />
                )}
              </TouchableOpacity>
            )}
            {communities.map((c) => (
              <TouchableOpacity
                key={c.id}
                  style={[
                    styles.chip,
                    { backgroundColor: palette.card, borderColor: palette.border },
                    submitAttempted &&
                      missingCommunity && { borderColor: "#ef4444" },
                    selectedCommunity === c.id && styles.chipActive,
                  ]}
                onPress={() => setSelectedCommunity(c.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: palette.softText },
                    selectedCommunity === c.id && styles.chipTextActive,
                  ]}
                >
                  c/ {c.name}
                </Text>
                {selectedCommunity === c.id && (
                  <FontAwesome6
                    name="check"
                    size={10}
                    color={Colors.white}
                    style={{ marginLeft: 6 }}
                  />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* ── Çok Kademeli Araç Seçici ── */}
          <View>
            <TouchableOpacity
              style={[
                styles.dropdownBtn,
                { backgroundColor: palette.card, borderColor: palette.border },
                submitAttempted && missingBrand && styles.fieldErrorBorder,
              ]}
              onPress={() => setCatalogPickerVisible(true)}
            >
              <Text
                style={
                  selectedBrandId && selectedModelId
                    ? [styles.dropdownTextActive, { color: palette.text }]
                    : [styles.dropdownText, { color: palette.muted }]
                }
                numberOfLines={2}
              >
                {selectedBrandId && selectedModelId
                  ? [
                      brandList.find((b) => b.value === selectedBrandId)?.label,
                      modelList.find((m) => m.value === selectedModelId)?.label,
                      selectedVehicleTrim,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : "Marka, model, motor ve donanım seç"}
              </Text>
              <FontAwesome6
                name="chevron-right"
                size={12}
                color={palette.muted}
              />
            </TouchableOpacity>
          </View>
          {canPublishWithoutModel && (
            <View
              style={[
                styles.inlineInfoBox,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
            >
              <FontAwesome6 name="circle-info" size={12} color={Colors.orange} />
              <Text style={[styles.inlineInfoText, { color: palette.muted }]}>
                Bu marka için model listesi henüz yok. Gönderiyi marka geneli
                olarak paylaşabilirsin.
              </Text>
            </View>
          )}
          {submitAttempted &&
            (missingCommunity || missingBrand || missingModel) && (
              <View style={styles.validationBox}>
                <FontAwesome6
                  name="circle-exclamation"
                  size={12}
                  color="#ef4444"
                />
                <Text style={styles.validationText}>
                  {isVehicleQuestion
                    ? hasModelOptions
                      ? "Marka ve model seçimi zorunludur."
                      : "Marka seçimi zorunludur."
                    : hasModelOptions
                      ? "Topluluk, marka ve model seçimi zorunludur."
                      : "Topluluk ve marka seçimi zorunludur."}
                </Text>
              </View>
            )}
        </View>
        ) : (
          <View
            style={[
              styles.communityComposeBanner,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <FontAwesome6 name="users" size={14} color={Colors.orange} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.communityComposeTitle, { color: palette.text }]}>
                {communities.find((item) => item.id === selectedCommunity)?.name ||
                  "Topluluk"}
              </Text>
              <Text style={[styles.communityComposeText, { color: palette.muted }]}>
                Sorunu, fikrini veya deneyimini doğal şekilde yaz.
              </Text>
            </View>
          </View>
        )}

        {/* ─── Sınırsız Editör Alanı (Native Compose) ─── */}
        <ScrollView
          style={styles.editorScroll}
          contentContainerStyle={styles.editorContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={[
              styles.composeCard,
              {
                backgroundColor: palette.card,
                borderColor:
                  submitAttempted && (missingTitle || missingContent)
                    ? "#ef4444"
                    : palette.border,
              },
            ]}
          >
            <View style={styles.inputHeaderRow}>
              <FontAwesome6 name="pen-nib" size={13} color={Colors.orange} />
              <Text style={[styles.inputLabel, { color: palette.softText }]}>
                {isCommunityPost ? "Ne paylaşmak istiyorsun?" : "Gönderi"}{" "}
                <Text style={styles.requiredMark}>*</Text>
              </Text>
            </View>

            {!isCommunityPost && (
              <>
            <Text style={[styles.fieldLabel, { color: palette.muted }]}>
              Başlık <Text style={styles.requiredMark}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.titleInput,
                { color: palette.text },
                submitAttempted && missingTitle && styles.textInputError,
              ]}
              placeholder="Başlık ekle"
              placeholderTextColor={palette.muted}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
              returnKeyType="next"
            />
            {submitAttempted && missingTitle && (
              <Text style={styles.fieldErrorText}>
                Başlık alanını doldurmanız gerekiyor.
              </Text>
            )}

            <View style={[styles.inputDivider, { backgroundColor: palette.border }]} />
              </>
            )}

            {!isCommunityPost && (
              <Text style={[styles.fieldLabel, { color: palette.muted }]}>
                Açıklama <Text style={styles.requiredMark}>*</Text>
              </Text>
            )}
            <TextInput
              style={[
                styles.contentInput,
                { color: palette.text },
                submitAttempted && missingContent && styles.textInputError,
              ]}
              placeholder={
                isCommunityPost
                  ? "Sorunu, fikrini veya deneyimini buraya yaz..."
                  : "Sorunu, deneyimini veya tavsiyeni yaz..."
              }
              placeholderTextColor={palette.muted}
              value={content}
              onChangeText={setContent}
              multiline
              textAlignVertical="top"
            />
            {submitAttempted && missingContent && (
              <Text style={styles.fieldErrorText}>
                {isCommunityPost
                  ? "Paylaşmak istediğin mesajı yaz."
                  : "Açıklama alanını doldurmanız gerekiyor."}
              </Text>
            )}
          </View>

          {!isCommunityPost && (
          <View
            style={[
              styles.topicCard,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <View style={styles.inputHeaderRow}>
              <FontAwesome6 name="tags" size={13} color={Colors.orange} />
              <Text style={[styles.inputLabel, { color: palette.softText }]}>
                Konu türü
              </Text>
            </View>
            <View style={styles.topicGrid}>
              {TAGS.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={[
                    styles.tagChip,
                    { backgroundColor: palette.elevated, borderColor: palette.border },
                    selectedTags.includes(tag) && styles.tagChipActive,
                  ]}
                  onPress={() => toggleTag(tag)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.tagChipText,
                      { color: palette.muted },
                      selectedTags.includes(tag) && styles.tagChipTextActive,
                    ]}
                  >
                    {tag}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          )}

          {/* ─── Seçilen Medya Önizlemesi ─── */}
          {images.length > 0 && (
            <PhotoCarousel
              images={images}
              height={240}
              style={styles.imagePreviewCarousel}
              onRemoveImage={(index) =>
                setImages(images.filter((_, i) => i !== index))
              }
            />
          )}
        </ScrollView>

        {/* ─── Alt Araç Çubuğu (Sticky Toolbar) ─── */}
        <View
          style={[
            styles.toolbar,
            { backgroundColor: palette.card, borderTopColor: palette.border },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.toolbarBtn,
              { backgroundColor: palette.elevated, borderColor: palette.border },
            ]}
            onPress={handleImagePick}
          >
            <FontAwesome6 name="image" size={20} color={palette.muted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toolbarBtn,
              { backgroundColor: palette.elevated, borderColor: palette.border },
            ]}
            onPress={handleCameraPick}
          >
            <FontAwesome6 name="camera" size={20} color={palette.muted} />
          </TouchableOpacity>
          <View style={styles.toolbarMeta}>
            <Text style={[styles.toolbarMetaText, { color: palette.muted }]}>
              {images.length > 0
                ? `${images.length}/5 fotoğraf eklendi`
                : "Fotoğraf ekle"}
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* ── Marka Seçici Dropdown (Modal) ── */}
      <Modal visible={isBrandDropdownVisible} animationType="slide" transparent>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setIsBrandDropdownVisible(false)}
        />
        <View
          style={[
            styles.modalSheet,
            { backgroundColor: palette.background, borderTopColor: palette.border },
          ]}
        >
          <View style={[styles.modalHandle, { backgroundColor: palette.border }]} />
          <View style={[styles.modalHeader, { borderBottomColor: palette.border }]}>
            <Text style={[styles.modalTitle, { color: palette.text }]}>
              Marka Seç
            </Text>
            <TouchableOpacity
              onPress={() => setIsBrandDropdownVisible(false)}
              style={styles.closeBtn}
            >
              <FontAwesome6 name="xmark" size={16} color={palette.muted} />
            </TouchableOpacity>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalScroll}
          >
            {brandList.map((brand) => (
              <TouchableOpacity
                key={brand.value}
                style={[
                  styles.modalListItem,
                  { borderBottomColor: palette.border },
                ]}
                onPress={() => {
                  setSelectedBrandId(brand.value);
                  setSelectedModelId(null); // Modeli sıfırla
                  setIsBrandDropdownVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.modalListText,
                    { color: palette.text },
                    selectedBrandId === brand.value &&
                      styles.modalListTextActive,
                  ]}
                >
                  {brand.label}
                </Text>
                {selectedBrandId === brand.value && (
                  <FontAwesome6 name="check" size={14} color={Colors.orange} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* ── Model Seçici Dropdown (Modal) ── */}
      <Modal visible={isModelDropdownVisible} animationType="slide" transparent>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setIsModelDropdownVisible(false)}
        />
        <View
          style={[
            styles.modalSheet,
            { backgroundColor: palette.background, borderTopColor: palette.border },
          ]}
        >
          <View style={[styles.modalHandle, { backgroundColor: palette.border }]} />
          <View style={[styles.modalHeader, { borderBottomColor: palette.border }]}>
            <Text style={[styles.modalTitle, { color: palette.text }]}>
              Model Seç
            </Text>
            <TouchableOpacity
              onPress={() => setIsModelDropdownVisible(false)}
              style={styles.closeBtn}
            >
              <FontAwesome6 name="xmark" size={16} color={palette.muted} />
            </TouchableOpacity>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalScroll}
          >
            {modelList.length === 0 ? (
              <Text style={[styles.emptyText, { color: palette.muted }]}>
                Bu markaya ait model bulunamadı.
              </Text>
            ) : (
              modelList.map((model) => (
                <TouchableOpacity
                  key={model.value}
                  style={[
                    styles.modalListItem,
                    { borderBottomColor: palette.border },
                  ]}
                  onPress={() => {
                    setSelectedModelId(model.value);
                    setIsModelDropdownVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalListText,
                      { color: palette.text },
                      selectedModelId === model.value &&
                        styles.modalListTextActive,
                    ]}
                  >
                    {model.label}
                  </Text>
                  {selectedModelId === model.value && (
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
        title={isVehicleQuestion ? "Soru aracını seç" : "Gönderi aracını seç"}
        onClose={() => setCatalogPickerVisible(false)}
        onSelect={handleCatalogSelection}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.navyMain },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.navyBorder,
  },
  headerBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: Colors.white },
  publishBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  publishBtnActive: { backgroundColor: Colors.orange },
  publishBtnText: { color: Colors.textMuted, fontSize: 13, fontWeight: "800" },
  publishBtnTextActive: { color: Colors.white },

  // Seçiciler
  selectorsWrapper: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.navyBorder,
  },
  communityComposeBanner: {
    marginHorizontal: 20,
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 14,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  communityComposeTitle: {
    fontSize: 13,
    fontWeight: "900",
  },
  communityComposeText: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  vehicleQuestionBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  vehicleQuestionTitle: {
    fontSize: 13,
    fontWeight: "900",
  },
  vehicleQuestionText: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  selectorLabel: {
    paddingHorizontal: 20,
    marginBottom: 8,
    fontSize: 11,
    fontWeight: "800",
  },
  chipRow: { paddingHorizontal: 20, gap: 8, marginBottom: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.navyCard,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  chipActive: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  chipText: { color: Colors.gray300, fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: Colors.white },

  // Dropdown Butonları (Yatay)
  dropdownRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 8,
  },
  dropdownBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.navyCard,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownText: { color: Colors.textMuted, fontSize: 13, fontWeight: "600" },
  dropdownTextActive: { color: Colors.white, fontSize: 13, fontWeight: "700" },
  disabledInput: { opacity: 1 },
  fieldErrorBorder: { borderColor: "#ef4444" },
  inlineInfoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginHorizontal: 20,
    marginTop: 2,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  inlineInfoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  validationBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginHorizontal: 20,
    marginTop: 2,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  validationText: {
    flex: 1,
    color: "#ef4444",
    fontSize: 12,
    fontWeight: "700",
  },

  // Modal Seçici Stilleri
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)" },
  modalSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.navyMain,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: "70%",
    borderTopWidth: 1,
    borderTopColor: Colors.navyBorder,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.navyBorder,
    alignSelf: "center",
    marginTop: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.navyBorder,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: Colors.white },
  closeBtn: { padding: 4 },
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

  // Sınırsız Editor (Native Feel)
  editorScroll: { flex: 1 },
  editorContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28 },
  composeCard: {
    backgroundColor: Colors.navyCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    padding: 14,
  },
  topicCard: {
    backgroundColor: Colors.navyCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    padding: 14,
    marginTop: 14,
  },
  inputHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  inputLabel: {
    color: Colors.gray300,
    fontSize: 12,
    fontWeight: "800",
  },
  requiredMark: { color: "#ef4444", fontWeight: "900" },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 4,
  },
  fieldErrorText: {
    color: "#ef4444",
    fontSize: 12,
    fontWeight: "700",
    marginTop: -2,
    marginBottom: 4,
  },
  textInputError: {
    borderLeftWidth: 3,
    borderLeftColor: "#ef4444",
    paddingLeft: 8,
  },
  inputDivider: {
    height: 1,
    backgroundColor: Colors.navyBorder,
    marginVertical: 10,
  },
  titleInput: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: "800",
    minHeight: 42,
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  contentInput: {
    color: Colors.white,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 170,
    paddingVertical: 4,
    paddingHorizontal: 0,
  },

  imagePreviewCarousel: { marginTop: 14, marginBottom: 20 },

  // Araç Çubuğu
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.navyCard,
    borderTopWidth: 1,
    borderTopColor: Colors.navyBorder,
    gap: 10,
  },
  toolbarBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.navyMain,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  toolbarMeta: { flex: 1, alignItems: "flex-end" },
  toolbarMetaText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  topicGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tagChip: {
    backgroundColor: Colors.navyMain,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  tagChipActive: {
    backgroundColor: "rgba(255, 101, 0, 0.15)",
    borderColor: Colors.orange,
  },
  tagChipText: { color: Colors.textMuted, fontSize: 12, fontWeight: "600" },
  tagChipTextActive: { color: Colors.orange },
});
