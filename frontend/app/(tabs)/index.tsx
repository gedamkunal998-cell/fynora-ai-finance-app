import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";

import { useTheme } from "@/src/contexts/ThemeContext";
import { useAuth } from "@/src/contexts/AuthContext";
import { api } from "@/src/lib/api";
import { formatINR, relativeDay } from "@/src/lib/format";
import { t, tCat } from "@/src/lib/i18n";
import { Card, CategoryIcon, FynoraLogo, GradientCard } from "@/src/components/ui";
import { GaugeChart, DonutChart } from "@/src/components/charts";
import { gradients, spacing } from "@/src/lib/theme";
import { tMonthYear } from "@/src/lib/i18n-dates";

type Dash = {
  income: number;
  expenses: number;
  savings: number;
  spending_score: number;
  rating: string;
  categories: { category: string; amount: number }[];
  recent: any[];
  month: string;
};

const RATING_KEY: Record<string, string> = {
  Excellent: "excellent",
  Good: "good",
  Average: "average",
  "Needs Improvement": "needs_improvement",
};

export default function Dashboard() {
  const { colors, language } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<Dash | null>(null);
  const [streak, setStreak] = useState<{ current_streak: number; best_streak: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, s] = await Promise.all([api<Dash>("/dashboard"), api<any>("/streak")]);
      setData(d); setStreak(s);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        testID="dashboard-scroll"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", padding: spacing.lg, gap: 12 }}>
          <FynoraLogo size={36} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t("namaste", language)} 🙏</Text>
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>
              {user?.name?.split(" ")[0] || t("friend", language)}
            </Text>
          </View>
          <TouchableOpacity testID="open-settings" onPress={() => router.push("/settings" as any)} style={{ padding: 8 }}>
            <MaterialIcons name="settings" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={{ paddingHorizontal: spacing.lg }}>
          <GradientCard colors={gradients.secondary as any} style={{ padding: 18 }} testID="score-card">
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>{(() => { const now = new Date(); return tMonthYear(now.getMonth() + 1, now.getFullYear(), language); })()}</Text>
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 22 }}>{t("spending_score", language)}</Text>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14, marginTop: 4 }}>
                  {data?.rating ? t(RATING_KEY[data.rating] || "good", language) : "—"}
                </Text>
              </View>
              <View>
                <GaugeChart score={data?.spending_score ?? 0} size={160} />
              </View>
            </View>
          </GradientCard>
        </View>

        <View style={{ padding: spacing.lg, gap: spacing.sm }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <StatCard label={t("income", language)} value={data?.income || 0} icon="trending-up" color="#00D09C" testID="stat-income" />
            <StatCard label={t("expenses", language)} value={data?.expenses || 0} icon="trending-down" color="#EF4444" testID="stat-expenses" />
          </View>
          <StatCard label={t("savings", language)} value={data?.savings || 0} icon="savings" color="#6366F1" full testID="stat-savings" />
        </View>

        <View style={{ paddingHorizontal: spacing.lg }}>
          <TouchableOpacity activeOpacity={0.85} testID="share-streak" onPress={async () => {
            const text = `${t("share_streak_text", language, { n: streak?.current_streak ?? 0, best: streak?.best_streak ?? 0 })}\n#Fynora`;
            try {
              if (Platform.OS === "web") {
                const nav: any = (globalThis as any).navigator;
                if (nav?.share) { await nav.share({ text }); return; }
                if (nav?.clipboard?.writeText) { await nav.clipboard.writeText(text); return; }
              } else {
                const dir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory;
                const uri = `${dir}fynora-streak.txt`;
                await (FileSystem as any).writeAsStringAsync(uri, text, { encoding: (FileSystem as any).EncodingType?.UTF8 || "utf8" });
                if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "text/plain" });
              }
            } catch {}
          }}>
          <Card testID="streak-card">
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "#F9731622", alignItems: "center", justifyContent: "center" }}>
                <MaterialIcons name="local-fire-department" size={26} color="#F97316" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>{t("no_spend_streak", language)}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  {t("current_label", language)}:{" "}
                  <Text style={{ color: colors.text, fontWeight: "700" }}>{streak?.current_streak ?? 0} {t("days_unit", language)}</Text> · {t("best_label", language)}:{" "}
                  <Text style={{ color: colors.text, fontWeight: "700" }}>{streak?.best_streak ?? 0} {t("days_unit", language)}</Text>
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} />
            </View>
          </Card>
          </TouchableOpacity>
        </View>

        <View style={{ padding: spacing.lg, flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          <QuickAction icon="add-circle" label={t("qa_add", language)} onPress={() => router.push("/add-transaction" as any)} testID="quick-add" />
          <QuickAction icon="receipt-long" label={t("qa_scan_receipt", language)} onPress={() => router.push("/scan-receipt" as any)} testID="quick-scan-receipt" />
          <QuickAction icon="sms" label={t("qa_scan_sms", language)} onPress={() => router.push("/scan-sms" as any)} testID="quick-sms" />
          <QuickAction icon="flag" label={t("qa_goals", language)} onPress={() => router.push("/goals" as any)} testID="quick-goals" />
          <QuickAction icon="calendar-today" label={t("qa_calendar", language)} onPress={() => router.push("/calendar" as any)} testID="quick-calendar" />
          <QuickAction icon="emoji-events" label={t("qa_badges", language)} onPress={() => router.push("/achievements" as any)} testID="quick-achievements" />
          <QuickAction icon="storefront" label={t("qa_merchants", language)} onPress={() => router.push("/merchants" as any)} testID="quick-merchants" />
        </View>

        {data?.categories?.length ? (
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: 16 }}>
            <Card testID="categories-card">
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>{t("where_it_went", language)}</Text>
                <TouchableOpacity onPress={() => router.push("/(tabs)/budgets" as any)}>
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>{t("manage_budgets", language)}</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: "row", gap: 18, alignItems: "center" }}>
                <DonutChart
                  data={data.categories.slice(0, 6).map((c) => ({ label: tCat(c.category, language), value: c.amount }))}
                  size={140}
                  thickness={20}
                  centerLabel={formatINR(data.expenses, true)}
                  centerSub={t("total_label", language)}
                />
                <View style={{ flex: 1, gap: 6 }}>
                  {data.categories.slice(0, 5).map((c) => (
                    <View key={c.category} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <CategoryIcon category={c.category} size={26} />
                      <Text style={{ color: colors.text, flex: 1, fontSize: 12 }} numberOfLines={1}>{tCat(c.category, language)}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{formatINR(c.amount, true)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </Card>
          </View>
        ) : null}

        <View style={{ paddingHorizontal: spacing.lg }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>{t("recent", language)}</Text>
            <TouchableOpacity testID="see-all-txns" onPress={() => router.push("/(tabs)/transactions" as any)}>
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>{t("see_all", language)}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ gap: 8 }}>
            {(data?.recent || []).map((tx) => (
              <Card key={tx.txn_id} padded={false} testID={`recent-${tx.txn_id}`}>
                <View style={{ flexDirection: "row", alignItems: "center", padding: 14, gap: 12 }}>
                  <CategoryIcon category={tx.category} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: "600", fontSize: 14 }} numberOfLines={1}>{tx.merchant}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                      {tCat(tx.category, language)} · {relativeDay(tx.date, language)}
                    </Text>
                  </View>
                  <Text style={{ color: tx.type === "credit" ? colors.success : colors.danger, fontWeight: "700", fontSize: 14 }}>
                    {tx.type === "credit" ? "+" : "-"}{formatINR(tx.amount)}
                  </Text>
                </View>
              </Card>
            ))}
            {!data?.recent?.length ? (
              <Card>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t("no_txn_dashboard_hint", language)}</Text>
              </Card>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, icon, color, full, testID }: { label: string; value: number; icon: string; color: string; full?: boolean; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={{ flex: full ? undefined : 1, width: full ? "100%" : undefined, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 18, padding: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: `${color}22`, alignItems: "center", justifyContent: "center" }}>
          <MaterialIcons name={icon as any} size={18} color={color} />
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{label}</Text>
      </View>
      <Text style={{ color: colors.text, fontWeight: "800", fontSize: 20 }}>{formatINR(value)}</Text>
    </View>
  );
}

function QuickAction({ icon, label, onPress, testID }: { icon: string; label: string; onPress: () => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity testID={testID} onPress={onPress} activeOpacity={0.8} style={{ flexBasis: "30%", flexGrow: 1, alignItems: "center", paddingVertical: 14, borderRadius: 16, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, gap: 6 }}>
      <MaterialIcons name={icon as any} size={22} color={colors.primary} />
      <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>{label}</Text>
    </TouchableOpacity>
  );
}
