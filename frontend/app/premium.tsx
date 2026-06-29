import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Platform, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";

import { useTheme } from "@/src/contexts/ThemeContext";
import { useAuth } from "@/src/contexts/AuthContext";
import { api } from "@/src/lib/api";
import { Card, GradientButton, GradientCard, ScreenHeader } from "@/src/components/ui";
import { gradients, spacing } from "@/src/lib/theme";
import { t } from "@/src/lib/i18n";

type Plan = { id: string; name: string; amount: number; currency: string; period: string; features: string[] };

export default function Premium() {
  const { colors, language } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [status, setStatus] = useState<{ is_premium: boolean; plan?: string; expires_at?: string | null } | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([
        api<{ plans: Plan[] }>("/premium/plans"),
        api<any>("/premium/status"),
      ]);
      setPlans(p.plans);
      setStatus(s);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const buy = async (planId: string) => {
    setErr(null); setInfo(null); setBuying(planId);
    try {
      const order = await api<{ order_id: string; amount: number; currency: string; key_id: string; mode: string }>("/premium/order", {
        method: "POST",
        body: JSON.stringify({ plan_id: planId }),
      });
      if (order.mode === "dev_stub") {
        // Dev path: simulate immediate success
        const verify = await api<{ ok: boolean; expires_at: string }>("/premium/verify", {
          method: "POST",
          body: JSON.stringify({
            razorpay_order_id: order.order_id,
            razorpay_payment_id: `pay_dev_${Date.now()}`,
            razorpay_signature: "dev_signature",
          }),
        });
        setInfo(t("premium_activated_until", language, { date: verify.expires_at?.slice(0, 10) || "" }));
        await load();
      } else {
        // Real Razorpay: open hosted checkout URL on web/native
        const checkoutUrl = `https://checkout.razorpay.com/v1/checkout.html?key_id=${order.key_id}&order_id=${order.order_id}&amount=${order.amount}&currency=${order.currency}`;
        if (Platform.OS === "web") {
          (globalThis as any).window?.open?.(checkoutUrl, "_blank");
        } else {
          await Linking.openURL(checkoutUrl);
        }
        setInfo(t("premium_complete_in_browser", language));
      }
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBuying(null);
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={t("premium_title", language)} subtitle={t("premium_subtitle", language)} back onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: 14, paddingBottom: 80 }}>
        <GradientCard colors={gradients.secondary as any} testID="premium-hero">
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <MaterialIcons name="workspace-premium" size={26} color="#FCD34D" />
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 18 }}>{t("premium_hero_title", language)}</Text>
            </View>
            <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, lineHeight: 19 }}>{t("premium_hero_sub", language)}</Text>
          </View>
        </GradientCard>

        {status?.is_premium ? (
          <Card testID="premium-active">
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <MaterialIcons name="check-circle" size={22} color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>{t("premium_active", language)}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  {t("plan_label", language)}: {status.plan} · {t("until_label", language)} {status.expires_at?.slice(0, 10)}
                </Text>
              </View>
            </View>
          </Card>
        ) : (
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t("premium_pick_plan", language)}</Text>
        )}

        {plans.map((p) => (
          <Card key={p.id} testID={`plan-${p.id}`}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16 }}>{p.name}</Text>
              <Text style={{ color: colors.primary, fontWeight: "800" }}>
                ₹{(p.amount / 100).toLocaleString("en-IN")}
                <Text style={{ color: colors.textMuted, fontWeight: "500" }}> /{p.period === "month" ? t("month_label", language) : t("year_label", language)}</Text>
              </Text>
            </View>
            <View style={{ gap: 6, marginVertical: 6 }}>
              {p.features.map((f) => (
                <View key={f} style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                  <MaterialIcons name="check" size={16} color={colors.success} />
                  <Text style={{ color: colors.text, fontSize: 13 }}>{t(`feature_${f}`, language)}</Text>
                </View>
              ))}
            </View>
            <GradientButton
              testID={`buy-${p.id}`}
              label={status?.is_premium ? t("already_premium", language) : (buying === p.id ? t("processing", language) : t("upgrade_now", language))}
              loading={buying === p.id}
              onPress={() => !status?.is_premium && buy(p.id)}
              icon="bolt"
            />
          </Card>
        ))}

        {info ? <Text testID="premium-info" style={{ color: colors.primary, fontSize: 13 }}>{info}</Text> : null}
        {err ? <Text testID="premium-error" style={{ color: colors.danger, fontSize: 13 }}>{err}</Text> : null}

        <Text style={{ color: colors.textMuted, fontSize: 11, textAlign: "center", marginTop: 8 }}>{t("premium_powered_by", language)}</Text>
        {user ? null : <ActivityIndicator color={colors.primary} />}
      </ScrollView>
    </SafeAreaView>
  );
}
