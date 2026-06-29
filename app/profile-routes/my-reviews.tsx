import Colors from "@/constants/Colors";
import { FontAwesome6 } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { useReviews } from "../../contexts/ReviewContext";
import { useAppTheme } from "../../contexts/ThemeContext";
import { AddReviewModal } from "../(tabs)/profile";
import { supabase } from "../../supabaseClient";
import { loginRoute } from "../../utils/authRedirect";

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.charAt(0) || "S";
  const last = parts.length > 1 ? parts[parts.length - 1]?.charAt(0) : "";
  return `${first}${last}`.toLocaleUpperCase("tr-TR");
};

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

type MyActivityItem = {
  id: string;
  sourceId: string;
  sourceType: "review" | "post" | "comment";
  targetType?: "review" | "post";
  targetId?: string | null;
  user: string;
  avatar?: string | null;
  car: string;
  title: string;
  comment: string;
  date: string;
  createdAt?: string | null;
  rating?: number | null;
  badge: string;
};

export default function MyReviewsScreen() {
  const router = useRouter();
  const { addReview, refreshReviews } = useReviews();
  const { user, isAuthReady } = useAuth();
  const { palette } = useAppTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [items, setItems] = useState<MyActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const userName = user?.name || user?.email?.split("@")[0] || "Sürücü";
  const userAvatar = user?.avatar || "";

  const fetchMyActivity = async () => {
    if (!user?.id) {
      setItems([]);
      return;
    }

    setIsLoading(true);
    try {
      const [reviewsResult, postsResult, commentsResult] = await Promise.all([
        supabase
          .from("reviews")
          .select("id,user_id,user,avatar,brand,car,title,comment,rating,created_at,date")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("posts")
          .select(
            "id,user_id,user,avatar,car,title,content,community_id,created_at",
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("comments")
          .select("id,post_id,review_id,user_id,user,avatar,text,content,upvotes,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      if (reviewsResult.error) {
        console.error("Kendi deneyimlerim alınamadı:", reviewsResult.error.message);
      }
      if (postsResult.error) {
        console.error("Kendi gönderilerim alınamadı:", postsResult.error.message);
      }
      if (commentsResult.error) {
        console.error("Kendi yorumlarım alınamadı:", commentsResult.error.message);
      }

      const commentsData = commentsResult.error ? [] : commentsResult.data || [];
      const postIds = Array.from(
        new Set(commentsData.map((item: any) => item.post_id).filter(Boolean)),
      );
      const reviewIds = Array.from(
        new Set(commentsData.map((item: any) => item.review_id).filter(Boolean)),
      );

      const [commentPostsResult, commentReviewsResult] = await Promise.all([
        postIds.length > 0
          ? supabase
              .from("posts")
              .select("id,car,title,content")
              .in("id", postIds)
          : Promise.resolve({ data: [], error: null }),
        reviewIds.length > 0
          ? supabase
              .from("reviews")
              .select("id,brand,car,title,comment")
              .in("id", reviewIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (commentPostsResult.error) {
        console.error(
          "Yorum yapılan gönderiler alınamadı:",
          commentPostsResult.error.message,
        );
      }
      if (commentReviewsResult.error) {
        console.error(
          "Yorum yapılan deneyimler alınamadı:",
          commentReviewsResult.error.message,
        );
      }

      const postsById = new Map(
        (commentPostsResult.data || []).map((item: any) => [item.id, item]),
      );
      const reviewsById = new Map(
        (commentReviewsResult.data || []).map((item: any) => [item.id, item]),
      );

      const reviewItems: MyActivityItem[] = (reviewsResult.data || []).map(
        (item: any) => ({
          id: `review:${item.id}`,
          sourceId: item.id,
          sourceType: "review",
          user: item.user || userName,
          avatar: item.avatar || userAvatar,
          car: item.car || item.brand || "Araç deneyimi",
          title: item.title || "Deneyim",
          comment: item.comment || "",
          date: item.created_at
            ? new Date(item.created_at).toLocaleDateString("tr-TR")
            : item.date || "Yeni",
          createdAt: item.created_at || null,
          rating: item.rating ? Number(item.rating) : null,
          badge: "Deneyim",
        }),
      );

      const reviewSignatures = new Set(
        (reviewsResult.data || []).map((item: any) =>
          activitySignature(item.title, item.comment, item.car),
        ),
      );

      const postItems: MyActivityItem[] = (postsResult.data || [])
        .filter((item: any) => {
          if (item.community_id) return true;
          return !reviewSignatures.has(
            activitySignature(item.title, item.content, item.car),
          );
        })
        .map((item: any) => ({
          id: `post:${item.id}`,
          sourceId: item.id,
          sourceType: "post",
          user: item.user || userName,
          avatar: item.avatar || userAvatar,
          car: item.car || "Topluluk gönderisi",
          title: item.title || "Gönderi",
          comment: item.content || "",
          date: item.created_at
            ? new Date(item.created_at).toLocaleDateString("tr-TR")
            : "Yeni",
          createdAt: item.created_at || null,
          badge: "Gönderi",
        }));

      const commentItems: MyActivityItem[] = commentsData.map((item: any) => {
        const parentPost = item.post_id ? postsById.get(item.post_id) : null;
        const parentReview = item.review_id
          ? reviewsById.get(item.review_id)
          : null;
        const parent = parentPost || parentReview;
        const targetType = item.post_id ? "post" : "review";

        return {
          id: `comment:${item.id}`,
          sourceId: item.id,
          sourceType: "comment",
          targetType,
          targetId: item.post_id || item.review_id || null,
          user: item.user || userName,
          avatar: item.avatar || userAvatar,
          car:
            parent?.car ||
            parent?.brand ||
            (targetType === "post" ? "Topluluk gönderisi" : "Araç deneyimi"),
          title: parent?.title || "Yorum yaptığın içerik",
          comment: item.content || item.text || "",
          date: item.created_at
            ? new Date(item.created_at).toLocaleDateString("tr-TR")
            : "Yeni",
          createdAt: item.created_at || null,
          badge: "Cevap/Yorum",
        };
      });

      const nextItems = [...reviewItems, ...postItems, ...commentItems].sort(
        (a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        },
      );

      setItems(nextItems);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthReady) return;
    if (!user?.id) {
      setIsLoading(false);
      router.replace(loginRoute("/profile-routes/my-reviews") as any);
      return;
    }
    void fetchMyActivity();
  }, [isAuthReady, user?.id]);

  const renderActivityItem = ({ item }: { item: MyActivityItem }) => (
    <TouchableOpacity
      style={[
        styles.expCard,
        { backgroundColor: palette.card, borderColor: palette.border },
      ]}
      activeOpacity={0.7}
      onPress={() => openItem(item)}
    >
      <View style={styles.expHeader}>
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.expAvatar} />
        ) : (
          <View
            style={[
              styles.expAvatarFallback,
              {
                backgroundColor: palette.elevated,
                borderColor: palette.border,
              },
            ]}
          >
            <Text
              style={[
                styles.expAvatarFallbackText,
                { color: palette.text },
              ]}
            >
              {getInitials(item.user || userName)}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.expUser, { color: palette.text }]}>
            {item.user}
          </Text>
          <Text style={styles.expCarInfo}>{item.car}</Text>
        </View>
        <View style={styles.expMetaRight}>
          <Text style={[styles.expBadge, { color: Colors.orange }]}>
            {item.badge}
          </Text>
          <Text style={[styles.expDate, { color: palette.muted }]}>
            {item.date}
          </Text>
        </View>
      </View>
      {!!item.title && (
        <Text style={[styles.expTitle, { color: palette.text }]}>
          {item.title}
        </Text>
      )}
      {item.rating ? (
        <View style={styles.ratingRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <FontAwesome6
              key={star}
              name="star"
              size={11}
              solid={item.rating ? item.rating >= star : false}
              color={
                item.rating && item.rating >= star
                  ? Colors.orange
                  : palette.border
              }
            />
          ))}
        </View>
      ) : null}
      <Text style={[styles.expComment, { color: palette.softText }]}>
        {item.comment}
      </Text>
    </TouchableOpacity>
  );

  const renderEmptyActivity = () =>
    isLoading ? (
      <View style={styles.loadingBox}>
        <ActivityIndicator color={Colors.orange} />
      </View>
    ) : (
      <View style={styles.emptyBox}>
        <FontAwesome6 name="comment-slash" size={32} color={palette.border} />
        <Text style={[styles.emptyText, { color: palette.muted }]}>
          Henüz bir yorum yapmadınız.
        </Text>
      </View>
    );

  const openItem = (item: MyActivityItem) => {
    if (item.sourceType === "post") {
      router.push(`/post/${item.sourceId}` as any);
      return;
    }

    if (item.sourceType === "review") {
      router.push({
        pathname: `/review/${item.sourceId}`,
        params: { fallbackData: JSON.stringify(item) },
      } as any);
      return;
    }

    if (item.targetType === "post" && item.targetId) {
      router.push(`/post/${item.targetId}` as any);
      return;
    }

    if (item.targetType === "review" && item.targetId) {
      router.push(`/review/${item.targetId}` as any);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: palette.background }]}
      edges={["top"]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome6 name="arrow-left" size={20} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: palette.text }]}>
          Yorumlarım ve Puanlarım
        </Text>
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          style={styles.backBtn}
        >
          <FontAwesome6 name="plus" size={18} color={Colors.orange} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={isLoading ? [] : items}
        keyExtractor={(item) => item.id}
        renderItem={renderActivityItem}
        ListEmptyComponent={renderEmptyActivity}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      />

      <AddReviewModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={(rev) => {
          addReview(rev);
          void refreshReviews();
          void fetchMyActivity();
        }}
        userName={userName}
        userAvatar={userAvatar}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.navyMain },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.navyBorder,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: Colors.white },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  loadingBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyBox: { alignItems: "center", marginTop: 40 },
  emptyText: { marginTop: 12 },
  expCard: {
    backgroundColor: Colors.navyCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
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
  expAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  expAvatarFallbackText: {
    fontSize: 12,
    fontWeight: "900",
  },
  expUser: { fontSize: 14, fontWeight: "700", color: Colors.white },
  expCarInfo: { fontSize: 11, color: Colors.orange, fontWeight: "600" },
  expMetaRight: { alignItems: "flex-end", gap: 4 },
  expBadge: { fontSize: 10, fontWeight: "800" },
  expDate: { fontSize: 10, color: Colors.textMuted },
  expTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.white,
    marginBottom: 6,
  },
  ratingRow: { flexDirection: "row", gap: 4, marginBottom: 8 },
  expComment: {
    fontSize: 13,
    color: Colors.gray300,
    lineHeight: 20,
    fontStyle: "italic",
  },
});
