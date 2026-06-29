import React, { useState } from "react";
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { useTheme } from "@/src/contexts/ThemeContext";
import { useAuth } from "@/src/contexts/AuthContext";
import { FynoraLogo, GradientButton, GhostButton, Input } from "@/src/components/ui";
import { t } from "@/src/lib/i18n";

export default function Signup() {
  const { colors, language } = useTheme();
  const { signup, loginWithGoogle } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (password.length < 6) {
      setError(t("pw_min_6", language));
      return;
    }
    if (password !== confirm) {
      setError(t("pw_mismatch", language));
      return;
    }
    setLoading(true);
    try {
      await signup(name.trim(), email.trim(), password, true);
      router.replace("/(tabs)" as any);
    } catch (e: any) {
      setError(e.message || t("signup_failed", language));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 32, gap: 14 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: "center", gap: 8, marginBottom: 8 }}>
            <FynoraLogo size={64} />
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}>{t("welcome", language)}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t("tagline", language)}</Text>
          </View>
          <Input testID="signup-name-input" icon="person-outline" placeholder={t("name", language)} value={name} onChangeText={setName} />
          <Input
            testID="signup-email-input"
            icon="alternate-email"
            placeholder={t("email", language)}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Input
            testID="signup-password-input"
            icon="lock-outline"
            placeholder={t("password", language)}
            secureTextEntry={!showPw}
            value={password}
            onChangeText={setPassword}
            rightIcon={showPw ? "visibility-off" : "visibility"}
            onRightPress={() => setShowPw((s) => !s)}
          />
          <Input
            testID="signup-confirm-input"
            icon="lock"
            placeholder={t("confirm_password", language)}
            secureTextEntry={!showPw}
            value={confirm}
            onChangeText={setConfirm}
          />
          {error ? (
            <Text testID="signup-error" style={{ color: colors.danger, fontSize: 13 }}>{error}</Text>
          ) : null}
          <GradientButton testID="signup-submit-button" label={t("signup", language)} onPress={submit} loading={loading} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 8 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            <Text style={{ color: colors.textMuted, fontSize: 11 }}>{t("or_divider", language)}</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </View>
          <GhostButton
            testID="signup-google-button"
            icon="g-translate"
            label={t("continue_google", language)}
            onPress={async () => {
              try {
                await loginWithGoogle();
                router.replace("/(tabs)" as any);
              } catch (e: any) {
                setError(e.message);
              }
            }}
          />
          <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 12, gap: 6 }}>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t("already_have_account", language)}</Text>
            <TouchableOpacity testID="goto-login-link" onPress={() => router.replace("/(auth)/login" as any)}>
              <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>{t("login", language)}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
