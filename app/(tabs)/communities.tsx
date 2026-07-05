import Colors from "@/constants/Colors";
import { FontAwesome6 } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
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
import { communities } from "../../utils/communities";
import { useAuth } from "../../contexts/AuthContext";
import { useAppTheme } from "../../contexts/ThemeContext";
import { loginRoute } from "../../utils/authRedirect";

type JoinedCommunity = {
  id: string;
  name: string;
  initials: string;
  color: string[];
};

type CommunityStats = {
  members: number;
  activeNow: number;
};

const formatCount = (value: number) => {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(value);
};

const normalizeSearchText = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i");

export default function CommunitiesScreen() {
  const router = useRouter();
  const { user, isLoggedIn, isAuthReady } = useAuth();
  const { palette } = useAppTheme();
  const [searchText, setSearchText] = useState("");

  // Dinamik State'ler
  const [joinedClubs, setJoinedClubs] = useState<JoinedCommunity[]>([]);
  const [joinedIds, setJoinedIds] = useState<string[]>([]); // Yeni katıldıklarımızın ID'leri
  const [isJoiningId, setIsJoiningId] = useState<string | null>(null);
  const [communityStats, setCommunityStats] = useState<
    Record<string, CommunityStats>
  >({});

  // Modal State'leri
  const [welcomeModal, setWelcomeModal] = useState(false);
  const [activeClub, setActiveClub] = useState<
    (typeof communities)[0] | null
  >(null);
  const [showProfile, setShowProfile] = useState(true);
  const [useBadge, setUseBadge] = useState(true);
  const [notify, setNotify] = useState(true);

  const normalizedSearchText = useMemo(
    () => normalizeSearchText(searchText),
    [searchText],
  );

  const filteredCommunities = useMemo(() => {
    if (!normalizedSearchText) return communities;

    return communities.filter((community) =>
      normalizeSearchText(
        `${community.name} ${community.description} ${community.id}`,
      ).includes(normalizedSearchText),
    );
  }, [normalizedSearchText]);

  const filteredJoinedClubs = useMemo(() => {
    if (!normalizedSearchText) return joinedClubs;
    const matchingIds = new Set(
      filteredCommunities.map((community) => community.id),
    );
    return joinedClubs.filter((club) => matchingIds.has(club.id));
  }, [filteredCommunities, joinedClubs, normalizedSearchText]);

  const fetchMemberships = useCallback(
    async (shouldUpdate: () => boolean = () => true) => {
      if (!isAuthReady) return;

      if (!user?.id) {
        if (shouldUpdate()) {
          setJoinedClubs([]);
          setJoinedIds([]);
        }
        return;
      }

      const currentUserId = user.id;
      const { data, error } = await supabase
        .from("community_memberships")
        .select(
          "id,user_id,community_id,show_on_profile,use_vehicle_badge,notifications_enabled,created_at",
        )
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false });

      if (error) {
        const missingTable =
          error.message.includes("community_memberships") ||
          error.message.includes("schema cache");

        if (!missingTable) {
          console.error("Topluluk üyelikleri alınamadı:", error.message);
        }
        if (shouldUpdate()) {
          setJoinedClubs([]);
          setJoinedIds([]);
        }
        return;
      }

      if (!shouldUpdate()) return;

      const joined = (data || [])
        .map((membership: any) => {
          const club = communities.find(
            (item) => item.id === membership.community_id,
          );
          if (!club) return null;

          return {
            id: club.id,
            name: club.name,
            initials: club.name.substring(0, 2).toUpperCase(),
            color: [club.iconColor, club.iconColor],
          };
        })
        .filter(Boolean) as JoinedCommunity[];

      setJoinedClubs(joined);
      setJoinedIds(joined.map((club) => club.id));
    },
    [isAuthReady, user?.id],
  );

  const fetchCommunityStats = useCallback(
    async (shouldUpdate: () => boolean = () => true) => {
      const communityIds = communities.map((community) => community.id);
      const memberEntries = await Promise.all(
        communityIds.map(async (communityId) => {
          const { data, error } = await supabase.rpc(
            "get_community_member_count",
            { p_community_id: communityId },
          );

          if (error) {
            console.error(
              "Topluluk üye sayısı alınamadı:",
              communityId,
              error.message,
            );
            return [communityId, 0] as const;
          }

          return [communityId, Number(data || 0)] as const;
        }),
      );

      const since = new Date();
      since.setDate(since.getDate() - 7);

      const { data: recentPosts, error: activeError } = await supabase
        .from("posts")
        .select("community_id,user_id")
        .in("community_id", communityIds)
        .gte("created_at", since.toISOString());

      if (activeError) {
        console.error("Topluluk aktif sayısı alınamadı:", activeError.message);
      }

      const activeUsersByCommunity = (recentPosts || []).reduce(
        (acc: Record<string, Set<string>>, post: any) => {
          if (!post.community_id || !post.user_id) return acc;
          if (!acc[post.community_id]) acc[post.community_id] = new Set();
          acc[post.community_id].add(post.user_id);
          return acc;
        },
        {},
      );

      const nextStats = memberEntries.reduce(
        (acc: Record<string, CommunityStats>, [communityId, members]) => {
          acc[communityId] = {
            members,
            activeNow: activeUsersByCommunity[communityId]?.size || 0,
          };
          return acc;
        },
        {},
      );

      if (shouldUpdate()) {
        setCommunityStats(nextStats);
      }
    },
    [],
  );

  useEffect(() => {
    let isMounted = true;

    fetchMemberships(() => isMounted);
    fetchCommunityStats(() => isMounted);

    return () => {
      isMounted = false;
    };
  }, [fetchCommunityStats, fetchMemberships]);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      fetchMemberships(() => isMounted);
      fetchCommunityStats(() => isMounted);

      return () => {
        isMounted = false;
      };
    }, [fetchCommunityStats, fetchMemberships]),
  );

  const persistMembershipSettings = async (
    clubId: string,
    settings: {
      show_on_profile?: boolean;
      use_vehicle_badge?: boolean;
      notifications_enabled?: boolean;
    },
  ) => {
    if (!user?.id) return;

    const { error } = await supabase.from("community_memberships").upsert(
      {
        user_id: user.id,
        community_id: clubId,
        show_on_profile: showProfile,
        use_vehicle_badge: useBadge,
        notifications_enabled: notify,
        ...settings,
      },
      { onConflict: "user_id,community_id" },
    );

    if (error) {
      Alert.alert("Hata", "Topluluk ayarı kaydedilemedi: " + error.message);
    }
  };

  const handleJoin = async (club: (typeof communities)[0]) => {
    if (!isLoggedIn || !user?.id) {
      router.push(loginRoute("/communities") as any);
      return;
    }

    // Zaten katıldıysa işlem yapma (veya çıkış işlemi yapılabilir)
    if (joinedIds.includes(club.id) || isJoiningId === club.id) return;

    setIsJoiningId(club.id);
    try {
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user.id,
        display_name: user.name,
        full_name: user.name,
        avatar_url: user.avatar || null,
      });

      if (profileError) {
        Alert.alert("Hata", "Profil kaydı hazırlanamadı: " + profileError.message);
        return;
      }

      const { error } = await supabase.from("community_memberships").upsert(
        {
          user_id: user.id,
          community_id: club.id,
          show_on_profile: true,
          use_vehicle_badge: true,
          notifications_enabled: true,
        },
        { onConflict: "user_id,community_id" },
      );

      if (error) {
        Alert.alert(
          "Hata",
          "Topluluğa katılım kaydedilemedi: " + error.message,
        );
        return;
      }
    } finally {
      setIsJoiningId(null);
    }

    // 2. State Güncellemeleri (Mikro-etkileşim)
    setJoinedIds((prev) => (prev.includes(club.id) ? prev : [...prev, club.id]));

    const newJoined = {
      id: club.id,
      name: club.name,
      initials: club.name.substring(0, 2).toUpperCase(),
      color: [club.iconColor, club.iconColor],
    };

    // Yeni kulübü şeridin en başına ekliyoruz
    setJoinedClubs((prev) => [
      newJoined,
      ...prev.filter((item) => item.id !== club.id),
    ]);
    setCommunityStats((prev) => ({
      ...prev,
      [club.id]: {
        members: (prev[club.id]?.members || 0) + 1,
        activeNow: prev[club.id]?.activeNow || 0,
      },
    }));

    // 3. Hoş Geldin Modalını Aç
    setActiveClub(club);
    setShowProfile(true);
    setUseBadge(true);
    setNotify(true);
    setWelcomeModal(true);
  };

  const updateShowProfile = (value: boolean) => {
    setShowProfile(value);
    if (activeClub) {
      persistMembershipSettings(activeClub.id, { show_on_profile: value });
    }
  };

  const updateUseBadge = (value: boolean) => {
    setUseBadge(value);
    if (activeClub) {
      persistMembershipSettings(activeClub.id, { use_vehicle_badge: value });
    }
  };

  const updateNotify = (value: boolean) => {
    setNotify(value);
    if (activeClub) {
      persistMembershipSettings(activeClub.id, {
        notifications_enabled: value,
      });
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: palette.background }]}
      edges={["top"]}
    >
      {/* Sabit Başlık ve Arama Alanı */}
      <View
        style={[
          styles.headerContainer,
          {
            backgroundColor: palette.background,
            borderBottomColor: palette.border,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: palette.text }]}>
          Topluluklar
        </Text>

        <View
          style={[
            styles.searchBar,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <FontAwesome6
            name="magnifying-glass"
            size={16}
            color={palette.muted}
            style={styles.searchIcon}
          />
          <TextInput
            style={[styles.searchInput, { color: palette.text }]}
            placeholder="Kulüp veya konu ara (Örn: Araç önerisi)"
            placeholderTextColor={palette.muted}
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Topluluk aramasını temizle"
              onPress={() => setSearchText("")}
              style={styles.clearSearchBtn}
              hitSlop={8}
            >
              <FontAwesome6 name="xmark" size={14} color={palette.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Üye Olduğun Kulüpler (Yatay Kaydırma) */}
        <View
          style={[styles.sectionContainer, { borderBottomColor: palette.border }]}
        >
          <Text style={[styles.sectionTitle, { color: palette.muted }]}>
            HIZLI ERİŞİM
          </Text>
          <Text style={[styles.sectionHint, { color: palette.muted }]}>
            Katıldığın kulüpler burada sabitlenir.
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          >
            {/* Dinamik Üye Olunanlar Listesi */}
            {filteredJoinedClubs.length > 0 ? filteredJoinedClubs.map((club) => (
              <TouchableOpacity
                key={club.id}
                style={styles.joinedClubItem}
                onPress={() => router.push(`/community/${club.id}`)} // Şak diye yeni klasöre fırlatıyoruz!
              >
                <View
                  style={[
                    styles.joinedClubAvatarContainer,
                    { backgroundColor: club.color[0] },
                  ]}
                >
                  <View
                    style={[
                      styles.joinedClubAvatarInner,
                      { backgroundColor: palette.card },
                    ]}
                  >
                    <Text
                      style={[
                        styles.joinedClubAvatarText,
                        { color: palette.text },
                      ]}
                    >
                      {club.initials}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.joinedClubName, { color: palette.text }]}>
                  {club.name}
                </Text>
              </TouchableOpacity>
            )) : (
              <View
                style={[
                  styles.emptyJoinedBox,
                  { backgroundColor: palette.card, borderColor: palette.border },
                ]}
              >
                <Text style={[styles.emptyJoinedText, { color: palette.muted }]}>
                  {normalizedSearchText
                    ? "Katıldığın kulüplerde eşleşme bulunamadı."
                    : "Henüz bir kulübe katılmadın."}
                </Text>
              </View>
            )}
          </ScrollView>
        </View>

        {/* Popüler Kulüpler (Dikey Liste) */}
        <View
          style={[styles.sectionContainer, { borderBottomColor: palette.border }]}
        >
          <Text
            style={[
              styles.sectionTitle,
              {
                color: palette.text,
                textTransform: "none",
                fontSize: 18,
                fontWeight: "700",
              },
            ]}
          >
            {normalizedSearchText ? "Arama Sonuçları" : "Popüler Kulüpler"}
          </Text>

          <View style={styles.popularList}>
            {filteredCommunities.map((club) => {
              // club nesnesi tanımsızsa bu kartı render etme
              if (!club) return null;

              const isJoined = joinedIds.includes(club.id);
              const stats = communityStats[club.id] || {
                members: 0,
                activeNow: 0,
              };

              return (
                <TouchableOpacity
                  key={club.id}
                  style={[
                    styles.popularCard,
                    {
                      backgroundColor: palette.card,
                      borderColor: palette.border,
                    },
                    isJoined && { borderColor: Colors.orange + "40" },
                  ]}
                  onPress={() =>
                    isJoined
                      ? router.push(`/community/${club.id}`) // Şak diye yeni klasöre yönlendiriyoruz!
                      : handleJoin(club)
                  }
                >
                  <View
                    style={[
                      styles.popularIconContainer,
                      { backgroundColor: club.iconBg },
                    ]}
                  >
                    <FontAwesome6
                      name={(club?.icon as any) || "users"}
                      size={20}
                      color={club?.iconColor || Colors.textMuted}
                    />
                  </View>

                  <View style={styles.popularContent}>
                    <Text style={[styles.popularName, { color: palette.text }]}>
                      {club?.name}
                    </Text>
                    <Text
                      style={[styles.popularDesc, { color: palette.muted }]}
                      numberOfLines={1}
                    >
                      {club?.description}
                    </Text>
                    <Text style={[styles.popularStats, { color: palette.muted }]}>
                      {formatCount(stats.members)} Üye •{" "}
                      {formatCount(stats.activeNow)} Aktif
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.joinBtn, isJoined && styles.joinedBtn]}
                    onPress={() => !isJoined && handleJoin(club)}
                    disabled={isJoiningId === club.id}
                    activeOpacity={0.7}
                  >
                    {isJoined && (
                      <FontAwesome6
                        name="check"
                        size={11}
                        color={palette.muted}
                        style={{ marginRight: 4 }}
                      />
                    )}
                    <Text
                      style={[
                        styles.joinBtnText,
                        isJoined && { color: palette.muted },
                      ]}
                    >
                      {isJoined ? "Katıldın" : "Katıl"}
                    </Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
            {filteredCommunities.length === 0 && (
              <View
                style={[
                  styles.emptySearchBox,
                  { backgroundColor: palette.card, borderColor: palette.border },
                ]}
              >
                <FontAwesome6
                  name="magnifying-glass"
                  size={20}
                  color={palette.muted}
                />
                <Text style={[styles.emptySearchTitle, { color: palette.text }]}>
                  Topluluk bulunamadı
                </Text>
                <Text style={[styles.emptySearchText, { color: palette.muted }]}>
                  Farklı bir kulüp adı veya konu deneyin.
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* HOŞ GELDİN MODALI */}
      <Modal visible={welcomeModal} animationType="slide" transparent>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setWelcomeModal(false)}
        />
        <View
          style={[
            styles.modalSheet,
            { backgroundColor: palette.background, borderTopColor: palette.border },
          ]}
        >
          <View
            style={[styles.modalHandle, { backgroundColor: palette.border }]}
          />

          {activeClub && (
            <>
              <View style={styles.modalHeader}>
                <View
                  style={[
                    styles.modalIconBox,
                    { backgroundColor: activeClub.iconBg },
                  ]}
                >
                  <FontAwesome6
                    name={activeClub.icon as any}
                    size={28}
                    color={activeClub.iconColor}
                  />
                </View>
                <Text style={[styles.modalTitle, { color: palette.text }]}>
                  c/{activeClub.name}
                </Text>
                <Text style={[styles.modalSubtitle, { color: palette.muted }]}>
                  topluluğuna hoş geldin!
                </Text>
              </View>

              <View style={styles.modalRules}>
                <Text style={styles.modalSectionTitle}>
                  📌 Topluluk Kuralları
                </Text>
                <View style={styles.ruleItem}>
                    <Text style={[styles.ruleText, { color: palette.softText }]}>
                      • Saygılı ve yapıcı ol.
                    </Text>
                  </View>
                  <View style={styles.ruleItem}>
                  <Text style={[styles.ruleText, { color: palette.softText }]}>
                    • Sadece otomobil odaklı paylaşımlar yap.
                  </Text>
                </View>
                <View style={styles.ruleItem}>
                  <Text style={[styles.ruleText, { color: palette.softText }]}>
                    • Soru sormaktan ve bilgi paylaşmaktan çekinme.
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.modalSettings,
                  { backgroundColor: palette.card, borderColor: palette.border },
                ]}
              >
                <View style={styles.modalRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={[styles.modalRowTitle, { color: palette.text }]}>
                      Profilinde Göster
                    </Text>
                    <Text style={[styles.modalRowDesc, { color: palette.muted }]}>
                      Bu topluluğu profilimde favori olarak göster.
                    </Text>
                  </View>
                  <Switch
                    value={showProfile}
                    onValueChange={updateShowProfile}
                    trackColor={{
                      false: palette.border,
                      true: Colors.orange,
                    }}
                    thumbColor={Colors.white}
                  />
                </View>

                <View
                  style={[styles.modalDivider, { backgroundColor: palette.border }]}
                />

                <View style={styles.modalRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={[styles.modalRowTitle, { color: palette.text }]}>
                      Araç Rozeti
                    </Text>
                    <Text style={[styles.modalRowDesc, { color: palette.muted }]}>
                      Paylaşımlarında '2020 VW Golf' rozetini kullanmak ister
                      misin?
                    </Text>
                  </View>
                  <Switch
                    value={useBadge}
                    onValueChange={updateUseBadge}
                    trackColor={{
                      false: palette.border,
                      true: Colors.orange,
                    }}
                    thumbColor={Colors.white}
                  />
                </View>

                <View
                  style={[styles.modalDivider, { backgroundColor: palette.border }]}
                />

                <View style={styles.modalRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={[styles.modalRowTitle, { color: palette.text }]}>
                      Bildirimleri Aç
                    </Text>
                    <Text style={[styles.modalRowDesc, { color: palette.muted }]}>
                      Bu topluluktaki popüler tartışmalardan anında haberdar ol.
                    </Text>
                  </View>
                  <Switch
                    value={notify}
                    onValueChange={updateNotify}
                    trackColor={{
                      false: palette.border,
                      true: Colors.orange,
                    }}
                    thumbColor={Colors.white}
                  />
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalBtnPrimary}
                  onPress={() => {
                    setWelcomeModal(false);
                    router.push(`/community/${activeClub.id}`); // Yeni topluluk akış sayfamız!
                  }}
                >
                  <Text style={styles.modalBtnPrimaryText}>Akışa Göz At</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.navyMain || "#0B132B",
  },
  headerContainer: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.navyBorder || "#1C2541",
    backgroundColor: Colors.navyMain || "#0B132B",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.white || "#fff",
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.navyCard || "#1C2541",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.navyBorder || "#334155",
    paddingHorizontal: 12,
    height: 48,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: Colors.white || "#fff",
    fontSize: 14,
  },
  clearSearchBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionContainer: {
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: Colors.navyBorder || "#1C2541",
  },
  sectionTitle: {
    paddingHorizontal: 20,
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textMuted || "#94A3B8",
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  sectionHint: {
    paddingHorizontal: 20,
    color: Colors.textMuted || "#94A3B8",
    fontSize: 12,
    marginTop: -10,
    marginBottom: 14,
  },
  horizontalList: {
    paddingHorizontal: 20,
    gap: 20,
  },
  emptyJoinedBox: {
    minWidth: 180,
    height: 64,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    backgroundColor: Colors.navyCard,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  emptyJoinedText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  joinedClubItem: {
    alignItems: "center",
    width: 64,
  },
  joinedClubAvatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 2, // Dışındaki renkli çemberin kalınlığı
    marginBottom: 8,
  },
  joinedClubAvatarInner: {
    flex: 1,
    backgroundColor: Colors.navyCard || "#1C2541",
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  joinedClubAvatarText: {
    color: Colors.white || "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  joinedClubName: {
    color: Colors.white || "#fff",
    fontSize: 11,
    fontWeight: "500",
    textAlign: "center",
  },
  popularList: {
    paddingHorizontal: 20,
    gap: 16,
  },
  emptySearchBox: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  emptySearchTitle: {
    fontSize: 15,
    fontWeight: "800",
    marginTop: 10,
  },
  emptySearchText: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    textAlign: "center",
  },
  popularCard: {
    backgroundColor: Colors.navyCard || "#1C2541",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.navyBorder || "#334155",
  },
  popularIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  popularIconText: {
    fontSize: 20,
    fontWeight: "bold",
  },
  popularContent: {
    flex: 1,
  },
  popularName: {
    color: Colors.white || "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 2,
  },
  popularDesc: {
    color: Colors.textMuted || "#94A3B8",
    fontSize: 12,
    marginBottom: 4,
  },
  popularStats: {
    color: Colors.textMuted || "#94A3B8",
    fontSize: 10,
  },
  joinBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 101, 0, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  joinBtnText: {
    color: Colors.orange || "#FF6500",
    fontSize: 12,
    fontWeight: "bold",
  },
  joinedBtn: {
    backgroundColor: "transparent",
    borderColor: Colors.navyBorder,
  },
  joinedBtnText: {
    color: Colors.textMuted,
  },

  // Modal Stilleri
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)" },
  modalSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.navyMain,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: Colors.navyBorder,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.navyBorder,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
    marginTop: -10,
  },
  modalHeader: { alignItems: "center", marginBottom: 24 },
  modalIconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    transform: [{ rotate: "-5deg" }],
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: Colors.white,
    marginBottom: 4,
  },
  modalSubtitle: { fontSize: 14, color: Colors.textMuted },

  modalRules: {
    backgroundColor: "rgba(255,101,0,0.05)",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,101,0,0.15)",
    marginBottom: 20,
  },
  modalSectionTitle: {
    color: Colors.orange,
    fontWeight: "800",
    fontSize: 13,
    marginBottom: 8,
  },
  ruleItem: { marginBottom: 6 },
  ruleText: { color: Colors.gray300, fontSize: 13, lineHeight: 18 },

  modalSettings: {
    backgroundColor: Colors.navyCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  modalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
  },
  modalRowTitle: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  modalRowDesc: { color: Colors.textMuted, fontSize: 11, lineHeight: 16 },
  modalDivider: { height: 1, backgroundColor: Colors.navyBorder },

  modalActions: { flexDirection: "row", gap: 12 },
  modalBtnSecondary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.navyMain,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnSecondaryText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: "700",
  },
  modalBtnPrimary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.orange,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 8px rgba(249, 115, 22, 0.3)",
    elevation: 4,
  },
  modalBtnPrimaryText: { color: Colors.white, fontSize: 14, fontWeight: "800" },
});
