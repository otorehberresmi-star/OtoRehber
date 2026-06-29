import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { Tabs, useRouter } from "expo-router";
import React from "react";

import { useClientOnlyValue } from "@/components/useClientOnlyValue";
import Colors from "@/constants/Colors";
import { useAuth } from "../../contexts/AuthContext";
import { useAppTheme } from "../../contexts/ThemeContext";
import { loginRoute } from "../../utils/authRedirect";

// You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome6>["name"];
  color: string;
}) {
  return (
    <FontAwesome6 size={20} style={{ marginBottom: -3 }} solid {...props} />
  );
}

export default function TabLayout() {
  const { effectiveTheme, palette } = useAppTheme();
  const router = useRouter();
  const { isAuthReady, isLoggedIn } = useAuth();

  const requireAuth = (returnTo: string) => (e: any) => {
    if (!isAuthReady) {
      e.preventDefault();
      return;
    }

    if (!isLoggedIn) {
      // Güncel oturum yoksa sekme değişimini (navigasyon) durdur
      e.preventDefault();
      // React Navigation'un eventi iptal etmesi ile yeni sayfa açması arasındaki çakışmayı önler
      setTimeout(() => {
        router.push(loginRoute(returnTo) as any);
      }, 10);
    }
  };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.orange,
        tabBarInactiveTintColor: palette.muted,
        // Disable the static render of the header on web
        // to prevent a hydration error in React Navigation v6.
        headerShown: useClientOnlyValue(false, true),
        tabBarStyle: {
          backgroundColor: palette.card,
          borderTopColor: palette.border,
        },
        tabBarLabelStyle: { fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Keşfet",
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="compass" color={color} />
          ),
        }}
      />
      <Tabs.Screen name="garage" options={{ href: null, headerShown: false }} />
      <Tabs.Screen
        name="communities"
        options={{
          title: "Topluluklar",
          headerShown: false,
          tabBarIcon: ({ color }) => <TabBarIcon name="users" color={color} />,
        }}
        listeners={{ tabPress: requireAuth("/communities") }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          headerShown: false,
          tabBarIcon: ({ color }) => <TabBarIcon name="user" color={color} />,
        }}
        listeners={{ tabPress: requireAuth("/profile") }}
      />
    </Tabs>
  );
}
