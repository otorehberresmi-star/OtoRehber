import Colors from "@/constants/Colors";
import { FontAwesome6 } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { Review, useReviews } from "../../contexts/ReviewContext";
import { supabase } from "../../supabaseClient";
import { useAppTheme } from "../../contexts/ThemeContext";
import { validateCleanContent } from "../../utils/contentModeration";
import { loginRoute } from "../../utils/authRedirect";
import { reportContent } from "../../utils/moderation";
import PhotoCarousel from "../../components/PhotoCarousel";

const EMPTY_REVIEW: Review = {
  id: "",
  user: "",
  brand: "",
  car: "",
  comment: "",
  date: "",
  avatar: "",
};

const getInitials = (name?: string | null) => {
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

const normalizeRatingValue = (value: unknown) => {
  const rating = Number(value);
  if (!Number.isFinite(rating)) return 0;
  return Math.max(0, Math.min(5, rating));
};

const normalizeDetailedRatings = (
  ratings?: Record<string, unknown> | null,
): Record<string, number> | undefined => {
  if (!ratings || typeof ratings !== "object") return undefined;

  return Object.entries(ratings).reduce<Record<string, number>>(
    (normalized, [key, value]) => {
      normalized[key] = normalizeRatingValue(value);
      return normalized;
    },
    {},
  );
};

const normalizeReview = (review: Review): Review => ({
  ...review,
  rating:
    review.rating === undefined || review.rating === null
      ? review.rating
      : normalizeRatingValue(review.rating),
  detailedRatings: normalizeDetailedRatings(review.detailedRatings),
});

const mergeFallbackReview = (contextReview: Review, fallbackReview: Review) =>
  normalizeReview({
    ...fallbackReview,
    ...contextReview,
    detailedRatings:
      Object.keys(contextReview.detailedRatings || {}).length > 0
        ? contextReview.detailedRatings
        : fallbackReview.detailedRatings,
  });

export default function ReviewDetailScreen() {
  // Dinamik route'dan gelen yorum ID'sini ve fallback datasını alıyoruz
  const { id, fallbackData } = useLocalSearchParams<{
    id: string;
    fallbackData?: string;
  }>();
  const router = useRouter();
  const routeReviewId = Array.isArray(id) ? id[0] : id;
  const reviewReturnTo = routeReviewId ? `/review/${routeReviewId}` : "/";
  const [replyText, setReplyText] = useState("");
  const [replies, setReplies] = useState<any[]>([]);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [hasHelpfulVote, setHasHelpfulVote] = useState(false);
  const [helpfulVotesCount, setHelpfulVotesCount] = useState(0);
  const [hasDownvotedReview, setHasDownvotedReview] = useState(false);
  const [reviewDownvotesCount, setReviewDownvotesCount] = useState(0);
  const [isVotingHelpful, setIsVotingHelpful] = useState(false);
  const [isVotingDown, setIsVotingDown] = useState(false);
  const [upvotedReplyIds, setUpvotedReplyIds] = useState<string[]>([]);
  const [downvotedReplyIds, setDownvotedReplyIds] = useState<string[]>([]);
  const [isEditVisible, setIsEditVisible] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editComment, setEditComment] = useState("");
  const [editRating, setEditRating] = useState(0);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeletingReview, setIsDeletingReview] = useState(false);
  const [hasCheckedMissingReview, setHasCheckedMissingReview] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const replyInputRef = useRef<TextInput>(null);
  const { reviews, refreshReviews } = useReviews();
  const { user } = useAuth();
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();

  const scrollToReplies = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
  };

  const requestedId = Array.isArray(id) ? id[0] : id;

  // Context içinden yalnızca istenen ID'ye ait yorumu buluyoruz.
  let resolvedReview: Review | undefined = reviews.find(
    (item) => item.id === requestedId,
  );
  let parsedFallbackReview: Review | undefined;

  // Eğer context'te yoksa ve fallbackData gönderilmişse (Örn: Arama sonuçları veya Mock data)
  if (fallbackData) {
    try {
      const parsedFallback = JSON.parse(
        Array.isArray(fallbackData) ? fallbackData[0] : fallbackData,
      );
      if (parsedFallback?.id === requestedId) {
        parsedFallbackReview = normalizeReview(parsedFallback as Review);
      }
    } catch (e) {
      console.error("Fallback data parse error:", e);
    }
  }

  if (resolvedReview && parsedFallbackReview) {
    resolvedReview = mergeFallbackReview(resolvedReview, parsedFallbackReview);
  } else if (resolvedReview) {
    resolvedReview = normalizeReview(resolvedReview);
  } else if (parsedFallbackReview) {
    resolvedReview = parsedFallbackReview;
  }

  // Hook sırasını sabit tutarken eksik kaydın içeriğe sızmasını engeller.
  const review = resolvedReview || EMPTY_REVIEW;

  useEffect(() => {
    let active = true;

    const verifyReviewExists = async () => {
      if (resolvedReview) {
        setHasCheckedMissingReview(true);
        return;
      }

      setHasCheckedMissingReview(false);
      await refreshReviews();
      if (active) setHasCheckedMissingReview(true);
    };

    verifyReviewExists();
    return () => {
      active = false;
    };
  }, [requestedId, Boolean(resolvedReview), refreshReviews]);

  // Aktif kullanıcının adı, yorum yapan kişinin adıyla eşleşiyorsa true döner
  const isMyReview =
    Boolean(user?.id && review.userId === user.id) || review.user === user?.name;
  const currentUserId = user?.id || "guest";
  const hasVoted = hasHelpfulVote || review.upvotedBy?.includes(currentUserId) || false;
  const reviewUserName = isMyReview && user?.name ? user.name : review.user;
  const displayAvatar = isMyReview
    ? user?.avatar || review.avatar
    : review.avatar;
  const shouldShowAvatarImage = !isGeneratedAvatar(displayAvatar);
  const targetId = review.sourceId || review.id.replace(/^post:/, "");
  const targetTable = review.sourceType === "post" ? "posts" : "reviews";
  const replyReviewId =
    review.sourceType === "review"
      ? review.sourceId || review.id.replace(/^review:/, "")
      : review.id.replace(/^review:/, "");

  useEffect(() => {
    setHelpfulVotesCount(Number(review?.helpfulVotes || 0));
    setReviewDownvotesCount(Number(review?.downvotes || 0));
  }, [review?.id, review?.helpfulVotes]);

  useEffect(() => {
    if (!replyReviewId) return;
    let isMounted = true;

    const fetchReplies = async () => {
      setIsLoadingReplies(true);
      const { data, error } = await supabase
        .from("comments")
        .select(
          "id,post_id,review_id,user_id,user,avatar,text,content,upvotes,downvotes,created_at",
        )
        .eq("review_id", replyReviewId)
        .order("created_at", { ascending: true })
        .limit(100);

      if (error) {
        const missingReviewColumn = error.message.includes(
          "comments.review_id",
        );
        if (!missingReviewColumn) {
          console.error("Review cevapları alınamadı:", error.message);
        }
      } else if (isMounted) {
        setReplies(data || []);
        if (user?.id && data?.length) {
          const commentIds = data.map((item: any) => item.id);
          const [upResult, downResult] = await Promise.all([
            supabase
              .from("comment_votes")
              .select("comment_id")
              .eq("user_id", user.id)
              .in("comment_id", commentIds),
            supabase
              .from("comment_downvotes")
              .select("comment_id")
              .eq("user_id", user.id)
              .in("comment_id", commentIds),
          ]);
          if (isMounted) {
            setUpvotedReplyIds(
              (upResult.data || []).map((item: any) => item.comment_id),
            );
            setDownvotedReplyIds(
              (downResult.data || []).map((item: any) => item.comment_id),
            );
          }
        }
      }

      if (isMounted) setIsLoadingReplies(false);
    };

    fetchReplies();

    // Kullanıcı/yorum state'i hızlı değiştiğinde eski kanal kaldırılmadan aynı
    // isimle yeniden subscribe edilirse Supabase callback eklemeyi reddeder.
    const channelName = [
      "review-comments",
      review.id,
      user?.id || "guest",
      Date.now(),
      Math.random().toString(36).slice(2),
    ].join(":");
    const sub = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "comments",
          filter: `review_id=eq.${replyReviewId}`,
        },
        (payload) =>
          setReplies((prev) => {
            if (prev.find((item) => item.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          }),
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(sub);
    };
  }, [review?.id, replyReviewId, user?.id]);

  useEffect(() => {
    let isMounted = true;

    const loadHelpfulVote = async () => {
      if (!targetId || !user?.id) {
        if (isMounted) setHasHelpfulVote(false);
        return;
      }

      if (review.sourceType === "post") {
        const { data } = await supabase
          .from("post_votes")
          .select("post_id")
          .eq("post_id", targetId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (isMounted) setHasHelpfulVote(!!data);
        return;
      }

      const { data } = await supabase
        .from("review_helpful_votes")
        .select("review_id")
        .eq("review_id", targetId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (isMounted) setHasHelpfulVote(!!data);
    };

    loadHelpfulVote();

    return () => {
      isMounted = false;
    };
  }, [review?.id, review?.sourceId, review?.sourceType, targetId, user?.id]);

  useEffect(() => {
    if (!targetId || !user?.id) {
      setHasDownvotedReview(false);
      return;
    }

    let active = true;
    const loadDownvote = async () => {
      const table =
        review.sourceType === "post" ? "post_downvotes" : "review_downvotes";
      const idColumn =
        review.sourceType === "post" ? "post_id" : "review_id";
      const { data, error } = await supabase
        .from(table)
        .select(idColumn)
        .eq(idColumn, targetId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (active && !error) setHasDownvotedReview(Boolean(data));
    };

    loadDownvote();
    return () => {
      active = false;
    };
  }, [review.sourceType, targetId, user?.id]);

  useEffect(() => {
    if (!review?.id) return;
    setEditTitle(review.title || "");
    setEditComment(review.comment || "");
    setEditRating(Number(review.rating || 0));
  }, [review?.id, review?.title, review?.comment, review?.rating]);

  const handleSendReply = async () => {
    if (!replyText.trim()) return;

    const moderation = validateCleanContent([
      { label: "Yorum", value: replyText },
    ]);

    if (!moderation.ok) {
      Alert.alert("Uygunsuz içerik", moderation.message);
      return;
    }

    if (!user?.id) {
      router.push(loginRoute(reviewReturnTo) as any);
      return;
    }

    setIsSendingReply(true);
    try {
      const commentText = replyText.trim();
      const avatar = user.avatar || "";

      const { data, error } = await supabase
        .from("comments")
        .insert({
          review_id: replyReviewId,
          user_id: user.id,
          user: user.name || "Kullanıcı",
          avatar,
          content: commentText,
          text: commentText,
          upvotes: 0,
        })
        .select()
        .single();

      if (error) {
        const missingReviewColumn = error.message.includes("review_id");
        if (missingReviewColumn) {
          Alert.alert(
            "Yanıtlar şu anda kullanılamıyor",
            "Yanıtın şu anda kaydedilemiyor. Lütfen daha sonra tekrar dene.",
          );
          return;
        }
        throw error;
      }

      setReplies((prev) =>
        prev.find((item) => item.id === data.id) ? prev : [...prev, data],
      );
      setReplyText("");
      scrollToReplies();
      Keyboard.dismiss();
    } catch (error: any) {
      Alert.alert("Hata", "Yorum kaydedilemedi: " + error.message);
    } finally {
      setIsSendingReply(false);
    }
  };

  const displayComments = replies;
  const handleHelpfulPress = async () => {
    if (isMyReview || isVotingHelpful) return;

    if (!user?.id) {
      router.push(loginRoute(reviewReturnTo) as any);
      return;
    }

    const previousHasVote = hasHelpfulVote;
    const previousCount = helpfulVotesCount;
    const nextHasVote = !previousHasVote;
    setHasHelpfulVote(nextHasVote);
    setHelpfulVotesCount((prev) =>
      Math.max(0, prev + (nextHasVote ? 1 : -1)),
    );
    setIsVotingHelpful(true);

    const rpcName =
      review.sourceType === "post"
        ? "toggle_post_vote"
        : "toggle_review_helpful_vote";
    const rpcParams =
      review.sourceType === "post"
        ? { p_post_id: targetId }
        : { p_review_id: targetId };

    const { data, error } = await supabase.rpc(rpcName, rpcParams);

    if (error) {
      setHasHelpfulVote(previousHasVote);
      setHelpfulVotesCount(previousCount);
      setIsVotingHelpful(false);
      Alert.alert("Hata", "Faydalı oy kaydedilemedi: " + error.message);
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    setHasHelpfulVote(Boolean(result?.is_voted));
    if (result?.is_voted) setHasDownvotedReview(false);
    setHelpfulVotesCount(
      Number(
        review.sourceType === "post"
          ? result?.upvotes || 0
          : result?.helpful_votes || 0,
      ),
    );
    await refreshReviews();
    setIsVotingHelpful(false);
  };

  const handleReviewDownvote = async () => {
    if (isMyReview || isVotingDown) return;
    if (!user?.id) {
      router.push(loginRoute(reviewReturnTo) as any);
      return;
    }

    setIsVotingDown(true);
    const { data, error } = await supabase.rpc(
      review.sourceType === "post"
        ? "toggle_post_downvote"
        : "toggle_review_downvote",
      review.sourceType === "post"
        ? { p_post_id: targetId }
        : { p_review_id: targetId },
    );

    if (error) {
      Alert.alert(
        error.message.includes("toggle_review_downvote")
          ? "Oylama şu anda kullanılamıyor"
          : "Hata",
        error.message.includes("toggle_review_downvote")
          ? "Oyun şu anda kaydedilemiyor. Lütfen daha sonra tekrar dene."
          : "Oy kaydedilemedi: " + error.message,
      );
      setIsVotingDown(false);
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    setHasDownvotedReview(Boolean(result?.is_downvoted));
    setReviewDownvotesCount(Number(result?.downvotes || 0));
    if (result?.is_downvoted) {
      setHasHelpfulVote(false);
      setHelpfulVotesCount(Number(result?.helpful_votes || 0));
    }
    setIsVotingDown(false);
  };

  const focusReplyInput = (name?: string) => {
    if (name) setReplyText(`@${name} `);
    setTimeout(() => {
      replyInputRef.current?.focus();
      scrollToReplies();
    }, 80);
  };

  const handleReplyVote = async (
    comment: any,
    direction: "up" | "down",
  ) => {
    if (!user?.id) {
      router.push(loginRoute(reviewReturnTo) as any);
      return;
    }
    if (comment.user_id === user.id) return;

    const { data, error } = await supabase.rpc(
      direction === "up" ? "toggle_comment_vote" : "toggle_comment_downvote",
      { p_comment_id: comment.id },
    );
    if (error) {
      Alert.alert("Hata", "Oy kaydedilemedi: " + error.message);
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    setReplies((current) =>
      current.map((item) =>
        item.id === comment.id
          ? {
              ...item,
              upvotes: Number(result?.upvotes || 0),
              downvotes: Number(result?.downvotes || 0),
            }
          : item,
      ),
    );
    if (direction === "up") {
      setUpvotedReplyIds((ids) =>
        result?.is_voted
          ? [...ids.filter((id) => id !== comment.id), comment.id]
          : ids.filter((id) => id !== comment.id),
      );
      if (result?.is_voted) {
        setDownvotedReplyIds((ids) => ids.filter((id) => id !== comment.id));
      }
    } else {
      setDownvotedReplyIds((ids) =>
        result?.is_downvoted
          ? [...ids.filter((id) => id !== comment.id), comment.id]
          : ids.filter((id) => id !== comment.id),
      );
      if (result?.is_downvoted) {
        setUpvotedReplyIds((ids) => ids.filter((id) => id !== comment.id));
      }
    }
  };

  const handleSaveEdit = async () => {
    if (!isMyReview || !targetId || isSavingEdit) return;

    const nextTitle = editTitle.trim();
    const nextComment = editComment.trim();

    if (!nextTitle || !nextComment) {
      Alert.alert("Eksik bilgi", "Başlık ve yorum alanı boş bırakılamaz.");
      return;
    }

    const moderation = validateCleanContent([
      { label: "Başlık", value: nextTitle },
      { label: "Yorum", value: nextComment },
    ]);

    if (!moderation.ok) {
      Alert.alert("Uygunsuz içerik", moderation.message);
      return;
    }

    setIsSavingEdit(true);
    try {
      const payload =
        targetTable === "posts"
          ? {
              title: nextTitle,
              content: nextComment,
            }
          : {
              title: nextTitle,
              comment: nextComment,
              rating: editRating || null,
            };

      const { error } = await supabase
        .from(targetTable)
        .update(payload)
        .eq("id", targetId)
        .eq("user_id", user?.id);

      if (error) throw error;

      if (targetTable === "reviews") {
        const { error: linkedPostError } = await supabase
          .from("posts")
          .update({
            title: nextTitle,
            content: nextComment,
          })
          .eq("user_id", user?.id)
          .eq("title", review.title || "")
          .eq("content", review.comment || "")
          .eq("car", review.car || "");

        if (linkedPostError) {
          console.error(
            "Bağlı gönderi güncellenemedi:",
            linkedPostError.message,
          );
        }
      }

      await refreshReviews();
      setIsEditVisible(false);
    } catch (error: any) {
      Alert.alert("Hata", "Yorum güncellenemedi: " + error.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteReview = () => {
    if (!isMyReview || !targetId || isDeletingReview) return;

    Alert.alert(
      "Yorumu sil",
      "Bu yorumu kalıcı olarak silmek istediğine emin misin?",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: async () => {
            setIsDeletingReview(true);
            try {
              const { error } = await supabase
                .from(targetTable)
                .delete()
                .eq("id", targetId)
                .eq("user_id", user?.id);

              if (error) throw error;

              if (targetTable === "reviews") {
                const { error: linkedPostError } = await supabase
                  .from("posts")
                  .delete()
                  .eq("user_id", user?.id)
                  .eq("title", review.title || "")
                  .eq("content", review.comment || "")
                  .eq("car", review.car || "");

                if (linkedPostError) {
                  console.error(
                    "Bağlı gönderi silinemedi:",
                    linkedPostError.message,
                  );
                }
              }

              await refreshReviews();
              router.back();
            } catch (error: any) {
              Alert.alert("Hata", "Yorum silinemedi: " + error.message);
            } finally {
              setIsDeletingReview(false);
            }
          },
        },
      ],
    );
  };

  const handleReviewOptions = () => {
    if (!targetId) return;

    if (isMyReview) {
      Alert.alert("Yorum seçenekleri", undefined, [
        { text: "Düzenle", onPress: () => setIsEditVisible(true) },
        { text: "Sil", style: "destructive", onPress: handleDeleteReview },
        { text: "Vazgeç", style: "cancel" },
      ]);
      return;
    }

    Alert.alert("Yorum seçenekleri", undefined, [
      {
        text: "Şikayet et",
        style: "destructive",
        onPress: () =>
          void reportContent({
            contentType: targetTable === "posts" ? "post" : "review",
            contentId: targetId,
            contentOwnerId: review.userId || null,
          }),
      },
      { text: "Vazgeç", style: "cancel" },
    ]);
  };

  if (!resolvedReview) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: palette.background }]}
        edges={["top"]}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <View
          style={[
            styles.header,
            {
              backgroundColor: palette.background,
              borderBottomColor: palette.border,
            },
          ]}
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <FontAwesome6 name="arrow-left" size={20} color={palette.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: palette.text }]}>
            Yorum Detayı
          </Text>
          <View style={styles.backBtn} />
        </View>

        <View style={styles.notFoundContainer}>
          {!hasCheckedMissingReview ? (
            <ActivityIndicator size="large" color={Colors.orange} />
          ) : (
            <>
              <View
                style={[
                  styles.notFoundIcon,
                  { backgroundColor: palette.card, borderColor: palette.border },
                ]}
              >
                <FontAwesome6
                  name="comment-slash"
                  size={28}
                  color={palette.muted}
                />
              </View>
              <Text style={[styles.notFoundTitle, { color: palette.text }]}>
                Yorum bulunamadı
              </Text>
              <Text style={[styles.notFoundDescription, { color: palette.muted }]}>
                Bu yorum silinmiş olabilir veya bağlantı artık geçerli değil.
              </Text>
              <TouchableOpacity
                style={styles.notFoundButton}
                onPress={() => router.back()}
              >
                <Text style={styles.notFoundButtonText}>Geri Dön</Text>
              </TouchableOpacity>
            </>
          )}
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            { backgroundColor: palette.background, borderBottomColor: palette.border },
          ]}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <FontAwesome6 name="arrow-left" size={20} color={palette.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: palette.text }]}>
            Yorum Detayı
          </Text>
          <TouchableOpacity onPress={handleReviewOptions} style={styles.backBtn}>
            <FontAwesome6 name="ellipsis-vertical" size={18} color={palette.text} />
          </TouchableOpacity>
        </View>

        {/* İçerik & Ana Yorum */}
        <ScrollView
          ref={scrollRef}
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={[
              styles.mainReviewCard,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <TouchableOpacity
              style={styles.expHeader}
              activeOpacity={0.75}
              onPress={() => {
                if (review.userId) router.push(`/user/${review.userId}` as any);
              }}
            >
              {shouldShowAvatarImage ? (
                <Image source={{ uri: displayAvatar }} style={styles.expAvatar} />
              ) : (
                <View
                  style={[
                    styles.expAvatarFallback,
                    { backgroundColor: palette.elevated, borderColor: palette.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.expAvatarFallbackText,
                      { color: palette.text },
                    ]}
                  >
                    {getInitials(reviewUserName)}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.expUser, { color: palette.text }]}>
                  {reviewUserName}
                </Text>
                <Text style={styles.expCarInfo}>{review.car}</Text>
              </View>
              <Text style={[styles.expDate, { color: palette.muted }]}>
                {review.date}
              </Text>
            </TouchableOpacity>

            {/* Genel Puan */}
            {review.rating && (
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <FontAwesome6
                    key={s}
                    name="star"
                    solid={review.rating ? review.rating >= s : false}
                    size={13}
                    color={
                      review.rating && review.rating >= s
                        ? Colors.orange
                        : palette.border
                    }
                  />
                ))}
              </View>
            )}

            {/* Başlık */}
            {review.title && (
              <Text style={[styles.expTitle, { color: palette.text }]}>
                {review.title}
              </Text>
            )}

            <Text style={[styles.expComment, { color: palette.softText }]}>
              {review.comment}
            </Text>

            {/* Artılar / Eksiler */}
            {(review.pros || review.cons) && (
              <View style={styles.prosConsBox}>
                {review.pros && (
                  <Text style={styles.prosText}>
                    <FontAwesome6 name="plus-circle" /> Artıları: {review.pros}
                  </Text>
                )}
                {review.cons && (
                  <Text style={styles.consText}>
                    <FontAwesome6 name="minus-circle" /> Eksileri: {review.cons}
                  </Text>
                )}
              </View>
            )}

            {/* Detaylı Puanlama */}
            {review.detailedRatings &&
              Object.keys(review.detailedRatings).length > 0 && (
                <View
                  style={[
                    styles.detailedGrid,
                    { backgroundColor: palette.elevated, borderColor: palette.border },
                  ]}
                >
                  {Object.entries(review.detailedRatings).map(([key, val]) => (
                    <View key={key} style={styles.detailedRow}>
                      <Text style={[styles.detailedLabel, { color: palette.softText }]}>
                        {key}
                      </Text>
                      <View style={styles.detailedStars}>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <FontAwesome6
                            key={s}
                            name="star"
                            solid={val >= s}
                            size={9}
                            color={val >= s ? Colors.orange : palette.border}
                          />
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              )}

            {/* Araç Kullanım Bilgileri */}
            {(review.buyYear ||
              review.duration ||
              review.km ||
              review.ownership) && (
              <View
                style={[
                  styles.infoGrid,
                  { backgroundColor: palette.elevated, borderColor: palette.border },
                ]}
              >
                {review.buyYear && (
                  <View style={styles.infoBox}>
                    <Text style={[styles.infoLabel, { color: palette.muted }]}>
                      Alınan Yıl
                    </Text>
                    <Text style={[styles.infoValue, { color: palette.text }]}>
                      {review.buyYear}
                    </Text>
                  </View>
                )}
                {review.duration && (
                  <View style={styles.infoBox}>
                    <Text style={[styles.infoLabel, { color: palette.muted }]}>
                      Süre
                    </Text>
                    <Text style={[styles.infoValue, { color: palette.text }]}>
                      {review.duration} Ay
                    </Text>
                  </View>
                )}
                {review.km && (
                  <View style={styles.infoBox}>
                    <Text style={[styles.infoLabel, { color: palette.muted }]}>
                      Kilometre
                    </Text>
                    <Text style={[styles.infoValue, { color: palette.text }]}>
                      {review.km}
                    </Text>
                  </View>
                )}
                {review.ownership && (
                  <View style={styles.infoBox}>
                    <Text style={[styles.infoLabel, { color: palette.muted }]}>
                      Sahiplik
                    </Text>
                    <Text style={[styles.infoValue, { color: palette.text }]}>
                      {review.ownership}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Fotoğraflar */}
            {review.images && review.images.length > 0 && (
              <PhotoCarousel
                images={review.images}
                height={250}
                style={styles.reviewPhotoCarousel}
              />
            )}

            {/* Tavsiye Ediyor Rozeti */}
            {review.recommend && (
              <View style={styles.recommendBadge}>
                <FontAwesome6
                  name="thumbs-up"
                  size={12}
                  color="#4ade80"
                  solid
                />
                <Text style={styles.recommendText}>Tavsiye Ediyor</Text>
              </View>
            )}

            {isMyReview ? (
              <View style={styles.ownerActions}>
                <TouchableOpacity
                  style={[
                    styles.ownerActionBtn,
                    { backgroundColor: palette.elevated, borderColor: palette.border },
                  ]}
                  onPress={() => setIsEditVisible(true)}
                  activeOpacity={0.8}
                >
                  <FontAwesome6 name="pen" size={13} color={Colors.orange} />
                  <Text style={[styles.ownerActionText, { color: palette.text }]}>
                    Düzenle
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.ownerActionBtn,
                    styles.ownerDeleteBtn,
                    { borderColor: "rgba(239, 68, 68, 0.35)" },
                  ]}
                  onPress={handleDeleteReview}
                  activeOpacity={0.8}
                  disabled={isDeletingReview}
                >
                  {isDeletingReview ? (
                    <ActivityIndicator size="small" color="#ef4444" />
                  ) : (
                    <FontAwesome6 name="trash" size={13} color="#ef4444" />
                  )}
                  <Text style={[styles.ownerActionText, { color: "#ef4444" }]}>
                    Sil
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Oy ve Yanıt Aksiyonları */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[
                  styles.helpfulBtn,
                  { backgroundColor: palette.card, borderColor: palette.border },
                  isMyReview && { opacity: 0.5 },
                  hasVoted && {
                    borderColor: Colors.orange,
                    backgroundColor: "rgba(255, 101, 0, 0.1)",
                  },
                ]}
                onPress={handleHelpfulPress}
                activeOpacity={0.7}
                disabled={isMyReview || isVotingHelpful}
              >
                {isVotingHelpful ? (
                  <ActivityIndicator size="small" color={Colors.orange} />
                ) : (
                  <FontAwesome6
                    name="arrow-up"
                    size={14}
                    color={hasVoted ? Colors.orange : palette.text}
                  />
                )}
                <Text
                  style={[
                    styles.helpfulBtnText,
                    { color: palette.text },
                    hasVoted && { color: Colors.orange },
                  ]}
                >
                  {helpfulVotesCount}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.helpfulBtn,
                  { backgroundColor: palette.card, borderColor: palette.border },
                  isMyReview && { opacity: 0.5 },
                  hasDownvotedReview && styles.downvoteBtnActive,
                ]}
                onPress={handleReviewDownvote}
                disabled={isMyReview || isVotingDown}
              >
                {isVotingDown ? (
                  <ActivityIndicator size="small" color="#ef4444" />
                ) : (
                  <FontAwesome6
                    name="arrow-down"
                    size={14}
                    color={hasDownvotedReview ? "#ef4444" : palette.text}
                  />
                )}
                <Text
                  style={[
                    styles.helpfulBtnText,
                    {
                      color: hasDownvotedReview ? "#ef4444" : palette.text,
                    },
                  ]}
                >
                  {reviewDownvotesCount}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.replyActionBtn,
                  { backgroundColor: palette.card, borderColor: palette.border },
                ]}
                onPress={() => focusReplyInput()}
              >
                <FontAwesome6 name="reply" size={13} color={Colors.orange} />
                <Text style={[styles.helpfulBtnText, { color: palette.text }]}>
                  Yanıtla
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Alt Yorumlar Bölümü (Şu anlık boş) */}
          <View style={[styles.divider, { backgroundColor: palette.border }]} />
          <Text style={[styles.repliesTitle, { color: palette.text }]}>
            Cevaplar ({displayComments.length})
          </Text>

          {isLoadingReplies ? (
            <View style={{ paddingVertical: 16 }}>
              <ActivityIndicator size="small" color={Colors.orange} />
            </View>
          ) : displayComments.length > 0 ? (
            displayComments.map((c) => {
              const isOwnReply = Boolean(user?.id && c.user_id === user.id);
              const replyName = isOwnReply && user?.name ? user.name : c.user;
              const replyAvatar = isOwnReply && user?.avatar ? user.avatar : c.avatar;
              const showReplyAvatar = !isGeneratedAvatar(replyAvatar);

              return (
              <View key={c.id} style={styles.replyCommentCard}>
                {showReplyAvatar ? (
                  <Image
                    source={{ uri: replyAvatar }}
                    style={styles.replyCommentAvatar}
                  />
                ) : (
                  <View
                    style={[
                      styles.replyCommentAvatarFallback,
                      { backgroundColor: palette.elevated, borderColor: palette.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.replyCommentAvatarFallbackText,
                        { color: palette.text },
                      ]}
                    >
                      {getInitials(replyName)}
                    </Text>
                  </View>
                )}
                <View style={styles.replyCommentBody}>
                  <View style={styles.replyCommentHeader}>
                    <TouchableOpacity
                      onPress={() => {
                        if (c.user_id) router.push(`/user/${c.user_id}` as any);
                      }}
                    >
                      <Text style={[styles.replyCommentUser, { color: palette.text }]}>
                        {replyName}
                      </Text>
                    </TouchableOpacity>
                    <Text style={[styles.replyCommentDate, { color: palette.muted }]}>
                      {c.created_at
                        ? new Date(c.created_at).toLocaleDateString("tr-TR")
                        : c.date || "Şimdi"}
                    </Text>
                  </View>
                  <Text style={[styles.replyCommentText, { color: palette.softText }]}>
                    {c.content || c.text || c.comment}
                  </Text>
                  <View style={styles.replyActions}>
                    <TouchableOpacity
                      style={styles.replyVoteBtn}
                      onPress={() => handleReplyVote(c, "up")}
                      disabled={isOwnReply}
                    >
                      <FontAwesome6
                        name="arrow-up"
                        size={12}
                        color={
                          upvotedReplyIds.includes(c.id)
                            ? Colors.orange
                            : palette.muted
                        }
                      />
                      <Text
                        style={[
                          styles.replyVoteText,
                          {
                            color: upvotedReplyIds.includes(c.id)
                              ? Colors.orange
                              : palette.muted,
                          },
                        ]}
                      >
                        {Number(c.upvotes || 0)}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.replyVoteBtn}
                      onPress={() => handleReplyVote(c, "down")}
                      disabled={isOwnReply}
                    >
                      <FontAwesome6
                        name="arrow-down"
                        size={12}
                        color={
                          downvotedReplyIds.includes(c.id)
                            ? "#ef4444"
                            : palette.muted
                        }
                      />
                      <Text
                        style={[
                          styles.replyVoteText,
                          {
                            color: downvotedReplyIds.includes(c.id)
                              ? "#ef4444"
                              : palette.muted,
                          },
                        ]}
                      >
                        {Number(c.downvotes || 0)}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.replyVoteBtn}
                      onPress={() => focusReplyInput(replyName)}
                    >
                      <FontAwesome6
                        name="reply"
                        size={12}
                        color={Colors.orange}
                      />
                      <Text style={[styles.replyVoteText, { color: Colors.orange }]}>
                        Yanıtla
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
              );
            })
          ) : (
            <Text style={[styles.emptyRepliesText, { color: palette.muted }]}>
              Bu deneyime ilk yorum yapan siz olun.
            </Text>
          )}
        </ScrollView>

        {/* Yorum Ekleme / Cevaplama Alanı (Alt kısımda sabit) */}
        <View
          style={[
            styles.inputArea,
            {
              backgroundColor: palette.background,
              borderTopColor: palette.border,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          <TextInput
            ref={replyInputRef}
            style={[
              styles.input,
              {
                backgroundColor: palette.card,
                borderColor: palette.border,
                color: palette.text,
              },
            ]}
            placeholder="Yorumunuzu yazın..."
            placeholderTextColor={palette.muted}
            value={replyText}
            onChangeText={setReplyText}
            onFocus={scrollToReplies}
            multiline
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!replyText.trim() || isSendingReply) && {
                backgroundColor: palette.card,
                borderWidth: 1,
                borderColor: palette.border,
              },
            ]}
            disabled={!replyText.trim() || isSendingReply}
            activeOpacity={0.8}
            onPress={handleSendReply}
          >
            {isSendingReply ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <FontAwesome6
                name="paper-plane"
                size={16}
                color={replyText.trim() ? Colors.white : palette.muted}
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={isEditVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEditVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            style={styles.editKeyboardAvoiding}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 18 : 0}
          >
            <View
              style={[
                styles.editModal,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
            >
              <View style={styles.editModalHeader}>
                <Text style={[styles.editModalTitle, { color: palette.text }]}>
                  Yorumu Düzenle
                </Text>
                <TouchableOpacity onPress={() => setIsEditVisible(false)}>
                  <FontAwesome6 name="xmark" size={18} color={palette.muted} />
                </TouchableOpacity>
              </View>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.editModalScroll}
              >
                <TextInput
                  style={[
                    styles.editInput,
                    {
                      backgroundColor: palette.elevated,
                      borderColor: palette.border,
                      color: palette.text,
                    },
                  ]}
                  value={editTitle}
                  onChangeText={setEditTitle}
                  placeholder="Başlık"
                  placeholderTextColor={palette.muted}
                  returnKeyType="next"
                />
                <TextInput
                  style={[
                    styles.editInput,
                    styles.editTextarea,
                    {
                      backgroundColor: palette.elevated,
                      borderColor: palette.border,
                      color: palette.text,
                    },
                  ]}
                  value={editComment}
                  onChangeText={setEditComment}
                  placeholder="Deneyimin"
                  placeholderTextColor={palette.muted}
                  multiline
                  textAlignVertical="top"
                />

                {targetTable === "reviews" ? (
                  <View style={styles.editStarsRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <TouchableOpacity
                        key={star}
                        onPress={() => setEditRating(star)}
                        hitSlop={8}
                      >
                        <FontAwesome6
                          name="star"
                          size={20}
                          solid={editRating >= star}
                          color={editRating >= star ? Colors.orange : palette.border}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </ScrollView>

              <View style={[styles.editModalActions, { borderTopColor: palette.border }]}>
                <TouchableOpacity
                  style={[
                    styles.editCancelBtn,
                    { borderColor: palette.border },
                  ]}
                  onPress={() => setIsEditVisible(false)}
                >
                  <Text style={[styles.editCancelText, { color: palette.text }]}>
                    Vazgeç
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.editSaveBtn}
                  onPress={handleSaveEdit}
                  disabled={isSavingEdit}
                >
                  {isSavingEdit ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Text style={styles.editSaveText}>Kaydet</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
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
  notFoundContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  notFoundIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  notFoundTitle: {
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  notFoundDescription: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 7,
    marginBottom: 22,
  },
  notFoundButton: {
    minWidth: 150,
    backgroundColor: Colors.orange,
    borderRadius: 13,
    alignItems: "center",
    paddingHorizontal: 22,
    paddingVertical: 13,
  },
  notFoundButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: "800",
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: Colors.white },
  content: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 28 },
  mainReviewCard: {
    backgroundColor: Colors.navyCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    marginBottom: 20,
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
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  expAvatarFallbackText: {
    fontSize: 12,
    fontWeight: "900",
  },
  expUser: { fontSize: 14, fontWeight: "700", color: Colors.white },
  expCarInfo: { fontSize: 11, color: Colors.orange, fontWeight: "600" },
  expDate: { fontSize: 10, color: Colors.textMuted },
  starsRow: { flexDirection: "row", gap: 4, marginBottom: 12 },
  expTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.white,
    marginBottom: 8,
  },
  expComment: { fontSize: 14, color: Colors.gray300, lineHeight: 22 },
  prosConsBox: { marginTop: 16, gap: 8 },
  prosText: { color: "#4ade80", fontSize: 13, fontWeight: "500" },
  consText: { color: "#f87171", fontSize: 13, fontWeight: "500" },
  detailedGrid: {
    marginTop: 16,
    gap: 10,
    backgroundColor: Colors.navyMain,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  detailedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailedLabel: { color: Colors.gray300, fontSize: 12 },
  detailedStars: { flexDirection: "row", gap: 4 },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 16,
    gap: 12,
    backgroundColor: Colors.navyMain,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  infoBox: { minWidth: "40%" },
  infoLabel: { color: Colors.textMuted, fontSize: 10, marginBottom: 2 },
  infoValue: { color: Colors.white, fontSize: 12, fontWeight: "600" },
  reviewPhotoCarousel: { marginTop: 16 },
  recommendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(34,197,94,0.15)",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 16,
  },
  recommendText: { color: "#4ade80", fontSize: 12, fontWeight: "bold" },
  ownerActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  ownerActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  ownerDeleteBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  ownerActionText: {
    fontSize: 13,
    fontWeight: "800",
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: Colors.navyBorder,
    paddingTop: 16,
  },
  helpfulBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.navyCard,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
  },
  helpfulBtnText: { color: Colors.white, fontSize: 13, fontWeight: "600" },
  downvoteBtnActive: {
    borderColor: "#ef4444",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  replyActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  divider: { height: 1, backgroundColor: Colors.navyBorder, marginBottom: 20 },
  repliesTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.white,
    marginBottom: 12,
  },
  emptyRepliesText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 20,
  },
  inputArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.navyBorder,
    backgroundColor: Colors.navyMain,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.navyCard,
    borderWidth: 1,
    borderColor: Colors.navyBorder,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    maxHeight: 100,
    color: Colors.white,
    fontSize: 14,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.orange,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
    marginBottom: 2,
  },
  replyCommentCard: { flexDirection: "row", marginBottom: 16 },
  replyCommentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
    backgroundColor: Colors.navyBorder,
  },
  replyCommentAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  replyCommentAvatarFallbackText: {
    fontSize: 11,
    fontWeight: "900",
  },
  replyCommentBody: { flex: 1 },
  replyCommentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  replyCommentUser: { color: Colors.white, fontWeight: "700", fontSize: 13 },
  replyCommentDate: { color: Colors.textMuted, fontSize: 11 },
  replyCommentText: { color: Colors.gray300, fontSize: 13, lineHeight: 20 },
  replyActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 8,
  },
  replyVoteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 28,
  },
  replyVoteText: {
    fontSize: 11,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  editKeyboardAvoiding: {
    width: "100%",
    maxHeight: "88%",
  },
  editModal: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    maxHeight: "100%",
  },
  editModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: "900",
  },
  editInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 12,
  },
  editTextarea: {
    minHeight: 150,
    maxHeight: 230,
    textAlignVertical: "top",
  },
  editModalScroll: {
    paddingHorizontal: 18,
    paddingBottom: 4,
  },
  editStarsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  editModalActions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
    borderTopWidth: 1,
    padding: 14,
  },
  editCancelBtn: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  editCancelText: {
    fontSize: 14,
    fontWeight: "800",
  },
  editSaveBtn: {
    minHeight: 44,
    minWidth: 96,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: Colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  editSaveText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: "900",
  },
});
