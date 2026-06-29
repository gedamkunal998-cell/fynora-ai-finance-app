import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { useTheme } from "@/src/contexts/ThemeContext";
import { useAuth } from "@/src/contexts/AuthContext";
import { FynoraLogo, GradientButton, GhostButton, Input } from "@/src/components/ui";
import { t } from "@/src/lib/i18n";

export default function Login() {
  const { colors, language } = useTheme();
  const { login, loginWithGoogle } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password, remember);
      router.replace("/(tabs)" as any);
    } catch (e: any) {
      setError(e.message || t("login_failed", language));
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setError(null);
    setGLoading(true);
    try {
      await loginWithGoogle();
      router.replace("/(tabs)" as any);
    } catch (e: any) {
      setError(e.message || t("google_failed", language));
    } finally {
      setGLoading(false);
    }
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: 24, paddingTop: 40, gap: 18 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ alignItems: "center", gap: 12, marginBottom: 8 }}>
            <FynoraLogo size={72} />
            <Text style={{ color: colors.text, fontSize: 28, fontWeight: "800", letterSpacing: 1 }}>FYNORA</Text>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t("tagline", language)}</Text>
          </View>

          <View style={{ gap: 12, marginTop: 18 }}>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: "700" }}>{t("login", language)}</Text>
            <Input
              testID="login-email-input"
              icon="alternate-email"
              placeholder={t("email", language)}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <Input
              testID="login-password-input"
              icon="lock-outline"
              placeholder={t("password", language)}
              secureTextEntry={!showPw}
              value={password}
              onChangeText={setPassword}
              rightIcon={showPw ? "visibility-off" : "visibility"}
              onRightPress={() => setShowPw((s) => !s)}
            />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <TouchableOpacity
                testID="remember-me-toggle"
                onPress={() => setRemember((r) => !r)}
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 5,
                    borderWidth: 1.5,
                    borderColor: remember ? colors.primary : colors.border,
                    backgroundColor: remember ? colors.primary : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {remember ? <Text style={{ color: "#000", fontSize: 13, fontWeight: "900" }}>✓</Text> : null}
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t("remember_me", language)}</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="forgot-password-link" onPress={() => router.push("/(auth)/forgot" as any)}>
                <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>
                  {t("forgot_password", language)}
                </Text>
              </TouchableOpacity>
            </View>
            {error ? (
              <Text testID="login-error" style={{ color: colors.danger, fontSize: 13 }}>
                {error}
              </Text>
            ) : null}
            <GradientButton testID="login-submit-button" label={t("login", language)} onPress={submit} loading={loading} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 8 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              <Text style={{ color: colors.textMuted, fontSize: 11 }}>{t("or_divider", language)}</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            </View>
            <GhostButton
              testID="google-login-button"
              icon="g-translate"
              label={gLoading ? t("connecting", language) : t("continue_google", language)}
              onPress={google}
            />
            <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 18, gap: 6 }}>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t("new_to_fynora", language)}</Text>
              <TouchableOpacity testID="goto-signup-link" onPress={() => router.push("/(auth)/signup" as any)}>
                <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>{t("signup", language)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
