import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";

import { useTheme } from "@/src/contexts/ThemeContext";
import { api } from "@/src/lib/api";
import { formatINR, relativeDay } from "@/src/lib/format";
import { Card, CategoryIcon, EmptyState, Input, Pill, ScreenHeader } from "@/src/components/ui";
import { ALL_CATEGORIES, spacing } from "@/src/lib/theme";
import { t, tCat } from "@/src/lib/i18n";

export default function Transactions() {
  const { colors, language } = useTheme();
  const RANGES = [
    { key: "today", label: t("range_today", language) },
    { key: "week", label: t("range_week", language) },
    { key: "month", label: t("range_month", language) },
    { key: "all", label: t("range_all", language) },
  ];

  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [range, setRange] = useState("month");
  const [cat, setCat] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    qs.set("range", range);
    if (cat !== "All") qs.set("category", cat);
    if (search.trim()) qs.set("search", search.trim());
    try { setItems(await api<any[]>(`/transactions?${qs.toString()}`)); } catch {}
  }, [range, cat, search]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const total = items.filter((t) => t.type === "debit").reduce((s, t) => s + t.amount, 0);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title={t("transactions_title", language)}
        subtitle={t("items_spent", language, { count: items.length, amount: formatINR(total) })}
        right={
          <TouchableOpacity testID="add-transaction-btn" onPress={() => router.push("/add-transaction" as any)} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
            <MaterialIcons name="add" size={22} color="#000" />
          </TouchableOpacity>
        }
      />
      <View style={{ paddingHorizontal: spacing.lg }}>
        <Input testID="txn-search-input" icon="search" placeholder={t("search_merchant", language)} value={search} onChangeText={setSearch} onSubmitEditing={load} returnKeyType="search" />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 8, paddingVertical: 10 }}>
        {RANGES.map((r) => <Pill key={r.key} label={r.label} active={range === r.key} onPress={() => setRange(r.key)} testID={`range-${r.key}`} />)}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 8, paddingBottom: 8 }}>
        <Pill label={t("all_categories", language)} active={cat === "All"} onPress={() => setCat("All")} testID="cat-All" />
        {ALL_CATEGORIES.map((c) => <Pill key={c} label={tCat(c, language)} active={cat === c} onPress={() => setCat(c)} testID={`cat-${c}`} />)}
      </ScrollView>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.primary} />}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: 8 }}
      >
        {!items.length ? (
          <EmptyState testID="txn-empty" icon="receipt-long" title={t("no_transactions", language)} message={t("no_transactions_hint", language)} />
        ) : (
          items.map((tx) => (
            <Card key={tx.txn_id} padded={false} testID={`txn-${tx.txn_id}`}>
              <View style={{ flexDirection: "row", alignItems: "center", padding: 14, gap: 12 }}>
                <CategoryIcon category={tx.category} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "600", fontSize: 14 }} numberOfLines={1}>{tx.merchant}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                    {tCat(tx.category, language)} · {relativeDay(tx.date, language)}
                  </Text>
                </View>
                <Text style={{ color: tx.type === "credit" ? colors.success : colors.danger, fontWeight: "700" }}>
                  {tx.type === "credit" ? "+" : "-"}{formatINR(tx.amount)}
                </Text>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
