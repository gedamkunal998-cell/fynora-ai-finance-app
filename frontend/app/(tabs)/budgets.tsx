import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";

import { useTheme } from "@/src/contexts/ThemeContext";
import { api } from "@/src/lib/api";
import { formatINR } from "@/src/lib/format";
import { Card, CategoryIcon, EmptyState, ScreenHeader, GradientButton } from "@/src/components/ui";
import { spacing } from "@/src/lib/theme";
import { t, tCat } from "@/src/lib/i18n";

export default function Budgets() {
  const { colors, language } = useTheme();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);

  const load = useCallback(async () => {
    try { setItems(await api<any[]>("/budgets")); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const totalBudget = items.reduce((s, b) => s + b.amount, 0);
  const totalUsed = items.reduce((s, b) => s + (b.used || 0), 0);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title={t("budgets_title", language)}
        subtitle={t("of_used", language, { used: formatINR(totalUsed), total: formatINR(totalBudget) })}
        right={
          <TouchableOpacity testID="add-budget-btn" onPress={() => router.push("/add-budget" as any)} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
            <MaterialIcons name="add" size={22} color="#000" />
          </TouchableOpacity>
        }
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: 12 }}>
        {!items.length ? (
          <>
            <EmptyState icon="pie-chart-outline" title={t("no_budgets_yet", language)} message={t("no_budgets_hint", language)} />
            <GradientButton testID="create-first-budget" label={t("create_first_budget", language)} onPress={() => router.push("/add-budget" as any)} />
          </>
        ) : items.map((b) => {
          const pct = Math.min(100, b.percent || 0);
          const danger = pct >= 90;
          const warn = pct >= 70 && pct < 90;
          return (
            <Card key={b.budget_id} testID={`budget-${b.category}`}>
              <View style={{ flexDirection: "row", gap: 12, alignItems: "center", marginBottom: 12 }}>
                <CategoryIcon category={b.category} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>{tCat(b.category, language)}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                    {formatINR(b.used || 0)} / {formatINR(b.amount)} · {t("remaining", language)} {formatINR(Math.max(0, b.amount - (b.used || 0)))}
                  </Text>
                </View>
                <Text style={{ color: danger ? colors.danger : warn ? colors.warning : colors.primary, fontWeight: "800" }}>{Math.round(pct)}%</Text>
              </View>
              <View style={{ height: 8, backgroundColor: colors.surfaceAlt, borderRadius: 4, overflow: "hidden" }}>
                <View style={{ height: 8, width: `${pct}%`, backgroundColor: danger ? colors.danger : warn ? colors.warning : colors.primary }} />
              </View>
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
