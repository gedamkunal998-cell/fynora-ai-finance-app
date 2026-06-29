import React, { useState } from "react";
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";

import { useTheme } from "@/src/contexts/ThemeContext";
import { api } from "@/src/lib/api";
import { Input, GradientButton, ScreenHeader } from "@/src/components/ui";
import { spacing } from "@/src/lib/theme";
import { t } from "@/src/lib/i18n";

const ICONS = ["smartphone", "two-wheeler", "laptop-mac", "flight", "school", "home", "card-giftcard", "savings"];

export default function AddGoal() {
  const { colors, language } = useTheme();
  const router = useRouter();
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("");
  const [icon, setIcon] = useState("savings");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setErr(null);
    if (!name.trim() || !parseFloat(target)) { setErr(t("enter_name_target", language)); return; }
    setLoading(true);
    try {
      await api("/goals", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          target_amount: parseFloat(target),
          current_amount: parseFloat(current) || 0,
          icon,
        }),
      });
      router.back();
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={t("new_goal", language)} back onBack={() => router.back()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: 14 }}>
          <Input testID="goal-name" icon="flag" placeholder={t("goal_name_ph", language)} value={name} onChangeText={setName} />
          <Input testID="goal-target" icon="emoji-events" placeholder={t("target_amount_ph", language)} keyboardType="numeric" value={target} onChangeText={setTarget} />
          <Input testID="goal-current" icon="savings" placeholder={t("current_saved_ph", language)} keyboardType="numeric" value={current} onChangeText={setCurrent} />
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t("pick_icon", language)}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {ICONS.map((ic) => (
              <TouchableOpacity
                key={ic}
                testID={`goal-icon-${ic}`}
                onPress={() => setIcon(ic)}
                style={{
                  width: 56, height: 56, borderRadius: 16,
                  alignItems: "center", justifyContent: "center",
                  backgroundColor: icon === ic ? `${colors.primary}22` : colors.surface,
                  borderWidth: 1, borderColor: icon === ic ? colors.primary : colors.border,
                }}
              >
                <MaterialIcons name={ic as any} size={24} color={icon === ic ? colors.primary : colors.text} />
              </TouchableOpacity>
            ))}
          </ScrollView>
          {err ? <Text style={{ color: colors.danger, fontSize: 13 }}>{err}</Text> : null}
          <GradientButton testID="save-goal-button" label={t("create_goal", language)} onPress={save} loading={loading} icon="check" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
