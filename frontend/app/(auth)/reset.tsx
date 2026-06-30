import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useTheme } from "@/src/contexts/ThemeContext";
import { useAuth } from "@/src/contexts/AuthContext";
import { GradientButton, Input, ScreenHeader, FynoraLogo } from "@/src/components/ui";
import { t } from "@/src/lib/i18n";

export default function ResetPassword() {
  const { colors, language } = useTheme();
  const { resetPassword } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();

  const [token, setToken] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params.token && typeof params.token === "string") setToken(params.token);
  }, [params.token]);

  const submit = async () => {
    setError(null); setMsg(null);
    if (newPw.length < 6) { setError(t("pw_min_6", language)); return; }
    if (newPw !== confirm) { setError(t("pw_mismatch", language)); return; }
    setLoading(true);
    try {
      await resetPassword(token.trim(), newPw);
      setMsg(t("password_updated", language));
      setTimeout(() => router.replace("/(auth)/login" as any), 900);
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={t("reset_password_title", language)} back onBack={() => router.back()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 24, gap: 14 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: "center", gap: 8, marginBottom: 6 }}>
            <FynoraLogo size={56} />
            <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: "center" }}>{t("reset_subtitle", language)}</Text>
          </View>
          <Input testID="reset-token-input" icon="vpn-key" placeholder={t("reset_token_ph", language)} autoCapitalize="none" value={token} onChangeText={setToken} />
          <Input testID="reset-newpw-input" icon="lock-outline" placeholder={t("new_password_ph", language)} secureTextEntry value={newPw} onChangeText={setNewPw} />
          <Input testID="reset-confirm-input" icon="lock" placeholder={t("confirm_password", language)} secureTextEntry value={confirm} onChangeText={setConfirm} />
          <GradientButton testID="reset-deeplink-submit" label={t("update_password", language)} onPress={submit} loading={loading} />
          {msg ? <Text testID="reset-success" style={{ color: colors.primary, fontSize: 13 }}>{msg}</Text> : null}
          {error ? <Text testID="reset-error" style={{ color: colors.danger, fontSize: 13 }}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
