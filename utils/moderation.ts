import { Alert } from "react-native";
import { supabase } from "../supabaseClient";

export type ReportContentType = "post" | "review" | "comment";

export async function reportContent({
  contentType,
  contentId,
  contentOwnerId,
  reason = "Uygunsuz içerik",
  details,
}: {
  contentType: ReportContentType;
  contentId: string;
  contentOwnerId?: string | null;
  reason?: string;
  details?: string | null;
}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user?.id) {
    Alert.alert("Giriş gerekli", "İçerik şikayet etmek için lütfen giriş yapın.");
    return false;
  }

  await supabase.from("profiles").upsert({
    id: session.user.id,
    display_name:
      session.user.user_metadata?.display_name ||
      session.user.user_metadata?.full_name ||
      session.user.email?.split("@")[0] ||
      "Kullanıcı",
    avatar_url: session.user.user_metadata?.avatar_url || null,
  });

  const { error } = await supabase.from("content_reports").insert({
    reporter_id: session.user.id,
    content_type: contentType,
    content_id: contentId,
    content_owner_id: contentOwnerId || null,
    reason,
    details: details || null,
  });

  if (error) {
    const alreadyReported =
      error.code === "23505" ||
      error.message.toLocaleLowerCase("tr-TR").includes("duplicate");

    if (alreadyReported) {
      Alert.alert("Şikayet zaten alındı", "Bu içeriği daha önce bildirmişsin.");
      return false;
    }

    Alert.alert("Hata", "Şikayet kaydedilemedi: " + error.message);
    return false;
  }

  Alert.alert(
    "Şikayet alındı",
    "Bildirim moderasyon kuyruğuna eklendi. Ekibimiz inceleyecek.",
  );
  return true;
}
