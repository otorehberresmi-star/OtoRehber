import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const preferenceKey = (userId: string) => {
  const safeUserId = userId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `otorehber.biometric-lock.${safeUserId}`;
};

export const getBiometricAvailability = async () => {
  if (Platform.OS === "web") return false;

  const [hasHardware, isEnrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);

  return hasHardware && isEnrolled;
};

export const getBiometricPreference = async (userId: string) => {
  if (Platform.OS === "web") return false;
  return (await SecureStore.getItemAsync(preferenceKey(userId))) === "true";
};

export const saveBiometricPreference = async (
  userId: string,
  enabled: boolean,
) => {
  if (Platform.OS === "web") return;

  if (enabled) {
    await SecureStore.setItemAsync(preferenceKey(userId), "true");
  } else {
    await SecureStore.deleteItemAsync(preferenceKey(userId));
  }
};

export const authenticateWithBiometrics = async (promptMessage: string) => {
  if (Platform.OS === "web") return false;

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: "Vazgeç",
    fallbackLabel: "Cihaz şifresini kullan",
    disableDeviceFallback: false,
  });

  return result.success;
};
