import Colors from "@/constants/Colors";
import { FontAwesome6 } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AddReviewModal } from "../../components/AddReviewModal";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { useReviews } from "../../contexts/ReviewContext";
import { ThemePreference, useAppTheme } from "../../contexts/ThemeContext";
import { getCommunityById } from "../../utils/communities";

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
      await supabase.auth.signOut();
      router.replace("/");
    } catch (error: any) {
      console.error("Çıkış hatası:", error);
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
