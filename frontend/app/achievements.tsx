import React, { useCallback, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";

import { useTheme } from "@/src/contexts/ThemeContext";
import { api } from "@/src/lib/api";
import { Card, ScreenHeader } from "@/src/components/ui";
import { spacing } from "@/src/lib/theme";
import { t } from "@/src/lib/i18n";

const TITLE_KEY: Record<string, string> = {
  budget_master: "badge_budget_master",
  savings_hero: "badge_savings_hero",
  no_spend_7: "badge_no_spend_7",
  no_spend_30: "badge_no_spend_30",
  expense_controller: "badge_expense_controller",
  goal_achiever: "badge_goal_achiever",
};

export default function Achievements() {
  const { colors, language } = useTheme();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const load = useCallback(async () => {
    try { setItems(await api<any[]>("/achievements")); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const unlockedCount = items.filter((b) => b.unlocked).length;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title={t("achievements_title", language)}
        back
        onBack={() => router.back()}
        subtitle={t("unlocked_of", language, { a: unlockedCount, b: items.length })}
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100, gap: 10 }}>
        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          {items.map((b) => {
            const baseKey = TITLE_KEY[b.badge_id];
            const title = baseKey ? t(`${baseKey}_title`, language) : b.title;
            const desc = baseKey ? t(`${baseKey}_desc`, language) : b.description;
            return (
              <Card key={b.badge_id} testID={`badge-${b.badge_id}`} style={{ width: "47%", opacity: b.unlocked ? 1 : 0.55 }}>
                <View style={{ alignItems: "center", gap: 8 }}>
                  <View
                    style={{
                      width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center",
                      backgroundColor: b.unlocked ? `${colors.primary}22` : colors.surfaceAlt,
                      borderWidth: 2, borderColor: b.unlocked ? colors.primary : colors.border,
                    }}
                  >
                    <MaterialIcons name={(b.icon || "emoji-events") as any} size={32} color={b.unlocked ? colors.primary : colors.textMuted} />
                  </View>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13, textAlign: "center" }}>{title}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11, textAlign: "center" }}>{desc}</Text>
                  {b.unlocked ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <MaterialIcons name="check-circle" size={14} color={colors.primary} />
                      <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "700" }}>{t("unlocked", language)}</Text>
                    </View>
                  ) : (
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>{t("locked", language)}</Text>
                  )}
                </View>
              </Card>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
