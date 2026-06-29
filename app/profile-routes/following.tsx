import Colors from "@/constants/Colors";
import { FontAwesome6 } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { useAppTheme } from "../../contexts/ThemeContext";
import { supabase } from "../../supabaseClient";
import { loginRoute } from "../../utils/authRedirect";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toLocaleUpperCase("tr-TR") || "K";

type FollowTab = "following" | "followers";

export default function FollowingScreen() {
  const router = useRouter();
  const { user, isAuthReady } = useAuth();
  const { palette } = useAppTheme();
  const [query, setQuery] = useState("");
  const [profiles, setProfiles] = useState<any[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [followerIds, setFollowerIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<FollowTab>("following");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [followingResult, followersResult] = await Promise.all([
      supabase
        .from("user_follows")
        .select("following_id")
        .eq("follower_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("user_follows")
        .select("follower_id")
        .eq("following_id", user.id)
        .order("created_at", { ascending: false }),
    ]);
    const followsError = followingResult.error || followersResult.error;

    if (followsError) {
      const missing =
        followsError.message.includes("user_follows") ||
        followsError.message.includes("schema cache");
      if (missing) {
        Alert.alert(
          "Takip bilgileri kullanılamıyor",
          "Takip bağlantıları şu anda yüklenemiyor. Lütfen daha sonra tekrar dene.",
        );
      }
      setLoading(false);
      return;
    }

    setFollowingIds(
      (followingResult.data || []).map((item: any) => item.following_id),
    );
    setFollowerIds(
      (followersResult.data || []).map((item: any) => item.follower_id),
    );

    const { data: publicProfiles } = await supabase
      .from("public_profiles")
      .select("id,display_name,full_name,avatar_url,is_private,created_at")
      .neq("id", user.id)
      .order("display_name", { ascending: true })
      .limit(200);
    setProfiles(publicProfiles || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!isAuthReady) return;
    if (!user?.id) {
      setLoading(false);
      router.replace(loginRoute("/profile-routes/following") as any);
      return;
    }
    void load();
  }, [isAuthReady, user?.id]);

  const filteredProfiles = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr-TR");
    const tabIds = activeTab === "following" ? followingIds : followerIds;
    const base = normalized
      ? profiles.filter((profile) =>
          `${profile.display_name || ""} ${profile.full_name || ""}`
            .toLocaleLowerCase("tr-TR")
            .includes(normalized),
        )
      : profiles.filter((profile) => tabIds.includes(profile.id));
    return base;
  }, [activeTab, followerIds, followingIds, profiles, query]);

  const toggleFollow = async (profileId: string) => {
    if (!user?.id || busyId) return;
    const isFollowing = followingIds.includes(profileId);
    setBusyId(profileId);
    const result = isFollowing
      ? await supabase
          .from("user_follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", profileId)
      : await supabase.from("user_follows").insert({
          follower_id: user.id,
          following_id: profileId,
        });

    if (result.error) {
      Alert.alert("İşlem tamamlanamadı", result.error.message);
    } else {
      setFollowingIds((ids) =>
        isFollowing
          ? ids.filter((id) => id !== profileId)
          : [...ids, profileId],
      );
    }
    setBusyId(null);
  };

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
        <Text style={[styles.title, { color: palette.text }]}>
          Takip Bağlantıları
        </Text>
        <View style={styles.headerBtn} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[
            styles.tab,
            { borderColor: palette.border },
            activeTab === "following" && styles.activeTab,
          ]}
          onPress={() => {
            setActiveTab("following");
            setQuery("");
          }}
        >
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === "following" ? Colors.orange : palette.muted,
              },
            ]}
          >
            Takip Edilenler {followingIds.length}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            { borderColor: palette.border },
            activeTab === "followers" && styles.activeTab,
          ]}
          onPress={() => {
            setActiveTab("followers");
            setQuery("");
          }}
        >
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === "followers" ? Colors.orange : palette.muted,
              },
            ]}
          >
            Takipçiler {followerIds.length}
          </Text>
        </TouchableOpacity>
      </View>

      <View
        style={[
          styles.search,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        <FontAwesome6 name="magnifying-glass" size={14} color={palette.muted} />
        <TextInput
          style={[styles.searchInput, { color: palette.text }]}
          value={query}
          onChangeText={setQuery}
          placeholder={
            activeTab === "following"
              ? "Takip edilenlerde veya kullanıcılarda ara..."
              : "Takipçilerde veya kullanıcılarda ara..."
          }
          placeholderTextColor={palette.muted}
          autoCorrect={false}
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery("")}>
            <FontAwesome6 name="xmark" size={14} color={palette.muted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.orange} />
        </View>
      ) : (
        <FlatList
          data={filteredProfiles}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <FontAwesome6 name="users" size={30} color={palette.muted} />
              <Text style={[styles.emptyText, { color: palette.muted }]}>
                {query
                  ? "Bu isimle eşleşen kullanıcı bulunamadı."
                  : activeTab === "followers"
                    ? "Henüz seni takip eden kimse yok."
                    : "Henüz kimseyi takip etmiyorsun. Arama yaparak kullanıcı bulabilirsin."}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const name =
              item.display_name || item.full_name || "OtoRehber Kullanıcısı";
            const followed = followingIds.includes(item.id);
            return (
              <TouchableOpacity
                style={[
                  styles.userRow,
                  { backgroundColor: palette.card, borderColor: palette.border },
                ]}
                onPress={() => router.push(`/user/${item.id}` as any)}
              >
                {item.avatar_url ? (
                  <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                ) : (
                  <View
                    style={[
                      styles.avatarFallback,
                      {
                        backgroundColor: palette.elevated,
                        borderColor: palette.border,
                      },
                    ]}
                  >
                    <Text style={[styles.initials, { color: palette.text }]}>
                      {initials(name)}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: palette.text }]}>{name}</Text>
                  <Text style={[styles.meta, { color: palette.muted }]}>
                    {activeTab === "followers"
                      ? followed
                        ? "Seni takip ediyor · Sen de takiptesin"
                        : "Seni takip ediyor"
                      : item.is_private
                        ? "Gizli profil"
                        : "Profili görüntüle"}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.followBtn,
                    {
                      backgroundColor: followed ? palette.elevated : Colors.orange,
                      borderColor: followed ? palette.border : Colors.orange,
                    },
                  ]}
                  onPress={(event) => {
                    event.stopPropagation();
                    void toggleFollow(item.id);
                  }}
                  disabled={busyId === item.id}
                >
                  {busyId === item.id ? (
                    <ActivityIndicator
                      size="small"
                      color={followed ? palette.text : Colors.white}
                    />
                  ) : (
                    <Text
                      style={[
                        styles.followText,
                        { color: followed ? palette.text : Colors.white },
                      ]}
                    >
                      {followed ? "Takiptesin" : "Takip Et"}
                    </Text>
                  )}
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
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
  title: { fontSize: 18, fontWeight: "900" },
  tabs: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
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
  tabText: { fontSize: 12, fontWeight: "800" },
  search: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    margin: 16,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 14 },
  list: { paddingHorizontal: 16, paddingBottom: 40, flexGrow: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  emptyText: { fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 10 },
  userRow: {
    minHeight: 76,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { fontSize: 14, fontWeight: "900" },
  name: { fontSize: 14, fontWeight: "800" },
  meta: { fontSize: 11, marginTop: 3 },
  followBtn: {
    minWidth: 86,
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  followText: { fontSize: 11, fontWeight: "800" },
});
