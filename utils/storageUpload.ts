import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "../supabaseClient";
import { secureApi } from "./secureApi";

export const PUBLIC_CONTENT_BUCKET = "public-content-images";
export const PRIVATE_USER_BUCKET = "private-user-images";

type UploadVisibility = "public" | "private";

const isRemoteUri = (uri: string) =>
  uri.startsWith("http://") ||
  uri.startsWith("https://") ||
  uri.startsWith("private://");

const getFileExtension = (uri: string) => {
  const cleanUri = uri.split("?")[0] || "";
  const match = cleanUri.match(/\.([a-zA-Z0-9]+)$/);
  return (match?.[1] || "jpg").toLowerCase();
};

const getContentType = (extension: string) => {
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  return "image/jpeg";
};

export async function uploadFile(
  uri: string,
  userId: string,
  folder: string,
  visibility: UploadVisibility = "public",
  base64?: string | null,
  mimeType?: string | null,
) {
  if (!uri || isRemoteUri(uri)) return uri;

  const bucket =
    visibility === "private" ? PRIVATE_USER_BUCKET : PUBLIC_CONTENT_BUCKET;
  const extension = getFileExtension(uri);
  const contentType = mimeType?.startsWith("image/")
    ? mimeType
    : getContentType(extension);
  const fileName = `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${extension}`;
  const path = `${userId}/${folder}/${fileName}`;
  const fileBase64 =
    base64 ||
    (await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    }));
  const arrayBuffer = decode(fileBase64.replace(/\s/g, ""));

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, arrayBuffer, {
      contentType,
      upsert: false,
    });

  if (error) throw error;

  if (visibility === "private") {
    return `private://${bucket}/${path}`;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadFiles(
  uris: string[],
  userId: string,
  folder: string,
  visibility: UploadVisibility = "public",
) {
  const uploaded: string[] = [];

  for (const uri of uris) {
    uploaded.push(await uploadFile(uri, userId, folder, visibility));
  }

  return uploaded;
}

export const uploadPublicFile = (
  uri: string,
  userId: string,
  folder: string,
  base64?: string | null,
  mimeType?: string | null,
) => uploadFile(uri, userId, folder, "public", base64, mimeType);

export const uploadPublicFiles = (
  uris: string[],
  userId: string,
  folder: string,
) => uploadFiles(uris, userId, folder, "public");

export const uploadPrivateFile = (
  uri: string,
  userId: string,
  folder: string,
) => uploadFile(uri, userId, folder, "private");

export const uploadPrivateFiles = (
  uris: string[],
  userId: string,
  folder: string,
) => uploadFiles(uris, userId, folder, "private");

export async function resolvePrivateFileUrl(uri?: string | null) {
  if (!uri?.startsWith("private://")) return uri || "";

  const withoutScheme = uri.replace("private://", "");
  const [bucket, ...pathParts] = withoutScheme.split("/");
  const path = pathParts.join("/");

  if (!bucket || !path) return "";

  try {
    const data = await secureApi<{ signedUrl: string }>(
      "storage/private-signed-url",
      {
        body: {
          bucket,
          path,
          expires_in: 60 * 30,
        },
      },
    );

    return data.signedUrl;
  } catch (error: any) {
    console.error("Özel görsel URL'i oluşturulamadı:", error?.message || error);
    return "";
  }
}

export async function resolvePrivateFileUrls(uris: string[] = []) {
  return Promise.all(uris.map((uri) => resolvePrivateFileUrl(uri)));
}
