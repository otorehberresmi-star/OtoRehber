import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";
import { appPalettes } from "../constants/Colors";

export type ThemePreference = "system" | "light" | "dark";
export type EffectiveTheme = "light" | "dark";

type AppThemeContextType = {
  preference: ThemePreference;
  effectiveTheme: EffectiveTheme;
  palette: (typeof appPalettes)[EffectiveTheme];
  setPreference: (preference: ThemePreference) => Promise<void>;
};

const STORAGE_KEY = "otorehber.themePreference";

const AppThemeContext = createContext<AppThemeContextType | null>(null);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] =
    useState<ThemePreference>("system");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === "light" || stored === "dark" || stored === "system") {
        setPreferenceState(stored);
      }
    });
  }, []);

  const effectiveTheme: EffectiveTheme =
    preference === "system"
      ? systemScheme === "light"
        ? "light"
        : "dark"
      : preference;

  const setPreference = useCallback(async (nextPreference: ThemePreference) => {
    setPreferenceState(nextPreference);
    await AsyncStorage.setItem(STORAGE_KEY, nextPreference);
  }, []);

  const value = useMemo(
    () => ({
      preference,
      effectiveTheme,
      palette: appPalettes[effectiveTheme],
      setPreference,
    }),
    [effectiveTheme, preference, setPreference],
  );

  return (
    <AppThemeContext.Provider value={value}>
      {children}
    </AppThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(AppThemeContext);
  if (!context) {
    throw new Error("useAppTheme must be used within AppThemeProvider");
  }
  return context;
}
