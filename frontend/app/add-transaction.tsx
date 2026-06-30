import React, { useState } from "react";
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { useTheme } from "@/src/contexts/ThemeContext";
import { api } from "@/src/lib/api";
import { Input, GradientButton, ScreenHeader, CategoryIcon } from "@/src/components/ui";
import { ALL_CATEGORIES, spacing } from "@/src/lib/theme";
import { t, tCat } from "@/src/lib/i18n";

export default function AddTransaction() {
  const { colors, language } = useTheme();
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState("");
  const [tp, setTp] = useState<"debit" | "credit">("debit");
  const [payment, setPayment] = useState<"upi" | "card" | "cash" | "manual">("upi");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setErr(null);
    const amt = parseFloat(amount);
    if (!amt || !merchant.trim()) {
      setErr(t("enter_amount_merchant", language));
      return;
    }
    setLoading(true);
    try {
      await api("/transactions", {
        method: "POST",
        body: JSON.stringify({
          amount: amt,
          merchant: merchant.trim(),
          category: category || undefined,
          type: tp,
          payment_method: payment,
        }),
      });
      router.back();
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={t("add_transaction_title", language)} back onBack={() => router.back()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: 14 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["debit", "credit"] as const).map((k) => (
              <TouchableOpacity
                key={k}
                testID={`type-${k}`}
                onPress={() => setTp(k)}
                style={{
                  flex: 1, paddingVertical: 12, borderRadius: 12,
                  borderWidth: 1, borderColor: tp === k ? colors.primary : colors.border,
                  backgroundColor: tp === k ? `${colors.primary}22` : colors.surface,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: tp === k ? (k === "debit" ? colors.danger : colors.success) : colors.text, fontWeight: "700" }}>
                  {k === "debit" ? t("spent", language) : t("received", language)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Input testID="amount-input" icon="payments" placeholder={t("amount_placeholder", language)} keyboardType="numeric" value={amount} onChangeText={setAmount} />
          <Input testID="merchant-input" icon="storefront" placeholder={t("merchant_placeholder", language)} value={merchant} onChangeText={setMerchant} />

          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>{t("category_auto", language)}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {ALL_CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c}
                testID={`txn-cat-${c}`}
                onPress={() => setCategory(c === category ? "" : c)}
                style={{
                  flexBasis: "30%", flexGrow: 1,
                  alignItems: "center", gap: 6, paddingVertical: 10, borderRadius: 12,
                  borderWidth: 1, borderColor: category === c ? colors.primary : colors.border,
                  backgroundColor: category === c ? `${colors.primary}22` : colors.surface,
                }}
              >
                <CategoryIcon category={c} size={28} />
                <Text style={{ color: colors.text, fontSize: 11 }} numberOfLines={1}>{tCat(c, language)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t("payment_method", language)}</Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {(["upi", "card", "cash", "manual"] as const).map((p) => (
              <TouchableOpacity
                key={p}
                testID={`pay-${p}`}
                onPress={() => setPayment(p)}
                style={{
                  paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
                  borderWidth: 1,
                  borderColor: payment === p ? colors.primary : colors.border,
                  backgroundColor: payment === p ? `${colors.primary}22` : colors.surface,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "600", fontSize: 12 }}>{t(`payment_${p}`, language)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {err ? <Text style={{ color: colors.danger, fontSize: 13 }}>{err}</Text> : null}
          <GradientButton testID="save-txn-button" label={t("save_transaction", language)} onPress={save} loading={loading} icon="check" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
