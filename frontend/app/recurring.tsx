import React, { useCallback, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";

import { useTheme } from "@/src/contexts/ThemeContext";
import { api } from "@/src/lib/api";
import { Card, CategoryIcon, EmptyState, ScreenHeader } from "@/src/components/ui";
import { formatINR, relativeDay } from "@/src/lib/format";
import { spacing } from "@/src/lib/theme";
import { t, tCat } from "@/src/lib/i18n";

export default function Recurring() {
  const { colors, language } = useTheme();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const load = useCallback(async () => {
    try { setItems(await api<any[]>("/recurring")); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={t("recurring_title", language)} back onBack={() => router.back()} subtitle={t("recurring_sub", language)} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100, gap: 8 }}>
        {!items.length ? <EmptyState icon="autorenew" title={t("no_recurring", language)} message={t("no_recurring_hint", language)} /> : null}
        {items.map((r, i) => (
          <Card key={i} padded={false} testID={`recurring-${i}`}>
            <View style={{ flexDirection: "row", alignItems: "center", padding: 14, gap: 12 }}>
              <CategoryIcon category={r.category} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "700" }} numberOfLines={1}>{r.merchant}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                  {t("times_count", language, { n: r.count })} · {t("avg_label", language)} {formatINR(r.avg_amount)} · {t("last_label", language)} {r.last_date ? relativeDay(r.last_date, language) : "—"}
                </Text>
                <Text style={{ color: colors.textDim, fontSize: 10, marginTop: 2 }}>{tCat(r.category, language)}</Text>
              </View>
              <Text style={{ color: colors.danger, fontWeight: "700" }}>{formatINR(r.avg_amount)}</Text>
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
