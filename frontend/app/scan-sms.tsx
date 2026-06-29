import React, { useState } from "react";
import { View, Text, ScrollView, TextInput, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";

import { useTheme } from "@/src/contexts/ThemeContext";
import { api } from "@/src/lib/api";
import { Card, CategoryIcon, GradientButton, GhostButton, ScreenHeader } from "@/src/components/ui";
import { formatINR } from "@/src/lib/format";
import { spacing } from "@/src/lib/theme";
import { t } from "@/src/lib/i18n";

const DEMO_SMS = [
  "Dear Customer, Rs. 250.00 debited from A/c **1234 on 02/02/2026 at SWIGGY via UPI. Available bal: Rs. 12,540.00. -HDFC Bank",
  "INR 1,899 spent on Amazon using HDFC Credit Card xx2345 on 03-02-2026. Avl limit: 45,000",
  "Rs. 600 paid to UBER via UPI. UPI Ref 220456789012. -ICICI",
  "Your A/c XX1234 credited with Rs. 50,000 on 01-02-2026 by salary. Bal: Rs. 62,540.00 -SBI",
  "Rs. 999 debited for Netflix subscription on 31-Jan-2026. -Axis Bank",
];

export default function ScanSms() {
  const { colors, language } = useTheme();
  const router = useRouter();
  const [text, setText] = useState(DEMO_SMS.join("\n\n"));
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const parse = async () => {
    setErr(null); setLoading(true);
    try {
      const messages = text.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
      const r = await api<{ created: number; transactions: any[] }>("/transactions/parse-sms", {
        method: "POST",
        body: JSON.stringify({ messages }),
      });
      setCreated(r.transactions || []);
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={t("scan_sms_title", language)} back onBack={() => router.back()} subtitle={t("scan_sms_subtitle", language)} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: 12, paddingBottom: 80 }}>
        <Card>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
            <MaterialIcons name="info" size={20} color={colors.info} />
            <Text style={{ color: colors.textMuted, fontSize: 12, flex: 1, lineHeight: 18 }}>
              {t("scan_sms_help", language)}
            </Text>
          </View>
        </Card>

        <Card padded={false}>
          <TextInput
            testID="sms-input"
            multiline
            value={text}
            onChangeText={setText}
            placeholderTextColor={colors.textMuted}
            style={{ minHeight: 180, color: colors.text, padding: 14, fontSize: 13 }}
          />
        </Card>

        <GradientButton testID="parse-sms-button" label={loading ? t("parsing", language) : t("parse_import", language)} onPress={parse} loading={loading} icon="auto-fix-high" />
        <GhostButton testID="load-demo-sms" label={t("load_demo_sms", language)} onPress={() => setText(DEMO_SMS.join("\n\n"))} />
        {err ? <Text style={{ color: colors.danger }}>{err}</Text> : null}

        {created ? (
          <Card>
            <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 8 }}>{t("imported_count", language, { count: created.length })}</Text>
            {created.map((t) => (
              <View key={t.txn_id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 }}>
                <CategoryIcon category={t.category} size={28} />
                <Text style={{ color: colors.text, flex: 1 }} numberOfLines={1}>{t.merchant}</Text>
                <Text style={{ color: t.type === "credit" ? colors.success : colors.danger, fontWeight: "700" }}>
                  {t.type === "credit" ? "+" : "-"}{formatINR(t.amount)}
                </Text>
              </View>
            ))}
            {!created.length ? (
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t("no_new_txn", language)}</Text>
            ) : null}
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
