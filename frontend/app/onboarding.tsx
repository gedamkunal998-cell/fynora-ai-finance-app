import React, { useRef, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";

import { useTheme } from "@/src/contexts/ThemeContext";
import { storage } from "@/src/utils/storage";
import { FynoraLogo, GradientButton, GhostButton } from "@/src/components/ui";
import { gradients, spacing } from "@/src/lib/theme";
import { LinearGradient } from "expo-linear-gradient";
import { t } from "@/src/lib/i18n";

const { width } = Dimensions.get("window");

export default function Onboarding() {
  const { colors, language } = useTheme();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  const slides = [
    {
      icon: "auto-awesome" as const,
      title: t("onb_1_title", language),
      sub: t("onb_1_sub", language),
      grad: gradients.secondary,
    },
    {
      icon: "sms" as const,
      title: t("onb_2_title", language),
      sub: t("onb_2_sub", language),
      grad: gradients.primary,
    },
    {
      icon: "rocket-launch" as const,
      title: t("onb_3_title", language),
      sub: t("onb_3_sub", language),
      grad: gradients.danger,
    },
  ];

  const finish = async () => {
    await storage.setItem("fynora_onboarded", "1");
    router.replace("/(auth)/login" as any);
  };

  const next = () => {
    if (page < slides.length - 1) {
      scrollRef.current?.scrollTo({ x: (page + 1) * width, animated: true });
      setPage(page + 1);
    } else {
      finish();
    }
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / width);
    if (p !== page) setPage(p);
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
        <FynoraLogo size={32} />
        <TouchableOpacity testID="onb-skip" onPress={finish} hitSlop={10}>
          <Text style={{ color: colors.textMuted, fontWeight: "700" }}>{t("skip", language)}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {slides.map((s, i) => (
          <View key={i} testID={`onb-slide-${i}`} style={{ width, paddingHorizontal: spacing.lg, gap: spacing.lg, justifyContent: "center" }}>
            <LinearGradient colors={s.grad as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ alignSelf: "center", width: 200, height: 200, borderRadius: 100, alignItems: "center", justifyContent: "center" }}>
              <MaterialIcons name={s.icon} size={80} color="#fff" />
            </LinearGradient>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 26, textAlign: "center" }}>{s.title}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 15, textAlign: "center", lineHeight: 22, paddingHorizontal: 12 }}>{s.sub}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: spacing.md }}>
        {slides.map((_, i) => (
          <View key={i} style={{ width: i === page ? 28 : 8, height: 8, borderRadius: 4, backgroundColor: i === page ? colors.primary : colors.border }} />
        ))}
      </View>
      <View style={{ paddingHorizontal: spacing.lg, gap: 8, paddingBottom: spacing.md }}>
        <GradientButton testID="onb-next" label={page === slides.length - 1 ? t("get_started", language) : t("next", language)} onPress={next} icon={page === slides.length - 1 ? "rocket-launch" : "arrow-forward"} />
        {page < slides.length - 1 ? <GhostButton testID="onb-skip-bottom" label={t("skip", language)} onPress={finish} /> : null}
      </View>
    </SafeAreaView>
  );
}
