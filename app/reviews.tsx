import Colors from "@/constants/Colors";
import { FontAwesome6 } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React from "react";
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
import { Review, useReviews } from "../contexts/ReviewContext";
import { useAppTheme } from "../contexts/ThemeContext";

const getInitials = (name: string) => {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g, "").charAt(0) || "U";
  const last =
    parts.length > 1
      ? parts[parts.length - 1]?.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g, "").charAt(0)
      : "";
  return `${first}${last}`.toLocaleUpperCase("tr-TR");
};

const isGeneratedAvatar = (avatar?: string | null) => {
  if (!avatar) return true;
  const normalized = avatar.toLocaleLowerCase("tr-TR");
  return (
    normalized.includes("ui-avatars.com") ||
    normalized.includes("pravatar") ||
    normalized.includes("placeholder")
  );
};

function ReviewCard({ review }: { review: Review }) {
  const router = useRouter();
  const { palette } = useAppTheme();
  const title = review.title?.trim();
  const comment = review.comment?.trim();

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: palette.card, borderColor: palette.border },
      ]}
      activeOpacity={0.75}
      onPress={() =>
        router.push({
          pathname: `/review/${review.id}`,
          params: { fallbackData: JSON.stringify(review) },
        } as any)
      }
    >
      <View style={styles.cardHeader}>
        {!isGeneratedAvatar(review.avatar) ? (
          <Image source={{ uri: review.avatar }} style={styles.avatar} />
        ) : (
          <View
            style={[
              styles.avatarFallback,
              { backgroundColor: palette.elevated, borderColor: palette.border },
            ]}
          >
            <Text style={[styles.avatarInitials, { color: palette.text }]}>
              {getInitials(review.user)}
            </Text>
          </View>
        )}
        <View style={styles.headerText}>
          <Text style={[styles.userName, { color: palette.text }]} numberOfLines={1}>
            {review.user || "Sürücü"}
          </Text>
          <Text style={styles.carName} numberOfLines={1}>
            {review.car || review.brand || "Araç deneyimi"}
          </Text>
        </View>
        <Text style={[styles.dateText, { color: palette.muted }]}>
          {review.date || "Yeni"}
        </Text>
      </View>

      {review.rating ? (
        <View style={styles.ratingRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <FontAwesome6
              key={star}
              name="star"
              size={11}
              solid={review.rating ? review.rating >= star : false}
              color={
                review.rating && review.rating >= star
                  ? Colors.orange
                  : Colors.navyBorder
              }
            />
          ))}
        </View>
      ) : null}

      {title ? (
        <Text style={[styles.reviewTitle, { color: palette.text }]}>{title}</Text>
      ) : null}
      {comment ? (
        <Text
          style={[styles.reviewComment, { color: palette.softText }]}
          numberOfLines={4}
        >
          {comment}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

export default function ReviewsScreen() {
  const router = useRouter();
  const { reviews, isLoading } = useReviews();
  const { palette } = useAppTheme();

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: palette.background }]}
      edges={["top"]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[
            styles.backBtn,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <FontAwesome6 name="arrow-left" size={18} color={palette.text} />
        </TouchableOpacity>
        <View style={styles.titleBlock}>
          <Text style={[styles.headerTitle, { color: palette.text }]}>
            Son Deneyimler
          </Text>
          <Text style={[styles.headerSub, { color: palette.muted }]}>
            {reviews.length} yorum
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={Colors.orange} />
          <Text style={[styles.loadingText, { color: palette.muted }]}>
            Deneyimler yükleniyor...
          </Text>
        </View>
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ReviewCard review={item} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={6}
          removeClippedSubviews
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <FontAwesome6
                name="comment-slash"
                size={30}
                color={palette.muted}
              />
              <Text style={[styles.emptyText, { color: palette.muted }]}>
                Henüz yorum yok
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.navyMain },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.navyBorder,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.navyCard,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  titleBlock: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: "800", color: Colors.white },
  headerSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  headerSpacer: { width: 38 },
  content: { padding: 20, gap: 12, paddingBottom: 44 },
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: { fontSize: 13 },
  card: {
    backgroundColor: Colors.navyCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.navyBorder,
  },
  avatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: "800",
  },
  headerText: { flex: 1 },
  userName: { fontSize: 14, fontWeight: "800", color: Colors.white },
  carName: {
    fontSize: 11,
    color: Colors.orange,
    fontWeight: "700",
    marginTop: 2,
  },
  dateText: { fontSize: 10, color: Colors.textMuted },
  ratingRow: { flexDirection: "row", gap: 4, marginBottom: 8 },
  reviewTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.white,
    marginBottom: 6,
  },
  reviewComment: {
    fontSize: 13,
    color: Colors.gray300,
    lineHeight: 20,
  },
  emptyState: { alignItems: "center", gap: 12, paddingTop: 80 },
  emptyText: { color: Colors.textMuted, fontSize: 14 },
});
