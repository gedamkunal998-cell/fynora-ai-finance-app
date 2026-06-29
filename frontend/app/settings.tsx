import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Switch, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";

import { useTheme } from "@/src/contexts/ThemeContext";
import { useAuth } from "@/src/contexts/AuthContext";
import { Card, ScreenHeader } from "@/src/components/ui";
import { api } from "@/src/lib/api";
import { spacing } from "@/src/lib/theme";
import { t, SUPPORTED_LANGUAGES } from "@/src/lib/i18n";

export default function Settings() {
  const { colors, mode, setMode, language, setLanguage } = useTheme();
  const { user, setUserPartial } = useAuth();
  const router = useRouter();
  const [notif, setNotif] = useState(user?.notifications_enabled ?? true);

  const updateServer = async (patch: any) => {
    try {
      const next = await api<any>("/settings", { method: "PATCH", body: JSON.stringify(patch) });
      setUserPartial(next);
    } catch {}
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={t("settings", language)} back onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: 12, paddingBottom: 120 }}>
        <Card>
          <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 10 }}>{t("theme", language)}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["dark", "light"] as const).map((m) => (
              <TouchableOpacity
                key={m}
                testID={`theme-${m}`}
                onPress={() => { setMode(m); updateServer({ theme: m }); }}
                style={{
                  flex: 1, paddingVertical: 14, borderRadius: 12,
                  borderWidth: 1, borderColor: mode === m ? colors.primary : colors.border,
                  backgroundColor: mode === m ? `${colors.primary}22` : colors.surface,
                  alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "center",
                }}
              >
                <MaterialIcons name={m === "dark" ? "dark-mode" : "light-mode"} size={18} color={colors.text} />
                <Text style={{ color: colors.text, fontWeight: "600" }}>
                  {m === "dark" ? t("theme_dark", language) : t("theme_light", language)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        <Card>
          <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 10 }}>{t("language", language)}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {SUPPORTED_LANGUAGES.map((l) => (
              <TouchableOpacity
                key={l.code}
                testID={`lang-${l.code}`}
                onPress={() => { setLanguage(l.code); updateServer({ language: l.code }); }}
                style={{
                  paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12,
                  borderWidth: 1, borderColor: language === l.code ? colors.primary : colors.border,
                  backgroundColor: language === l.code ? `${colors.primary}22` : colors.surface,
                  minWidth: 92, alignItems: "center",
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>{l.native}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 2 }}>{l.english}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <MaterialIcons name="notifications" size={22} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>{t("notifications", language)}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 11 }}>{t("notif_sub", language)}</Text>
            </View>
            <Switch
              testID="notif-switch"
              value={notif}
              onValueChange={(v) => { setNotif(v); updateServer({ notifications_enabled: v }); }}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
        </Card>

        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <MaterialIcons name="cloud" size={22} color={colors.info} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>{t("backup", language)}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 11 }}>{t("backup_sub", language)}</Text>
            </View>
          </View>
        </Card>

        <Card>
          <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 8 }}>{t("push_notifs", language)}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
            {t("push_notifs_sub", language)}
            {Platform.OS === "web" ? t("browser_no_push", language) : ""}
          </Text>
        </Card>

        <TouchableOpacity testID="open-export" onPress={() => router.push("/export" as any)}>
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <MaterialIcons name="file-download" size={22} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>{t("export", language)}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>{t("export_sub", language)}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
            </View>
          </Card>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
