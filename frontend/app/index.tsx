import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";

import { useAuth } from "@/src/contexts/AuthContext";
import { useTheme } from "@/src/contexts/ThemeContext";
import { FynoraLogo } from "@/src/components/ui";
import { storage } from "@/src/utils/storage";

export default function Index() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    (async () => {
      if (!user) {
        const onb = await storage.getItem<string>("fynora_onboarded", "");
        if (!onb) {
          router.replace("/onboarding" as any);
        } else {
          router.replace("/(auth)/login" as any);
        }
      } else {
        router.replace("/(tabs)" as any);
      }
    })();
  }, [loading, user, router]);

  return (
    <View
      testID="splash-screen"
      style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg, gap: 16 }}
    >
      <FynoraLogo size={92} />
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}
