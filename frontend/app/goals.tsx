import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";

import { useTheme } from "@/src/contexts/ThemeContext";
import { api } from "@/src/lib/api";
import { Card, EmptyState, ScreenHeader, GradientButton } from "@/src/components/ui";
import { formatINR } from "@/src/lib/format";
import { spacing } from "@/src/lib/theme";
import { t } from "@/src/lib/i18n";

export default function Goals() {
  const { colors, language } = useTheme();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await api<any[]>("/goals")); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const remove = async (id: string) => { await api(`/goals/${id}`, { method: "DELETE" }); load(); };
  const addMoney = async (g: any) => {
    const next = (g.current_amount || 0) + Math.round(g.target_amount * 0.1);
    await api(`/goals/${g.goal_id}`, { method: "PATCH", body: JSON.stringify({ current_amount: Math.min(next, g.target_amount) }) });
    load();
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title={t("savings_goals_title", language)}
        subtitle={t("active_goals_count", language, { count: items.length })}
        back
        onBack={() => router.back()}
        right={
          <TouchableOpacity testID="add-goal-btn" onPress={() => router.push("/add-goal" as any)} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
            <MaterialIcons name="add" size={22} color="#000" />
          </TouchableOpacity>
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.primary} />}
      >
        {!items.length ? (
          <>
            <EmptyState icon="flag" title={t("no_goals_yet", language)} message={t("no_goals_hint", language)} />
            <GradientButton label={t("create_first_goal", language)} onPress={() => router.push("/add-goal" as any)} />
          </>
        ) : (
          items.map((g) => (
            <Card key={g.goal_id} testID={`goal-${g.goal_id}`}>
              <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: `${colors.primary}22`, alignItems: "center", justifyContent: "center" }}>
                  <MaterialIcons name={(g.icon || "savings") as any} size={24} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>{g.name}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                    {t("goal_progress_of", language, { current: formatINR(g.current_amount), target: formatINR(g.target_amount) })}
                  </Text>
                </View>
                <Text style={{ color: colors.primary, fontWeight: "800" }}>{Math.round(g.progress)}%</Text>
              </View>
              <View style={{ height: 8, backgroundColor: colors.surfaceAlt, borderRadius: 4, marginTop: 12, overflow: "hidden" }}>
                <View style={{ height: 8, width: `${Math.min(100, g.progress)}%`, backgroundColor: colors.primary }} />
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                <TouchableOpacity testID={`goal-add-${g.goal_id}`} onPress={() => addMoney(g)} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: `${colors.primary}22`, alignItems: "center" }}>
                  <Text style={{ color: colors.primary, fontWeight: "600" }}>+ 10%</Text>
                </TouchableOpacity>
                <TouchableOpacity testID={`goal-del-${g.goal_id}`} onPress={() => remove(g.goal_id)} style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
                  <MaterialIcons name="delete-outline" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
