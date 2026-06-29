import React, { useState } from "react";
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { useTheme } from "@/src/contexts/ThemeContext";
import { useAuth } from "@/src/contexts/AuthContext";
import { GradientButton, GhostButton, Input, ScreenHeader } from "@/src/components/ui";
import { t } from "@/src/lib/i18n";

export default function Forgot() {
  const { colors, language } = useTheme();
  const { forgotPassword, resetPassword } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPw, setNewPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const request = async () => {
    setError(null); setMsg(null); setLoading(true);
    try {
      const r = await forgotPassword(email.trim());
      setMsg(t("reset_link_sent", language));
      if (r.dev_token) setToken(r.dev_token);
      setStep("reset");
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  const reset = async () => {
    setError(null); setMsg(null); setLoading(true);
    try {
      await resetPassword(token.trim(), newPw);
      setMsg(t("password_updated", language));
      setTimeout(() => router.replace("/(auth)/login" as any), 800);
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={t("reset_password_title", language)} subtitle={t("reset_subtitle", language)} back onBack={() => router.back()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 24, gap: 14 }} keyboardShouldPersistTaps="handled">
          {step === "request" ? (
            <>
              <Input testID="forgot-email-input" icon="alternate-email" placeholder={t("registered_email_ph", language)} autoCapitalize="none" value={email} onChangeText={setEmail} />
              <GradientButton testID="forgot-submit-button" label={t("send_reset_link", language)} onPress={request} loading={loading} />
              <GhostButton testID="have-token-button" label={t("have_token", language)} onPress={() => setStep("reset")} />
            </>
          ) : (
            <>
              <Input testID="reset-token-input" icon="vpn-key" placeholder={t("reset_token_ph", language)} autoCapitalize="none" value={token} onChangeText={setToken} />
              <Input testID="reset-newpw-input" icon="lock-outline" placeholder={t("new_password_ph", language)} secureTextEntry value={newPw} onChangeText={setNewPw} />
              <GradientButton testID="reset-submit-button" label={t("update_password", language)} onPress={reset} loading={loading} />
              <GhostButton testID="back-to-request" label={t("back_btn", language)} onPress={() => setStep("request")} />
            </>
          )}
          {msg ? <Text style={{ color: colors.primary, fontSize: 13 }}>{msg}</Text> : null}
          {error ? <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
