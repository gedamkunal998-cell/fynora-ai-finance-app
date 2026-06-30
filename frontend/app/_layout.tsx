import React, { useEffect } from "react";
import { Platform, LogBox } from "react-native";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import * as Linking from "expo-linking";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { AuthProvider } from "@/src/contexts/AuthContext";
import { ThemeProvider, useTheme } from "@/src/contexts/ThemeContext";
import { useIconFonts } from "@/src/hooks/use-icon-fonts";

LogBox.ignoreAllLogs(true);
// Mute deprecated pointerEvents warning emitted by transitive react-native-web internals
LogBox.ignoreLogs?.([
  "props.pointerEvents is deprecated",
  "shadow*",
]);

// Module-scope push setup (per playbook)
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
  });
}

SplashScreen.preventAutoHideAsync();

function StatusBarThemed() {
  const { mode } = useTheme();
  return <StatusBar style={mode === "dark" ? "light" : "dark"} />;
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();
  const router = useRouter();

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    // Only allow deeplinks to in-app routes (start with "/") OR https URLs whose
    // host we explicitly trust. Drops anything else so a malicious notification
    // cannot open arbitrary content.
    const ALLOWED_HOSTS = ["fynora.app", "preview.emergentagent.com"];
    const open = (url: string) => {
      if (!url || typeof url !== "string") return;
      if (url.startsWith("/")) {
        router.push(url as any);
        return;
      }
      try {
        const u = new URL(url);
        if (u.protocol === "https:" && ALLOWED_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith("." + h))) {
          Linking.openURL(url);
        }
      } catch {
        // ignore malformed url
      }
    };
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const data = (resp.notification.request.content.data || {}) as any;
      open(data.deeplink || data.action_url);
    });
    Notifications.getLastNotificationResponseAsync().then((resp) => {
      if (!resp) return;
      const data = (resp.notification.request.content.data || {}) as any;
      open(data.deeplink || data.action_url);
    });
    return () => {
      sub.remove();
    };
  }, [router]);

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <StatusBarThemed />
          <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
            <Stack.Screen name="add-transaction" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
            <Stack.Screen name="add-budget" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
            <Stack.Screen name="add-goal" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
          </Stack>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
