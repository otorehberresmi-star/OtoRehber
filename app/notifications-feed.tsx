import Colors from "@/constants/Colors";
import { FontAwesome6 } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
    FlatList,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { useAppTheme } from "../contexts/ThemeContext";
import { loginRoute } from "../utils/authRedirect";

type FilterType =
  | "Tümü"
  | "💬 Yorumlar"
  | "🚗 Takip"
  | "⬆️ Faydalı Oylar"
  | "📢 Sistem";
const FILTERS: FilterType[] = [
  "Tümü",
  "💬 Yorumlar",
  "🚗 Takip",
  "⬆️ Faydalı Oylar",
  "📢 Sistem",
];

type NotificationItem = {
  id: string;
  type: string;
  user: string;
  actorId?: string | null;
  avatar?: string | null;
  icon?: React.ComponentProps<typeof FontAwesome6>["name"];
  iconBg?: string;
  iconColor?: string;
  message: string;
  quote?: string | null;
  time: string;
  isRead: boolean;
  postId?: string | null;
  reviewId?: string | null;
};

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] || "K"}${parts.length > 1 ? parts.at(-1)?.[0] || "" : ""}`
    .toLocaleUpperCase("tr-TR");
};

const isHelpfulVoteNotification = (type: string) =>
  ["helpful_vote", "post_vote", "comment_vote", "like"].includes(type);

const getHelpfulContentLabel = (type: string) => {
  if (type === "comment_vote") return "Faydalı bulunan yorumun";
  if (type === "post_vote") return "Faydalı bulunan gönderin";
  return "Faydalı bulunan deneyimin";
};

const formatTime = (createdAt?: string) =>
  createdAt ? new Date(createdAt).toLocaleDateString("tr-TR") : "Yeni";

const mapNotification = (item: any): NotificationItem => ({
  id: item.id,
  type: item.type || "system",
  user: item.actor_name || item.title || "OtoRehber",
  actorId: item.actor_id || item.metadata?.follower_id || null,
  avatar: item.actor_avatar || null,
  icon:
    item.icon ||
    (item.type === "vehicle_interest"
      ? "car-side"
      : item.type === "community"
        ? "users"
      : item.type === "vehicle_reminder"
        ? "calendar-check"
        : item.type === "tax_reminder"
          ? "file-invoice-dollar"
          : item.type === "campaign"
            ? "tags"
            : item.type === "weekly_digest"
              ? "newspaper"
          : "bell"),
  iconBg: item.icon_bg || "rgba(255,101,0,0.16)",
  iconColor: item.icon_color || Colors.orange,
  message: item.message || "",
  quote: item.quote || null,
  time: formatTime(item.created_at),
  isRead: Boolean(item.is_read),
  postId: item.post_id || null,
  reviewId: item.review_id || null,
});

export default function NotificationsFeedScreen() {
  const router = useRouter();
  const { user, isAuthReady } = useAuth();
  const { palette } = useAppTheme();
  const [activeFilter, setActiveFilter] = useState<FilterType>("Tümü");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [schemaMissing, setSchemaMissing] = useState(false);

  useEffect(() => {
    if (isAuthReady && !user?.id) {
      router.replace(loginRoute("/notifications-feed") as any);
    }
  }, [isAuthReady, router, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      setSchemaMissing(false);
      return;
    }

    let isMounted = true;

    const fetchNotifications = async () => {
      const generationJobs = [
        {
          fn: "generate_vehicle_reminder_notifications",
          label: "Araç hatırlatıcıları",
        },
        {
          fn: "generate_campaign_notifications",
          label: "Kampanya bildirimleri",
        },
        {
          fn: "generate_weekly_digest_notifications",
          label: "Haftalık özet",
        },
      ];

      await Promise.all(
        generationJobs.map((job) =>
          supabase.rpc(job.fn, { p_user_id: user.id }).then(({ error }) => {
            const missingFunction =
              error?.message.includes(job.fn) ||
              error?.message.includes("schema cache") ||
              error?.message.includes("Could not find");

            if (error && !missingFunction) {
              console.error(`${job.label} üretilemedi:`, error.message);
            }
          }),
        ),
      );

      const { data, error } = await supabase
        .from("notifications")
        .select(
          "id,user_id,type,title,message,quote,actor_id,actor_name,actor_avatar,post_id,review_id,metadata,is_read,created_at",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        const missingNotificationsTable =
          error.message.includes("public.notifications") ||
          error.message.includes("schema cache");

        if (missingNotificationsTable) {
          setNotifications([]);
          setSchemaMissing(true);
        } else {
          console.error("Bildirimler alınamadı:", error.message);
        }
        return;
      }

      if (isMounted) {
        setSchemaMissing(false);
        setNotifications((data || []).map(mapNotification));
      }
    };

    fetchNotifications();

    const sub = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) =>
          setNotifications((prev) => [mapNotification(payload.new), ...prev]),
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(sub);
    };
  }, [user?.id]);

  // Tümü okundu işaretle
  const markAllAsRead = async () => {
    if (!user?.id || schemaMissing) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id);
  };

  // Tekil bildirime tıklandığında okundu işaretle
  const handleNotificationPress = async (notification: NotificationItem) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)),
    );
    if (!schemaMissing) {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notification.id);
    }

    if (notification.postId) {
      router.push(`/post/${notification.postId}` as any);
    } else if (notification.reviewId) {
      router.push(`/review/${notification.reviewId}` as any);
    } else if (notification.type === "follow" && notification.actorId) {
      router.push(`/user/${notification.actorId}` as any);
    }
  };

  // Filtreleme mantığı
  const filteredNotifications = useMemo(() => notifications.filter((n) => {
    if (activeFilter === "Tümü") return true;
    if (activeFilter === "💬 Yorumlar") return n.type === "comment";
    if (activeFilter === "🚗 Takip") {
      return (
        n.type === "vehicle_interest" ||
        n.type === "community" ||
        n.type === "follow" ||
        n.type === "vehicle_reminder" ||
        n.type === "tax_reminder"
      );
    }
    if (activeFilter === "⬆️ Faydalı Oylar") {
      return (
        n.type === "helpful_vote" ||
        n.type === "post_vote" ||
        n.type === "comment_vote" ||
        n.type === "like"
      );
    }
    if (activeFilter === "📢 Sistem") {
      return (
        n.type === "system" ||
        n.type === "campaign" ||
        n.type === "weekly_digest"
      );
    }
    return true;
  }), [activeFilter, notifications]);

  const renderNotificationItem = ({ item: notif }: { item: NotificationItem }) => (
    <TouchableOpacity
      style={[
        styles.notifCard,
        {
          backgroundColor: palette.background,
          borderBottomColor: palette.border,
        },
        !notif.isRead && {
          backgroundColor: palette.card,
          borderLeftWidth: 3,
          borderLeftColor: Colors.orange,
        },
      ]}
      activeOpacity={0.7}
      onPress={() => handleNotificationPress(notif)}
    >
      <View style={styles.avatarWrapper}>
        {notif.avatar ? (
          <Image source={{ uri: notif.avatar }} style={styles.avatarImage} />
        ) : isHelpfulVoteNotification(notif.type) ? (
          <View
            style={[
              styles.avatarInitials,
              { backgroundColor: palette.elevated, borderColor: palette.border },
            ]}
          >
            <Text style={[styles.avatarInitialsText, { color: palette.text }]}>
              {getInitials(notif.user)}
            </Text>
          </View>
        ) : (
          <View
            style={[
              styles.avatarIconBg,
              { backgroundColor: notif.iconBg },
            ]}
          >
            <FontAwesome6
              name={notif.icon}
              size={18}
              color={notif.iconColor}
            />
          </View>
        )}
        {renderActionBadge(notif.type)}
      </View>

      <View style={styles.notifBody}>
        <Text style={[styles.notifText, { color: palette.softText }]}>
          <Text style={[styles.notifBold, { color: palette.text }]}>
            {notif.user}
          </Text>{" "}
          {notif.message}
        </Text>
        {notif.quote && (
          <View
            style={[
              styles.notifQuoteBox,
              { backgroundColor: palette.elevated, borderColor: palette.border },
            ]}
          >
            {isHelpfulVoteNotification(notif.type) ? (
              <Text style={[styles.notifQuoteLabel, { color: Colors.orange }]}>
                {getHelpfulContentLabel(notif.type)}
              </Text>
            ) : null}
            <Text
              style={[styles.notifQuote, { color: palette.muted }]}
              numberOfLines={3}
            >
              “{notif.quote}”
            </Text>
          </View>
        )}
        <Text style={styles.notifTime}>{notif.time}</Text>
      </View>

      <View style={styles.notifRight}>
        {!notif.isRead && <View style={styles.unreadDot} />}
      </View>
    </TouchableOpacity>
  );

  const renderNotificationEmpty = () =>
    schemaMissing ? (
      <View style={styles.emptyState}>
        <FontAwesome6 name="bell-slash" size={28} color={palette.muted} />
        <Text style={[styles.emptyText, { color: palette.muted }]}>
          Henüz bildirim yok.
        </Text>
      </View>
    ) : (
      <Text style={[styles.emptyText, { color: palette.muted }]}>
        Henüz bildirim yok.
      </Text>
    );

  // Eylem ikonunu renderlayan fonksiyon
  const renderActionBadge = (type: string) => {
    switch (type) {
      case "comment":
        return (
          <View
            style={[
              styles.actionBadge,
              { backgroundColor: "#3b82f6", borderColor: palette.background },
            ]}
          >
            <FontAwesome6 name="message" size={8} color={Colors.white} solid />
          </View>
        );
      case "like":
      case "helpful_vote":
      case "post_vote":
      case "comment_vote":
        return (
          <View
            style={[
              styles.actionBadge,
              { backgroundColor: Colors.orange, borderColor: palette.background },
            ]}
          >
            <FontAwesome6 name="arrow-up" size={9} color={Colors.white} solid />
          </View>
        );
      case "system":
        return (
          <View
            style={[
              styles.actionBadge,
              { backgroundColor: "#fb923c", borderColor: palette.background },
            ]}
          >
            <FontAwesome6 name="bullhorn" size={8} color={Colors.white} solid />
          </View>
        );
      case "campaign":
        return (
          <View
            style={[
              styles.actionBadge,
              { backgroundColor: "#a855f7", borderColor: palette.background },
            ]}
          >
            <FontAwesome6 name="tags" size={8} color={Colors.white} solid />
          </View>
        );
      case "weekly_digest":
        return (
          <View
            style={[
              styles.actionBadge,
              { backgroundColor: "#06b6d4", borderColor: palette.background },
            ]}
          >
            <FontAwesome6 name="newspaper" size={8} color={Colors.white} solid />
          </View>
        );
      case "vehicle_interest":
      case "community":
        return (
          <View
            style={[
              styles.actionBadge,
              { backgroundColor: Colors.orange, borderColor: palette.background },
            ]}
          >
            <FontAwesome6
              name={type === "community" ? "users" : "car-side"}
              size={8}
              color={Colors.white}
              solid
            />
          </View>
        );
      case "follow":
        return (
          <View
            style={[
              styles.actionBadge,
              { backgroundColor: "#3b82f6", borderColor: palette.background },
            ]}
          >
            <FontAwesome6
              name="user-plus"
              size={8}
              color={Colors.white}
              solid
            />
          </View>
        );
      case "vehicle_reminder":
      case "tax_reminder":
        return (
          <View
            style={[
              styles.actionBadge,
              { backgroundColor: "#22c55e", borderColor: palette.background },
            ]}
          >
            <FontAwesome6
              name="calendar-check"
              size={8}
              color={Colors.white}
              solid
            />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: palette.background }]}
      edges={["top"]}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Üst Bar (Header) ── */}
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome6 name="arrow-left" size={18} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: palette.text }]}>
          Bildirimler
        </Text>
        <TouchableOpacity onPress={markAllAsRead} style={styles.markReadBtn}>
          <FontAwesome6
            name="check-double"
            size={14}
            color={palette.muted}
          />
        </TouchableOpacity>
      </View>

      {/* ── Hızlı Filtre Sekmeleri ── */}
      <View style={[styles.filtersWrapper, { borderBottomColor: palette.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersScroll}
        >
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setActiveFilter(f)}
              style={[
                styles.filterChip,
                { backgroundColor: palette.card, borderColor: palette.border },
                activeFilter === f && styles.filterChipActive,
              ]}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: palette.muted },
                  activeFilter === f && styles.filterTextActive,
                ]}
              >
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Bildirim Listesi Akışı ── */}
      <FlatList
        data={schemaMissing ? [] : filteredNotifications}
        keyExtractor={(notif) => notif.id}
        renderItem={renderNotificationItem}
        ListEmptyComponent={renderNotificationEmpty}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

// ─── Stiller ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.navyMain },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.navyBorder,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: Colors.white },
  markReadBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "flex-end",
  },

  // Filters
  filtersWrapper: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.navyBorder,
  },
  filtersScroll: { paddingHorizontal: 16, gap: 8 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.navyCard,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  filterChipActive: {
    backgroundColor: "rgba(255,101,0,0.15)",
    borderColor: Colors.orange,
  },
  filterText: { fontSize: 13, fontWeight: "600", color: Colors.textMuted },
  filterTextActive: { color: Colors.orange },

  // List & Cards
  list: { paddingBottom: 40 },
  emptyText: {
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: 40,
    fontStyle: "italic",
  },
  emptyState: {
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 70,
  },

  notifCard: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.navyBorder,
    backgroundColor: Colors.navyMain,
  },
  notifCardUnread: { backgroundColor: "rgba(255,101,0,0.03)" },

  avatarWrapper: { position: "relative", marginRight: 14 },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.navyBorder,
  },
  avatarIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitialsText: {
    fontSize: 14,
    fontWeight: "900",
  },
  actionBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: Colors.navyMain,
  },

  notifBody: { flex: 1, justifyContent: "center" },
  notifText: { fontSize: 13, color: Colors.gray300, lineHeight: 18 },
  notifBold: { fontWeight: "700", color: Colors.white },
  notifQuote: {
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: "italic",
    lineHeight: 17,
  },
  notifQuoteBox: {
    borderWidth: 1,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: Colors.orange,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
  },
  notifQuoteLabel: {
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 3,
  },
  notifTime: {
    fontSize: 11,
    color: Colors.orange,
    fontWeight: "600",
    marginTop: 6,
  },

  notifRight: {
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 12,
    position: "relative",
  },
  postImage: {
    width: 40,
    height: 40,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.orange,
    position: "absolute",
    right: -2,
    top: "50%",
    marginTop: -5,
  },
});
