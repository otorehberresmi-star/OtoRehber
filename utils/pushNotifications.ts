import Constants from "expo-constants";
import { Platform } from "react-native";
import { secureApi } from "./secureApi";

type ExpoNotifications = typeof import("expo-notifications");

let notificationsModulePromise: Promise<ExpoNotifications | null> | null = null;
let notificationHandlerConfigured = false;

const isExpoGoAndroid = () =>
  Platform.OS === "android" &&
  Constants.executionEnvironment === "storeClient";

const getNotificationsModule = async () => {
  if (Platform.OS === "web" || isExpoGoAndroid()) return null;

  notificationsModulePromise ??= import("expo-notifications")
    .then((module) => {
      if (!notificationHandlerConfigured) {
        module.setNotificationHandler({
          handleNotification: async () => ({
            shouldPlaySound: false,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });
        notificationHandlerConfigured = true;
      }
      return module;
    })
    .catch((error) => {
      console.warn(
        "Push bildirim modülü yüklenemedi:",
        error?.message || error,
      );
      return null;
    });

  return notificationsModulePromise;
};

const getProjectId = () =>
  Constants.expoConfig?.extra?.eas?.projectId ||
  Constants.easConfig?.projectId ||
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
  null;

type PushRegistrationUser = {
  id: string;
  name?: string | null;
  avatar?: string | null;
};

export async function registerPushTokenForUser(user: PushRegistrationUser) {
  if (!user.id || Platform.OS === "web") return;

  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "OtoRehber",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId = getProjectId();
  if (!projectId) {
    console.warn(
      "Expo projectId bulunamadı. Push token üretimi için EAS projectId app.json extra.eas.projectId alanına eklenmeli.",
    );
  }

  const tokenResult = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();

  const expoPushToken = tokenResult.data;
  if (!expoPushToken) return;

  try {
    await secureApi<{ ok: true }>("push-tokens/register", {
      body: {
        expo_push_token: expoPushToken,
        platform: Platform.OS,
        display_name: user.name || "Sürücü",
        avatar_url: user.avatar || null,
      },
    });
  } catch (error: any) {
    const message = error?.message || "";
    const isMissingSchema =
      message.includes("push_tokens") ||
      message.includes("schema cache") ||
      message.includes("Could not find");

    if (!isMissingSchema) {
      console.warn("Push token kaydedilemedi:", message);
    }
  }
}
