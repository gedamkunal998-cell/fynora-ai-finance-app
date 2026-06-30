import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";

import { useTheme } from "@/src/contexts/ThemeContext";
import { useAuth } from "@/src/contexts/AuthContext";
import { api } from "@/src/lib/api";
import { Card, ScreenHeader, GradientCard, FynoraLogo } from "@/src/components/ui";
import { LanguagePickerSheet } from "@/src/components/language-picker";
import { gradients, spacing } from "@/src/lib/theme";
import { t, SUPPORTED_LANGUAGES, Language } from "@/src/lib/i18n";

export default function Profile() {
  const { colors, mode, toggleMode, language, setLanguage } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [counts, setCounts] = useState({ txns: 0, badges: 0, goals: 0 });
  const [langSheet, setLangSheet] = useState(false);

  const load = useCallback(async () => {
    try {
      const [b, g] = await Promise.all([
        api<any[]>("/achievements"),
        api<any[]>("/goals"),
      ]);
      setCounts((c) => ({ ...c, badges: b.filter((x) => x.unlocked).length, goals: g.length }));
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const out = async () => {
    await logout();
    router.replace("/(auth)/login" as any);
  };

  const onLangSelect = (next: Language) => {
    setLanguage(next);
    setLangSheet(false);
    api("/settings", { method: "PATCH", body: JSON.stringify({ language: next }) }).catch(() => {});
  };

  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === language)?.native || "English";

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={t("profile", language)} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140, gap: 12 }}>
        <GradientCard colors={gradients.primary as any} testID="profile-header">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={{ width: 56, height: 56, borderRadius: 28 }} />
            ) : (
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
                <FynoraLogo size={32} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 18 }}>{user?.name || t("fynora_user", language)}</Text>
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 13 }}>{user?.email}</Text>
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 2 }}>{t("via_label", language)} {user?.provider || "email"}</Text>
            </View>
          </View>
        </GradientCard>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <Mini label={t("badges_label", language)} value={String(counts.badges)} icon="emoji-events" />
          <Mini label={t("goals_label", language)} value={String(counts.goals)} icon="flag" />
        </View>

        <Card>
          <Item icon="workspace-premium" label={t("upgrade_to_pro", language)} onPress={() => router.push("/premium" as any)} testID="profile-premium" />
          <Divider />
          <Item icon="emoji-events" label={t("achievements", language)} onPress={() => router.push("/achievements" as any)} testID="profile-achievements" />
          <Divider />
          <Item icon="flag" label={t("goals", language)} onPress={() => router.push("/goals" as any)} testID="profile-goals" />
          <Divider />
          <Item icon="calendar-today" label={t("calendar", language)} onPress={() => router.push("/calendar" as any)} testID="profile-calendar" />
          <Divider />
          <Item icon="storefront" label={t("merchants", language)} onPress={() => router.push("/merchants" as any)} testID="profile-merchants" />
        </Card>

        <Card>
          <Item icon="dark-mode" label={`${t("theme", language)}: ${mode === "dark" ? t("theme_dark", language) : t("theme_light", language)}`} onPress={toggleMode} testID="toggle-theme" />
          <Divider />
          <Item icon="language" label={`${t("language", language)}: ${currentLang}`} onPress={() => setLangSheet(true)} testID="open-language-picker" />
          <Divider />
          <Item icon="file-download" label={t("export", language)} onPress={() => router.push("/export" as any)} testID="profile-export" />
          <Divider />
          <Item icon="cloud" label={t("backup", language)} onPress={() => router.push("/backup" as any)} testID="profile-backup" />
        </Card>

        <Card>
          <Item icon="settings" label={t("settings", language)} onPress={() => router.push("/settings" as any)} testID="profile-settings" />
          <Divider />
          <Item icon="logout" label={t("logout", language)} onPress={out} testID="logout-button" danger />
        </Card>
        <Text style={{ color: colors.textMuted, textAlign: "center", fontSize: 11, marginTop: 6 }}>{t("app_signature", language)}</Text>
      </ScrollView>
      <LanguagePickerSheet
        visible={langSheet}
        onClose={() => setLangSheet(false)}
        onSelect={onLangSelect}
        current={language}
      />
    </SafeAreaView>
  );
}

function Item({ icon, label, onPress, danger, testID }: { icon: string; label: string; onPress: () => void; danger?: boolean; testID?: string }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity testID={testID} onPress={onPress} activeOpacity={0.7} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12 }}>
      <MaterialIcons name={icon as any} size={20} color={danger ? colors.danger : colors.text} />
      <Text style={{ color: danger ? colors.danger : colors.text, fontWeight: "600", flex: 1 }}>{label}</Text>
      <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.border }} />;
}

function Mini({ label, value, icon }: { label: string; value: string; icon: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 14 }}>
      <MaterialIcons name={icon as any} size={20} color={colors.primary} />
      <Text style={{ color: colors.text, fontWeight: "800", fontSize: 20, marginTop: 6 }}>{value}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 11 }}>{label}</Text>
    </View>
  );
}
