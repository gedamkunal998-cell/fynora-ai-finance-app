import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";

import { useTheme } from "@/src/contexts/ThemeContext";
import { api } from "@/src/lib/api";
import { Card, GradientCard, ScreenHeader, EmptyState } from "@/src/components/ui";
import { spacing, gradients } from "@/src/lib/theme";
import { t } from "@/src/lib/i18n";

export default function Insights() {
  const { colors, language } = useTheme();
  const router = useRouter();
  const [insights, setInsights] = useState<string[]>([]);
  const [aiStatus, setAiStatus] = useState<"ok" | "fallback" | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api<{ insights: string[]; ai_status?: "ok" | "fallback" }>(`/insights?lang=${language}`);
      setInsights(r.insights || []);
      setAiStatus(r.ai_status || null);
    } catch {} finally { setLoading(false); }
  }, [language]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const r = await api<{ insights: string[]; ai_status?: "ok" | "fallback" }>(`/insights/refresh?lang=${language}`, { method: "POST" });
      setInsights(r.insights || []);
      setAiStatus(r.ai_status || null);
    } catch {} finally { setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title={t("insights_title", language)}
        subtitle={t("insights_subtitle", language)}
        right={
          <TouchableOpacity testID="refresh-insights" onPress={refresh} style={{ padding: 8 }}>
            {refreshing ? <ActivityIndicator color={colors.primary} /> : <MaterialIcons name="refresh" size={22} color={colors.text} />}
          </TouchableOpacity>
        }
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}>
        <GradientCard colors={gradients.secondary as any} testID="ai-header-card">
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}>
              <MaterialIcons name="auto-awesome" size={24} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>{t("ai_powered", language)}</Text>
              <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>{t("ai_powered_sub", language)}</Text>
            </View>
          </View>
        </GradientCard>

        {aiStatus === "fallback" ? (
          <Card testID="ai-fallback-banner">
            <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
              <MaterialIcons name="info-outline" size={20} color={colors.warning} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>{t("ai_fallback_title", language)}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2, lineHeight: 17 }}>
                  {t("ai_fallback_hint", language)}
                </Text>
              </View>
            </View>
          </Card>
        ) : null}

        {loading && !insights.length ? (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ color: colors.textMuted, marginTop: 8 }}>{t("generating_insights", language)}</Text>
          </View>
        ) : insights.length ? (
          insights.map((line, i) => (
            <Card key={i} testID={`insight-${i}`}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <MaterialIcons name="bolt" size={20} color={colors.primary} />
                <Text style={{ color: colors.text, fontSize: 14, flex: 1, lineHeight: 20 }}>{line}</Text>
              </View>
            </Card>
          ))
        ) : (
          <EmptyState icon="auto-awesome" title={t("no_insights_yet", language)} message={t("no_insights_hint", language)} />
        )}

        <Card>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: `${colors.info}22`, alignItems: "center", justifyContent: "center" }}>
              <MaterialIcons name="event-note" size={22} color={colors.info} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>{t("weekly_report", language)}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t("weekly_report_sub", language)}</Text>
            </View>
            <TouchableOpacity testID="open-weekly-report" onPress={() => router.push("/report" as any)}>
              <MaterialIcons name="chevron-right" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </Card>

        <Card>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: `${colors.warning}22`, alignItems: "center", justifyContent: "center" }}>
              <MaterialIcons name="autorenew" size={22} color={colors.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>{t("recurring_expenses", language)}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t("recurring_expenses_sub", language)}</Text>
            </View>
            <TouchableOpacity testID="open-recurring" onPress={() => router.push("/recurring" as any)}>
              <MaterialIcons name="chevron-right" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
