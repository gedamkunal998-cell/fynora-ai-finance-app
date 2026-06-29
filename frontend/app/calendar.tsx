import React, { useCallback, useState } from "react";
import { Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";

import { useTheme } from "@/src/contexts/ThemeContext";
import { api } from "@/src/lib/api";
import { Card, ScreenHeader } from "@/src/components/ui";
import { SpendCalendar, BarChartMini } from "@/src/components/charts";
import { formatINR } from "@/src/lib/format";
import { spacing } from "@/src/lib/theme";
import { t } from "@/src/lib/i18n";

export default function Calendar() {
  const { colors, language } = useTheme();
  const router = useRouter();
  const [data, setData] = useState<any | null>(null);
  const load = useCallback(async () => {
    try { setData(await api<any>("/calendar")); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const total = (data?.days || []).reduce((s: number, d: any) => s + d.amount, 0);
  const top7 = (data?.days || []).slice(0, 7).map((d: any) => ({ label: d.date.slice(-2), value: d.amount }));

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title={t("spending_calendar", language)}
        back
        onBack={() => router.back()}
        subtitle={data ? t("total_this_month", language, { amount: formatINR(total) }) : ""}
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: 16, paddingBottom: 80 }}>
        <Card testID="calendar-card">
          {data ? <SpendCalendar days={data.days} month={data.month} year={data.year} lang={language} /> : null}
        </Card>
        {top7.length ? (
          <Card>
            <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 12 }}>{t("top_spending_days", language)}</Text>
            <BarChartMini data={top7} />
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
