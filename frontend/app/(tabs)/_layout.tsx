import React, { useEffect } from "react";
import { Platform } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";

import { useTheme } from "@/src/contexts/ThemeContext";
import { useAuth } from "@/src/contexts/AuthContext";
import { api } from "@/src/lib/api";
import { t } from "@/src/lib/i18n";

async function registerForPush(_userId: string) {
  if (Platform.OS === "web") return;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return;
    const tok = await Notifications.getDevicePushTokenAsync();
    await api("/register-push", {
      method: "POST",
      body: JSON.stringify({ platform: Platform.OS, device_token: tok.data }),
    });
  } catch {
    // silent — push will work after deploy/build
  }
}

export default function TabsLayout() {
  const { colors, language } = useTheme();
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/(auth)/login" as any);
  }, [loading, user, router]);

  useEffect(() => {
    if (user) registerForPush(user.user_id);
  }, [user]);

  return (
    <Tabs
      key={language}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: Platform.OS === "ios" ? 86 : 66,
          paddingTop: 8,
          paddingBottom: Platform.OS === "ios" ? 26 : 10,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tab_home", language),
          tabBarIcon: ({ color, size }) => <MaterialIcons name="home" size={size} color={color} />,
          tabBarButtonTestID: "tab-home",
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: t("tab_txns", language),
          tabBarIcon: ({ color, size }) => <MaterialIcons name="swap-horiz" size={size} color={color} />,
          tabBarButtonTestID: "tab-transactions",
        }}
      />
      <Tabs.Screen
        name="budgets"
        options={{
          title: t("tab_budgets", language),
          tabBarIcon: ({ color, size }) => <MaterialIcons name="pie-chart" size={size} color={color} />,
          tabBarButtonTestID: "tab-budgets",
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: t("tab_insights", language),
          tabBarIcon: ({ color, size }) => <MaterialIcons name="auto-awesome" size={size} color={color} />,
          tabBarButtonTestID: "tab-insights",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tab_profile", language),
          tabBarIcon: ({ color, size }) => <MaterialIcons name="person" size={size} color={color} />,
          tabBarButtonTestID: "tab-profile",
        }}
      />
    </Tabs>
  );
}
