import React, { useCallback, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";

import { useTheme } from "@/src/contexts/ThemeContext";
import { api } from "@/src/lib/api";
import { Card, CategoryIcon, EmptyState, ScreenHeader } from "@/src/components/ui";
import { formatINR } from "@/src/lib/format";
import { spacing } from "@/src/lib/theme";
import { t, tCat } from "@/src/lib/i18n";

export default function Merchants() {
  const { colors, language } = useTheme();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const load = useCallback(async () => {
    try { setItems(await api<any[]>("/merchants")); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={t("top_merchants_title", language)} back onBack={() => router.back()} subtitle={t("this_month_label", language)} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100, gap: 8 }}>
        {!items.length ? <EmptyState icon="storefront" title={t("no_data_yet", language)} message={t("no_data_hint", language)} /> : null}
        {items.map((m, i) => (
          <Card key={m.merchant} padded={false} testID={`merchant-${i}`}>
            <View style={{ flexDirection: "row", alignItems: "center", padding: 14, gap: 12 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: i < 3 ? colors.primary : colors.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: i < 3 ? "#000" : colors.text, fontWeight: "800", fontSize: 12 }}>#{i + 1}</Text>
              </View>
              <CategoryIcon category={m.category} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "700" }} numberOfLines={1}>{m.merchant}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>{m.count} {t("txns_label", language)} · {tCat(m.category, language)}</Text>
              </View>
              <Text style={{ color: colors.text, fontWeight: "800" }}>{formatINR(m.amount)}</Text>
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
