import React, { useState } from "react";
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { useTheme } from "@/src/contexts/ThemeContext";
import { api } from "@/src/lib/api";
import { Input, GradientButton, ScreenHeader, CategoryIcon } from "@/src/components/ui";
import { ALL_CATEGORIES, spacing } from "@/src/lib/theme";
import { t, tCat } from "@/src/lib/i18n";

export default function AddBudget() {
  const { colors, language } = useTheme();
  const router = useRouter();
  const [category, setCategory] = useState("Food");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setErr(null);
    const v = parseFloat(amount);
    if (!v) { setErr(t("budget_amount", language)); return; }
    setLoading(true);
    try {
      await api("/budgets", { method: "POST", body: JSON.stringify({ category, amount: v }) });
      router.back();
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={t("add_budget", language)} back onBack={() => router.back()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: 14 }}>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t("pick_category", language)}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {ALL_CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c}
                testID={`bud-cat-${c}`}
                onPress={() => setCategory(c)}
                style={{
                  flexBasis: "30%", flexGrow: 1,
                  alignItems: "center", gap: 6, paddingVertical: 10, borderRadius: 12,
                  borderWidth: 1, borderColor: category === c ? colors.primary : colors.border,
                  backgroundColor: category === c ? `${colors.primary}22` : colors.surface,
                }}
              >
                <CategoryIcon category={c} size={32} />
                <Text style={{ color: colors.text, fontSize: 11 }} numberOfLines={1}>{tCat(c, language)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Input testID="bud-amount" icon="payments" placeholder={t("budget_amount", language)} keyboardType="numeric" value={amount} onChangeText={setAmount} />
          {err ? <Text style={{ color: colors.danger, fontSize: 13 }}>{err}</Text> : null}
          <GradientButton testID="save-budget-button" label={t("save_budget", language)} onPress={save} loading={loading} icon="check" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
