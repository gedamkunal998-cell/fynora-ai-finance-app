import React, { useCallback, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";

import { useTheme } from "@/src/contexts/ThemeContext";
import { api } from "@/src/lib/api";
import { Card, ScreenHeader, GradientCard } from "@/src/components/ui";
import { formatINR } from "@/src/lib/format";
import { gradients, spacing } from "@/src/lib/theme";
import { t, tCat } from "@/src/lib/i18n";

export default function Report() {
  const { colors, language } = useTheme();
  const router = useRouter();
  const [data, setData] = useState<any | null>(null);
  const load = useCallback(async () => {
    try { setData(await api<any>(`/report/weekly?lang=${language}`)); } catch {}
  }, [language]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!data) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}><ScreenHeader title={t("weekly_report_title", language)} back onBack={() => router.back()} /></SafeAreaView>;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={t("weekly_report_title", language)} back onBack={() => router.back()} subtitle={t("last_7_days", language)} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100, gap: 12 }}>
        <GradientCard colors={gradients.primary as any}>
          <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12 }}>{t("net_savings", language)}</Text>
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 28 }}>{formatINR(data.savings)}</Text>
          <View style={{ flexDirection: "row", marginTop: 10, gap: 12 }}>
            <View>
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>{t("income", language)}</Text>
              <Text style={{ color: "#fff", fontWeight: "700" }}>{formatINR(data.income)}</Text>
            </View>
            <View>
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>{t("expenses", language)}</Text>
              <Text style={{ color: "#fff", fontWeight: "700" }}>{formatINR(data.expenses)}</Text>
            </View>
          </View>
        </GradientCard>

        {data.highest_category ? (
          <Card>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <MaterialIcons name="arrow-upward" size={22} color={colors.danger} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>{t("highest_spend", language)}: {tCat(data.highest_category.category, language)}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{formatINR(data.highest_category.amount)}</Text>
              </View>
            </View>
          </Card>
        ) : null}
        {data.lowest_category ? (
          <Card>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <MaterialIcons name="arrow-downward" size={22} color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>{t("lowest_spend", language)}: {tCat(data.lowest_category.category, language)}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{formatINR(data.lowest_category.amount)}</Text>
              </View>
            </View>
          </Card>
        ) : null}

        <Card>
          <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 8 }}>{t("money_saving_tips", language)}</Text>
          {(data.tips || []).map((tip: string, i: number) => (
            <View key={i} style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
              <MaterialIcons name="lightbulb" size={16} color={colors.warning} />
              <Text style={{ color: colors.textMuted, flex: 1, fontSize: 13 }}>{tip}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
