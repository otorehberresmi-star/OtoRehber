import Colors from "@/constants/Colors";
import { FontAwesome6 } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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
import { useAuth } from "../../contexts/AuthContext";
import { useAppTheme } from "../../contexts/ThemeContext";
import { supabase } from "../../supabaseClient";
import { loginRoute } from "../../utils/authRedirect";

type Tab = "reviews" | "posts" | "comments";

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toLocaleUpperCase("tr-TR") || "K";

export default function PublicUserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const { user } = useAuth();
  const { palette } = useAppTheme();
  const [profile, setProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<Tab>("reviews");
  const [reviews, setReviews] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  useEffect(() => {
    if (userId && user?.id === userId) router.replace("/profile");
  }, [router, user?.id, userId]);

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      if (!userId || user?.id === userId) return;
      setLoading(true);

      const { data: publicProfile, error } = await supabase
        .from("public_profiles")
        .select("id,display_name,full_name,avatar_url,created_at,is_private")
        .eq("id", userId)
        .maybeSingle();

      if (!active) return;
      if (error || !publicProfile) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setProfile(publicProfile);
      if (publicProfile.is_private) {
        setLoading(false);
        return;
      }

      const [followState, followersResult, followingResult] = await Promise.all([
        user?.id
          ? supabase
              .from("user_follows")
              .select("following_id")
              .eq("follower_id", user.id)
              .eq("following_id", userId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from("user_follows")
          .select("follower_id", { count: "exact", head: true })
          .eq("following_id", userId),
        supabase
          .from("user_follows")
          .select("following_id", { count: "exact", head: true })
          .eq("follower_id", userId),
      ]);
      if (active) {
        setIsFollowing(Boolean(followState.data));
        setFollowerCount(followersResult.count || 0);
        setFollowingCount(followingResult.count || 0);
      }

      const [reviewsResult, postsResult, commentsResult] = await Promise.all([
        supabase
          .from("reviews")
          .select("id,title,comment,car,rating,helpful_votes,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("posts")
          .select("id,title,content,car,community_id,upvotes,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("comments")
          .select("id,post_id,review_id,text,content,upvotes,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      if (!active) return;
      setReviews(reviewsResult.data || []);
      setPosts(postsResult.data || []);
      setComments(commentsResult.data || []);
      setLoading(false);
    };

    loadProfile();
    return () => {
      active = false;
    };
  }, [user?.id, userId]);

  const toggleFollow = async () => {
    if (!userId || isFollowLoading) return;
    if (!user?.id) {
      router.push(loginRoute(`/user/${userId}`) as any);
      return;
    }
    setIsFollowLoading(true);
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from("user_follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", userId);
        if (error) throw error;
        setIsFollowing(false);
        setFollowerCount((count) => Math.max(0, count - 1));
      } else {
        const { error } = await supabase.from("user_follows").insert({
          follower_id: user.id,
          following_id: userId,
        });
        if (error) throw error;
        setIsFollowing(true);
        setFollowerCount((count) => count + 1);
      }
    } catch (error: any) {
      const missingSchema =
        error?.message?.includes("user_follows") ||
        error?.message?.includes("schema cache");
      Alert.alert(
        missingSchema ? "Takip şu anda kullanılamıyor" : "Takip edilemedi",
        missingSchema
          ? "Takip işlemi şu anda tamamlanamıyor. Lütfen daha sonra tekrar dene."
          : error?.message || "Takip işlemi tamamlanamadı.",
      );
    } finally {
      setIsFollowLoading(false);
    }
  };

  const items =
    activeTab === "reviews"
      ? reviews
      : activeTab === "posts"
        ? posts
        : comments;

  const openItem = (item: any) => {
    if (activeTab === "reviews") {
      router.push(`/review/${item.id}` as any);
    } else if (activeTab === "posts") {
      router.push(`/post/${item.id}` as any);
    } else if (item.post_id) {
      router.push(`/post/${item.post_id}` as any);
    } else if (item.review_id) {
      router.push(`/review/${item.review_id}` as any);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[
        styles.contentCard,
        { backgroundColor: palette.card, borderColor: palette.border },
      ]}
      onPress={() => openItem(item)}
      activeOpacity={0.8}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.carText, { color: Colors.orange }]}>
          {item.car ||
            (activeTab === "comments" ? "Yaptığı yorum" : "Topluluk gönderisi")}
        </Text>
        <Text style={[styles.dateText, { color: palette.muted }]}>
          {item.created_at
            ? new Date(item.created_at).toLocaleDateString("tr-TR")
            : "Yeni"}
        </Text>
      </View>
      {item.title ? (
        <Text style={[styles.cardTitle, { color: palette.text }]}>
          {item.title}
        </Text>
      ) : null}
      <Text
        style={[styles.cardContent, { color: palette.softText }]}
        numberOfLines={4}
      >
        {item.comment || item.content || item.text || ""}
      </Text>
      <View style={styles.cardMeta}>
        <FontAwesome6 name="arrow-up" size={11} color={palette.muted} />
        <Text style={[styles.metaText, { color: palette.muted }]}>
          {Number(item.helpful_votes ?? item.upvotes ?? 0)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const displayName =
    profile?.display_name || profile?.full_name || "OtoRehber Kullanıcısı";

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: palette.background }]}
      edges={["top"]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <FontAwesome6 name="arrow-left" size={19} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: palette.text }]}>Profil</Text>
        <View style={styles.headerBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.orange} />
        </View>
      ) : !profile ? (
        <View style={styles.center}>
          <FontAwesome6 name="user-slash" size={34} color={palette.muted} />
          <Text style={[styles.emptyTitle, { color: palette.text }]}>
            Kullanıcı bulunamadı
          </Text>
        </View>
      ) : (
        <FlatList
          data={profile.is_private ? [] : items}
          keyExtractor={(item) => `${activeTab}:${item.id}`}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <>
              <View style={styles.profileHeader}>
                {profile.avatar_url ? (
                  <Image
                    source={{ uri: profile.avatar_url }}
                    style={styles.avatar}
                  />
                ) : (
                  <View
                    style={[
                      styles.avatarFallback,
                      {
                        backgroundColor: palette.card,
                        borderColor: palette.border,
                      },
                    ]}
                  >
                    <Text style={[styles.initials, { color: palette.text }]}>
                      {getInitials(displayName)}
                    </Text>
                  </View>
                )}
                <Text style={[styles.name, { color: palette.text }]}>
                  {displayName}
                </Text>
                <Text style={[styles.joined, { color: palette.muted }]}>
                  {profile.created_at
                    ? `${new Date(profile.created_at).toLocaleDateString("tr-TR")} tarihinden beri üye`
                    : "OtoRehber üyesi"}
                </Text>
                <View style={styles.followStats}>
                  <Text style={[styles.followStat, { color: palette.text }]}>
                    {followerCount} <Text style={{ color: palette.muted }}>Takipçi</Text>
                  </Text>
                  <Text style={[styles.followStat, { color: palette.text }]}>
                    {followingCount} <Text style={{ color: palette.muted }}>Takip</Text>
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.followButton,
                    isFollowing && {
                      backgroundColor: palette.card,
                      borderColor: palette.border,
                    },
                  ]}
                  onPress={toggleFollow}
                  disabled={isFollowLoading}
                >
                  {isFollowLoading ? (
                    <ActivityIndicator
                      size="small"
                      color={isFollowing ? palette.text : Colors.white}
                    />
                  ) : (
                    <>
                      <FontAwesome6
                        name={isFollowing ? "check" : "user-plus"}
                        size={13}
                        color={isFollowing ? palette.text : Colors.white}
                      />
                      <Text
                        style={[
                          styles.followButtonText,
                          isFollowing && { color: palette.text },
                        ]}
                      >
                        {isFollowing ? "Takiptesin" : "Takip Et"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {profile.is_private ? (
                <View
                  style={[
                    styles.privateBox,
                    { backgroundColor: palette.card, borderColor: palette.border },
                  ]}
                >
                  <FontAwesome6 name="lock" size={22} color={palette.muted} />
                  <Text style={[styles.privateTitle, { color: palette.text }]}>
                    Bu profil gizli
                  </Text>
                  <Text style={[styles.privateText, { color: palette.muted }]}>
                    Kullanıcının deneyimleri ve yorumları profilinde gösterilmiyor.
                  </Text>
                </View>
              ) : (
                <View style={styles.tabs}>
                  {(
                    [
                      ["reviews", `Deneyimler ${reviews.length}`],
                      ["posts", `Gönderiler ${posts.length}`],
                      ["comments", `Yorumlar ${comments.length}`],
                    ] as Array<[Tab, string]>
                  ).map(([key, label]) => (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.tab,
                        { borderColor: palette.border },
                        activeTab === key && styles.activeTab,
                      ]}
                      onPress={() => setActiveTab(key)}
                    >
                      <Text
                        style={[
                          styles.tabText,
                          { color: activeTab === key ? Colors.orange : palette.muted },
                        ]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          }
          ListEmptyComponent={
            !profile.is_private ? (
              <Text style={[styles.emptyText, { color: palette.muted }]}>
                Bu bölümde henüz içerik yok.
              </Text>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 60,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBtn: { width: 40, height: 40, justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "900" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  list: { padding: 18, paddingBottom: 60 },
  profileHeader: { alignItems: "center", paddingVertical: 18 },
  avatar: { width: 86, height: 86, borderRadius: 43 },
  avatarFallback: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { fontSize: 25, fontWeight: "900" },
  name: { fontSize: 21, fontWeight: "900", marginTop: 12 },
  joined: { fontSize: 11, marginTop: 5 },
  followStats: { flexDirection: "row", gap: 18, marginTop: 12 },
  followStat: { fontSize: 12, fontWeight: "800" },
  followButton: {
    minWidth: 150,
    minHeight: 44,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: Colors.orange,
    backgroundColor: Colors.orange,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 20,
  },
  followButtonText: { color: Colors.white, fontSize: 14, fontWeight: "900" },
  tabs: { flexDirection: "row", gap: 7, marginBottom: 16 },
  tab: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  activeTab: {
    borderColor: Colors.orange,
    backgroundColor: "rgba(249,115,22,0.1)",
  },
  tabText: { fontSize: 11, fontWeight: "800" },
  contentCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 15,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
  },
  carText: { flex: 1, fontSize: 11, fontWeight: "800" },
  dateText: { fontSize: 10 },
  cardTitle: { fontSize: 15, fontWeight: "800", marginBottom: 5 },
  cardContent: { fontSize: 13, lineHeight: 20 },
  cardMeta: { flexDirection: "row", gap: 5, marginTop: 10 },
  metaText: { fontSize: 11, fontWeight: "700" },
  privateBox: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    marginTop: 8,
  },
  privateTitle: { fontSize: 16, fontWeight: "900", marginTop: 10 },
  privateText: { fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 5 },
  emptyTitle: { fontSize: 17, fontWeight: "900" },
  emptyText: { textAlign: "center", marginTop: 30, fontSize: 13 },
});
