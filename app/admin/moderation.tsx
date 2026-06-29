import Colors from "@/constants/Colors";
import { FontAwesome6 } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "../../contexts/ThemeContext";
import { supabase } from "../../supabaseClient";

type ReportStatus = "open" | "reviewing" | "resolved" | "rejected";
type ContentType = "post" | "review" | "comment";

type ContentReport = {
  id: string;
  reporter_id: string;
  content_type: ContentType;
  content_id: string;
  content_owner_id: string | null;
  reason: string;
  details: string | null;
  status: ReportStatus;
  moderator_note: string | null;
  created_at: string;
};

type ContentPreview = {
  id: string;
  title?: string | null;
  body?: string | null;
  user?: string | null;
  user_id?: string | null;
  is_hidden?: boolean | null;
};

const STATUS_LABELS: Record<ReportStatus | "all", string> = {
  all: "Tümü",
  open: "Açık",
  reviewing: "İnceleniyor",
  resolved: "Çözüldü",
  rejected: "Reddedildi",
};

const CONTENT_LABELS: Record<ContentType, string> = {
  post: "Gönderi",
  review: "Deneyim",
  comment: "Yorum",
};

function getDateText(value?: string | null) {
  if (!value) return "Tarih yok";
  return new Date(value).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ModerationPanelScreen() {
  const router = useRouter();
  const { palette } = useAppTheme();
  const [isCheckingRole, setIsCheckingRole] = useState(true);
  const [isAllowed, setIsAllowed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeStatus, setActiveStatus] = useState<ReportStatus | "all">("open");
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [previews, setPreviews] = useState<Record<string, ContentPreview>>({});
  const [actingReportId, setActingReportId] = useState<string | null>(null);

  const filteredReports = useMemo(() => {
    if (activeStatus === "all") return reports;
    return reports.filter((report) => report.status === activeStatus);
  }, [activeStatus, reports]);

  const loadReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("content_reports")
        .select(
          "id,reporter_id,content_type,content_id,content_owner_id,reason,details,status,moderator_note,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        Alert.alert(
          "Moderasyon şeması gerekli",
          "Moderasyon kayıtları şu anda yüklenemiyor. Lütfen daha sonra tekrar dene.",
        );
        setReports([]);
        setPreviews({});
        return;
      }

      const nextReports = (data || []) as ContentReport[];
      setReports(nextReports);

      const nextPreviews: Record<string, ContentPreview> = {};
      const fetchByType = async (type: ContentType) => {
        const ids = nextReports
          .filter((report) => report.content_type === type)
          .map((report) => report.content_id);

        if (ids.length === 0) return;

        if (type === "post") {
          const { data: rows } = await supabase
            .from("posts")
            .select("id,title,content,user,user_id,is_hidden")
            .in("id", ids);
          (rows || []).forEach((row: any) => {
            nextPreviews[`post:${row.id}`] = {
              id: row.id,
              title: row.title,
              body: row.content,
              user: row.user,
              user_id: row.user_id,
              is_hidden: row.is_hidden,
            };
          });
        } else if (type === "review") {
          const { data: rows } = await supabase
            .from("reviews")
            .select("id,title,comment,user,user_id,is_hidden")
            .in("id", ids);
          (rows || []).forEach((row: any) => {
            nextPreviews[`review:${row.id}`] = {
              id: row.id,
              title: row.title,
              body: row.comment,
              user: row.user,
              user_id: row.user_id,
              is_hidden: row.is_hidden,
            };
          });
        } else {
          const { data: rows } = await supabase
            .from("comments")
            .select("id,content,text,user,user_id,is_hidden")
            .in("id", ids);
          (rows || []).forEach((row: any) => {
            nextPreviews[`comment:${row.id}`] = {
              id: row.id,
              title: "Yorum",
              body: row.content || row.text,
              user: row.user,
              user_id: row.user_id,
              is_hidden: row.is_hidden,
            };
          });
        }
      };

      await Promise.all([
        fetchByType("post"),
        fetchByType("review"),
        fetchByType("comment"),
      ]);

      setPreviews(nextPreviews);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const checkRole = async () => {
      const { data, error } = await supabase.rpc("is_moderator");
      if (!isMounted) return;
      setIsAllowed(Boolean(data) && !error);
      setIsCheckingRole(false);
    };

    void checkRole();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isAllowed) void loadReports();
  }, [isAllowed, loadReports]);

  const runReportAction = async (
    report: ContentReport,
    action: "reviewing" | "reject" | "hide_content_resolve",
  ) => {
    setActingReportId(report.id);
    try {
      const { error } = await supabase.rpc("moderate_content_report", {
        p_report_id: report.id,
        p_action: action,
        p_note:
          action === "reject"
            ? "Panelden reddedildi."
            : action === "reviewing"
              ? "Panelden incelemeye alındı."
              : "İçerik panelden gizlendi.",
        p_hidden_reason: report.reason || "Uygunsuz içerik",
      });

      if (error) {
        Alert.alert("Hata", "Moderasyon işlemi tamamlanamadı: " + error.message);
        return;
      }

      await loadReports();
    } finally {
      setActingReportId(null);
    }
  };

  const updateUserStatus = async (
    report: ContentReport,
    status: "warned" | "suspended" | "blocked",
  ) => {
    const targetUserId =
      report.content_owner_id ||
      previews[`${report.content_type}:${report.content_id}`]?.user_id;

    if (!targetUserId) {
      Alert.alert("Kullanıcı bulunamadı", "Bu içerik için kullanıcı ID bulunamadı.");
      return;
    }

    const suspendedUntil =
      status === "suspended"
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        : null;

    setActingReportId(report.id);
    try {
      const { error } = await supabase.rpc("set_user_moderation_status", {
        p_user_id: targetUserId,
        p_status: status,
        p_note:
          status === "blocked"
            ? "Moderasyon panelinden bloklandı."
            : status === "suspended"
              ? "Moderasyon panelinden 7 gün askıya alındı."
              : "Moderasyon panelinden uyarıldı.",
        p_suspended_until: suspendedUntil,
      });

      if (error) {
        Alert.alert("Hata", "Kullanıcı durumu güncellenemedi: " + error.message);
        return;
      }

      Alert.alert("Tamamlandı", "Kullanıcı moderasyon durumu güncellendi.");
    } finally {
      setActingReportId(null);
    }
  };

  const openUserActions = (report: ContentReport) => {
    Alert.alert("Kullanıcı işlemleri", undefined, [
      {
        text: "Uyar",
        onPress: () => void updateUserStatus(report, "warned"),
      },
      {
        text: "7 gün askıya al",
        onPress: () => void updateUserStatus(report, "suspended"),
      },
      {
        text: "Blokla",
        style: "destructive",
        onPress: () =>
          Alert.alert(
            "Kullanıcıyı blokla",
            "Bu kullanıcı yeni içerik paylaşamaz. Devam edilsin mi?",
            [
              { text: "Vazgeç", style: "cancel" },
              {
                text: "Blokla",
                style: "destructive",
                onPress: () => void updateUserStatus(report, "blocked"),
              },
            ],
          ),
      },
      { text: "Vazgeç", style: "cancel" },
    ]);
  };

  const renderReportCard = ({ item: report }: { item: ContentReport }) => {
    const preview = previews[`${report.content_type}:${report.content_id}`];
    const isActing = actingReportId === report.id;

    return (
      <View
        style={[
          styles.reportCard,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        <View style={styles.reportTop}>
          <View style={styles.badgeRow}>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>
                {CONTENT_LABELS[report.content_type]}
              </Text>
            </View>
            <Text style={[styles.statusText, { color: palette.muted }]}>
              {STATUS_LABELS[report.status]}
            </Text>
          </View>
          <Text style={[styles.dateText, { color: palette.muted }]}>
            {getDateText(report.created_at)}
          </Text>
        </View>

        <Text style={[styles.reasonText, { color: palette.text }]}>
          {report.reason || "Uygunsuz içerik"}
        </Text>
        {report.details ? (
          <Text style={[styles.detailsText, { color: palette.softText }]}>
            {report.details}
          </Text>
        ) : null}

        <View
          style={[
            styles.previewBox,
            { backgroundColor: palette.elevated, borderColor: palette.border },
          ]}
        >
          <Text style={[styles.previewOwner, { color: palette.muted }]}>
            {preview?.user || "Kullanıcı bilinmiyor"}
            {preview?.is_hidden ? " • gizli" : ""}
          </Text>
          <Text style={[styles.previewTitle, { color: palette.text }]}>
            {preview?.title || "İçerik bulunamadı"}
          </Text>
          <Text
            style={[styles.previewBody, { color: palette.softText }]}
            numberOfLines={3}
          >
            {preview?.body || "İçerik silinmiş veya erişilemiyor."}
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: palette.border }]}
            disabled={isActing}
            onPress={() => void runReportAction(report, "reviewing")}
          >
            <Text style={[styles.secondaryButtonText, { color: palette.text }]}>
              İncele
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.primaryButtonSmall}
            disabled={isActing}
            onPress={() =>
              Alert.alert(
                "İçeriği gizle",
                "İçerik kullanıcı akışlarından kaldırılacak ve şikayet çözülecek.",
                [
                  { text: "Vazgeç", style: "cancel" },
                  {
                    text: "Gizle",
                    style: "destructive",
                    onPress: () =>
                      void runReportAction(report, "hide_content_resolve"),
                  },
                ],
              )
            }
          >
            <Text style={styles.primaryButtonText}>Gizle</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: palette.border }]}
            disabled={isActing}
            onPress={() => void runReportAction(report, "reject")}
          >
            <Text style={[styles.secondaryButtonText, { color: palette.text }]}>
              Reddet
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.userActionButton, { borderColor: palette.border }]}
          disabled={isActing}
          onPress={() => openUserActions(report)}
        >
          <FontAwesome6 name="user-shield" size={13} color={Colors.orange} />
          <Text style={styles.userActionText}>Kullanıcı İşlemleri</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderReportsEmpty = () =>
    isLoading && reports.length === 0 ? (
      <ActivityIndicator size="small" color={Colors.orange} />
    ) : (
      <View style={styles.emptyState}>
        <FontAwesome6 name="shield-halved" size={28} color={Colors.orange} />
        <Text style={[styles.emptyTitle, { color: palette.text }]}>
          Kuyruk boş
        </Text>
        <Text style={[styles.emptyText, { color: palette.muted }]}>
          Bu filtrede bekleyen şikayet yok.
        </Text>
      </View>
    );

  if (isCheckingRole) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: palette.background }]}
      >
        <ActivityIndicator size="small" color={Colors.orange} />
      </SafeAreaView>
    );
  }

  if (!isAllowed) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: palette.background }]}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.emptyState}>
          <FontAwesome6 name="lock" size={28} color={Colors.orange} />
          <Text style={[styles.emptyTitle, { color: palette.text }]}>
            Yetkin yok
          </Text>
          <Text style={[styles.emptyText, { color: palette.muted }]}>
            Bu ekran sadece admin ve moderatör hesaplar için açılır.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.back()}>
            <Text style={styles.primaryButtonText}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: palette.background }]}
      edges={["top"]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={[
          styles.header,
          { backgroundColor: palette.background, borderBottomColor: palette.border },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <FontAwesome6 name="arrow-left" size={18} color={palette.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: palette.text }]}>
            Moderasyon Paneli
          </Text>
          <Text style={[styles.headerSubtitle, { color: palette.muted }]}>
            Şikayetler ve kullanıcı işlemleri
          </Text>
        </View>
        <TouchableOpacity onPress={loadReports} style={styles.iconButton}>
          <FontAwesome6 name="rotate" size={16} color={palette.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {(["open", "reviewing", "resolved", "rejected", "all"] as const).map(
          (status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterChip,
                { borderColor: palette.border, backgroundColor: palette.card },
                activeStatus === status && styles.filterChipActive,
              ]}
              onPress={() => setActiveStatus(status)}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: activeStatus === status ? Colors.white : palette.text },
                ]}
              >
                {STATUS_LABELS[status]}
              </Text>
            </TouchableOpacity>
          ),
        )}
      </ScrollView>

      <FlatList
        data={filteredReports}
        keyExtractor={(report) => report.id}
        renderItem={renderReportCard}
        ListEmptyComponent={renderReportsEmpty}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={loadReports}
            tintColor={Colors.orange}
            colors={[Colors.orange]}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
  },
  header: {
    minHeight: 70,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  filters: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  filterChipActive: {
    backgroundColor: Colors.orange,
    borderColor: Colors.orange,
  },
  filterText: {
    fontSize: 12,
    fontWeight: "800",
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "900",
    marginTop: 12,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 19,
    marginTop: 6,
  },
  reportCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  reportTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  typeBadge: {
    backgroundColor: "rgba(249,115,22,0.14)",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  typeBadgeText: {
    color: Colors.orange,
    fontSize: 11,
    fontWeight: "900",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "800",
  },
  dateText: {
    fontSize: 11,
    fontWeight: "700",
  },
  reasonText: {
    fontSize: 15,
    fontWeight: "900",
    marginTop: 12,
  },
  detailsText: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  previewBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  previewOwner: {
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 5,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: "900",
  },
  previewBody: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  secondaryButton: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontSize: 12,
    fontWeight: "900",
  },
  primaryButton: {
    marginTop: 16,
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 18,
    backgroundColor: Colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonSmall: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: "900",
  },
  userActionButton: {
    marginTop: 10,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  userActionText: {
    color: Colors.orange,
    fontSize: 12,
    fontWeight: "900",
  },
});
