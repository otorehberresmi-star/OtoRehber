import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../supabaseClient";

export interface Review {
  id: string;
  sourceId?: string;
  sourceType?: "review" | "post";
  userId?: string | null;
  user: string;
  brand: string;
  car: string;
  comment: string;
  date: string;
  avatar: string;
  title?: string;
  rating?: number;
  detailedRatings?: Record<string, number>;
  buyYear?: string;
  duration?: string;
  km?: string;
  ownership?: string;
  pros?: string;
  cons?: string;
  images?: string[];
  recommend?: boolean;
  helpfulVotes?: number;
  downvotes?: number;
  upvotedBy?: string[];
  commentsList?: any[];
  createdAt?: string;
}

interface ReviewContextType {
  reviews: Review[];
  isLoading: boolean;
  addReview: (review: Review) => void;
  refreshReviews: () => Promise<void>;
  voteHelpful: (id: string, userId: string) => Promise<void>;
  addCommentToReview: (reviewId: string, comment: any) => void;
}

const ReviewContext = createContext<ReviewContextType>({
  reviews: [],
  isLoading: true,
  addReview: () => {},
  refreshReviews: async () => {},
  voteHelpful: async () => {},
  addCommentToReview: () => {},
});

const mapSupabaseReview = (item: any): Review => ({
  id: item.id,
  sourceId: item.id,
  sourceType: "review",
  userId: item.user_id || null,
  user: item.user || "Sürücü",
  brand: item.brand || "",
  car: item.car || item.brand || "Araç",
  comment: item.comment || "",
  date: item.date || "Yeni",
  avatar: item.avatar || "",
  title: item.title || undefined,
  rating: item.rating ? Number(item.rating) : undefined,
  detailedRatings: item.detailed_ratings || undefined,
  buyYear: item.buy_year || undefined,
  duration: item.duration || undefined,
  km: item.km || undefined,
  ownership: item.ownership || undefined,
  pros: item.pros || undefined,
  cons: item.cons || undefined,
  images: Array.isArray(item.images) ? item.images : undefined,
  recommend: item.recommend ?? undefined,
  helpfulVotes: item.helpful_votes || 0,
  createdAt: item.created_at || undefined,
});

const mapSupabasePost = (
  item: any,
  modelNamesById: Record<string, string> = {},
): Review => ({
  id: `post:${item.id}`,
  sourceId: item.id,
  sourceType: "post",
  userId: item.user_id || null,
  user: item.user || "Sürücü",
  brand: "",
  car:
    item.car ||
    (item.model_id ? modelNamesById[item.model_id] : "") ||
    "Araç bilgisi eklenmemiş",
  comment: item.content || "",
  date: item.created_at
    ? new Date(item.created_at).toLocaleDateString("tr-TR")
    : "Yeni",
  avatar: item.avatar || "",
  title: item.title || undefined,
  helpfulVotes: item.upvotes || 0,
  createdAt: item.created_at || undefined,
});

export function ReviewProvider({ children }: { children: React.ReactNode }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshReviews = useCallback(async () => {
    setIsLoading(true);
    try {
      const [reviewsResult, postsResult] = await Promise.all([
      supabase
        .from("reviews")
        .select(
          "id,user_id,user,brand,car,comment,date,avatar,title,rating,detailed_ratings,buy_year,duration,km,ownership,pros,cons,images,recommend,helpful_votes,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(30),
        supabase
          .from("posts")
          .select(
            "id,user,avatar,car,title,content,upvotes,created_at,user_id,model_id,community_id",
          )
          .not("user_id", "is", null)
          .is("community_id", null)
          .order("created_at", { ascending: false })
          .limit(30),
    ]);

      if (reviewsResult.error) {
        console.error("Son deneyimler alınamadı:", reviewsResult.error.message);
        return;
      }

      if (postsResult.error) {
        console.error(
          "Topluluk deneyimleri alınamadı:",
          postsResult.error.message,
        );
      }

      const modelIds = Array.from(
      new Set(
        (postsResult.data || [])
          .map((item: any) => item.model_id)
          .filter(Boolean),
      ),
    );
      let modelNamesById: Record<string, string> = {};

      if (modelIds.length > 0) {
      const { data: modelRows, error: modelLookupError } = await supabase
        .from("models")
        .select("id, name, brands(name)")
        .in("id", modelIds);

      if (modelLookupError) {
        console.error(
          "Son deneyim araç bilgisi alınamadı:",
          modelLookupError.message,
        );
      } else {
        modelNamesById = (modelRows || []).reduce(
          (acc: Record<string, string>, model: any) => {
            const brandName = model.brands?.name || "";
            const modelName = model.name || "";
            acc[model.id] = `${brandName} ${modelName}`.trim();
            return acc;
          },
          {},
        );
      }
    }

      const combined = [
      ...(reviewsResult.data || []).map(mapSupabaseReview),
      ...(postsResult.data || []).map((item: any) =>
        mapSupabasePost(item, modelNamesById),
      ),
    ]
      .filter((item) => item.title || item.comment)
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });
      const seen = new Set<string>();
      const unique = combined.filter((item) => {
      const signature = [item.user, item.car, item.title, item.comment]
        .map((value) => (value || "").trim().toLocaleLowerCase("tr-TR"))
        .join("|");

      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    });

      setReviews(unique.slice(0, 30));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshReviews();
  }, [refreshReviews]);


  const addReview = useCallback((review: Review) => {
    setReviews((prev) => [review, ...prev]);
  }, []);

  const voteHelpful = useCallback(async (id: string, userId: string) => {
    if (!id || !userId || userId === "guest") return;

    const currentReview = reviews.find((review) => review.id === id);
    if (!currentReview?.sourceId) return;

    const rpcName =
      currentReview.sourceType === "post"
        ? "toggle_post_vote"
        : "toggle_review_helpful_vote";
    const rpcParams =
      currentReview.sourceType === "post"
        ? { p_post_id: currentReview.sourceId }
        : { p_review_id: currentReview.sourceId };

    const { data, error } = await supabase.rpc(rpcName, rpcParams);

    if (error) {
      console.error("Faydalı oy kaydedilemedi:", error.message);
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    const isVoted = Boolean(result?.is_voted);
    const nextHelpfulVotes = Number(
      currentReview.sourceType === "post"
        ? result?.upvotes || 0
        : result?.helpful_votes || 0,
    );

    setReviews((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const upvotedBy = r.upvotedBy || [];
          if (!isVoted) {
            return {
              ...r,
              helpfulVotes: nextHelpfulVotes,
              upvotedBy: upvotedBy.filter((uid) => uid !== userId),
            };
          }

          return {
            ...r,
            helpfulVotes: nextHelpfulVotes,
            upvotedBy: upvotedBy.includes(userId)
              ? upvotedBy
              : [...upvotedBy, userId],
          };
        }
        return r;
      }),
    );
  }, [reviews]);

  const addCommentToReview = useCallback((reviewId: string, comment: any) => {
    setReviews((prev) =>
      prev.map((r) =>
        r.id === reviewId
          ? { ...r, commentsList: [...(r.commentsList || []), comment] }
          : r,
      ),
    );
  }, []);

  const value = useMemo(
    () => ({
      reviews,
      isLoading,
      addReview,
      refreshReviews,
      voteHelpful,
      addCommentToReview,
    }),
    [
      addCommentToReview,
      addReview,
      isLoading,
      refreshReviews,
      reviews,
      voteHelpful,
    ],
  );

  return (
    <ReviewContext.Provider value={value}>
      {children}
    </ReviewContext.Provider>
  );
}

export const useReviews = () => useContext(ReviewContext);
