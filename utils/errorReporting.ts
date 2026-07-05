import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";
import type { ComponentType } from "react";

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
const isProduction = process.env.NODE_ENV === "production";
let initialized = false;

export function initErrorReporting() {
  if (!sentryDsn || initialized) return;

  Sentry.init({
    dsn: sentryDsn,
    environment: isProduction ? "production" : "development",
    release: `${Constants.expoConfig?.slug || "otorehber"}@${
      Constants.expoConfig?.version || "0.0.0"
    }`,
    enableAutoSessionTracking: true,
    tracesSampleRate: isProduction ? 0.1 : 1,
  });

  initialized = true;
}

export function reportError(error: unknown, context?: Record<string, unknown>) {
  if (!initialized) return;

  Sentry.captureException(error, {
    extra: context,
  });
}

export const withErrorReporting = <T extends ComponentType<any>>(
  component: T,
) => (initialized ? Sentry.wrap(component) : component);
