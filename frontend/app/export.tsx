import React, { useState } from "react";
import { View, Text, ScrollView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { useTheme } from "@/src/contexts/ThemeContext";
import { api } from "@/src/lib/api";
import { Card, GradientButton, ScreenHeader } from "@/src/components/ui";
import { spacing } from "@/src/lib/theme";
import { t } from "@/src/lib/i18n";

export default function Export() {
  const { colors, language } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const exportCSV = async () => {
    setMsg(null); setLoading(true);
    try {
      const r = await api<{ filename: string; content: string }>("/export/csv");
      if (Platform.OS === "web") {
        const blob = new Blob([r.content], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = r.filename; a.click();
        URL.revokeObjectURL(url);
        setMsg(t("download_success", language));
      } else {
        const uri = FileSystem.cacheDirectory + r.filename;
        await FileSystem.writeAsStringAsync(uri, r.content, { encoding: FileSystem.EncodingType.UTF8 });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: "text/csv", dialogTitle: t("export_title", language) });
        }
        setMsg(t("saved_share_sheet", language));
      }
    } catch (e: any) {
      setMsg(e.message);
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={t("export_title", language)} back onBack={() => router.back()} subtitle={t("export_screen_sub", language)} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: 12 }}>
        <Card>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <MaterialIcons name="table-chart" size={28} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>{t("csv_excel", language)}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t("csv_excel_sub", language)}</Text>
            </View>
          </View>
          <GradientButton testID="export-csv-button" label={loading ? t("exporting", language) : t("export_csv_btn", language)} onPress={exportCSV} loading={loading} icon="file-download" style={{ marginTop: 14 }} />
        </Card>
        <Card>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <MaterialIcons name="picture-as-pdf" size={28} color={colors.danger} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>{t("pdf_report", language)}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t("pdf_report_sub", language)}</Text>
            </View>
          </View>
        </Card>
        {msg ? <Text style={{ color: colors.primary, textAlign: "center", marginTop: 8 }}>{msg}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
