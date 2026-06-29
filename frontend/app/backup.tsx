import React, { useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";

import { useTheme } from "@/src/contexts/ThemeContext";
import { api } from "@/src/lib/api";
import { Card, GradientButton, GhostButton, ScreenHeader } from "@/src/components/ui";
import { spacing } from "@/src/lib/theme";
import { t } from "@/src/lib/i18n";

type BackupResp = {
  schema: number;
  exported_at: string;
  user_email?: string;
  counts: { transactions: number; budgets: number; goals: number; achievements: number };
  transactions: any[];
  budgets: any[];
  goals: any[];
  achievements: any[];
  settings: any;
};

export default function Backup() {
  const { colors, language } = useTheme();
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [lastSummary, setLastSummary] = useState<BackupResp["counts"] | null>(null);

  const onExport = async () => {
    setErr(null); setInfo(null); setExporting(true);
    try {
      const data = await api<BackupResp>("/backup");
      setLastSummary(data.counts);
      const json = JSON.stringify(data, null, 2);
      const filename = `fynora-backup-${new Date().toISOString().slice(0, 10)}.json`;
      if (Platform.OS === "web") {
        const w: any = globalThis;
        if (w.window?.Blob && w.window?.URL) {
          const blob = new w.window.Blob([json], { type: "application/json" });
          const url = w.window.URL.createObjectURL(blob);
          const a = w.document.createElement("a");
          a.href = url; a.download = filename; a.click();
          w.window.URL.revokeObjectURL(url);
          setInfo(t("backup_downloaded", language));
        } else {
          setInfo(t("backup_ready", language));
        }
      } else {
        const fileUri = `${(FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory}${filename}`;
        await (FileSystem as any).writeAsStringAsync(fileUri, json, { encoding: (FileSystem as any).EncodingType?.UTF8 || "utf8" });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, { mimeType: "application/json", dialogTitle: t("share_backup", language) });
          setInfo(t("backup_ready", language));
        } else {
          setInfo(`${t("backup_saved_at", language)} ${fileUri}`);
        }
      }
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setExporting(false);
    }
  };

  const onRestore = async () => {
    setErr(null); setInfo(null); setRestoring(true);
    try {
      const pick = await DocumentPicker.getDocumentAsync({ type: ["application/json", "*/*"], copyToCacheDirectory: true });
      if (pick.canceled || !pick.assets?.[0]) {
        setRestoring(false);
        return;
      }
      const asset = pick.assets[0];
      let raw = "";
      if (Platform.OS === "web") {
        if ((asset as any).file) {
          raw = await (asset as any).file.text();
        } else if ((asset as any).uri?.startsWith("data:")) {
          const b64 = (asset as any).uri.split(",")[1];
          raw = (globalThis as any).atob ? (globalThis as any).atob(b64) : "";
        }
      } else {
        raw = await (FileSystem as any).readAsStringAsync(asset.uri, { encoding: (FileSystem as any).EncodingType?.UTF8 || "utf8" });
      }
      if (!raw) throw new Error(t("backup_empty_file", language));
      const parsed = JSON.parse(raw);
      const res = await api<{ ok: boolean; added: any }>("/restore", {
        method: "POST",
        body: JSON.stringify({
          transactions: parsed.transactions || [],
          budgets: parsed.budgets || [],
          goals: parsed.goals || [],
          replace: false,
        }),
      });
      setLastSummary(res.added);
      setInfo(t("backup_restored", language));
    } catch (e: any) {
      setErr(e.message || t("backup_invalid", language));
    } finally {
      setRestoring(false);
    }
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={t("backup_title", language)} subtitle={t("backup_subtitle", language)} back onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: 12, paddingBottom: 80 }}>
        <Card>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
            <MaterialIcons name="cloud-download" size={24} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>{t("backup_export_title", language)}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4, lineHeight: 17 }}>{t("backup_export_hint", language)}</Text>
            </View>
          </View>
        </Card>

        <GradientButton testID="backup-export-button" icon="file-download" label={exporting ? t("exporting", language) : t("export_backup", language)} loading={exporting} onPress={onExport} />

        <Card>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
            <MaterialIcons name="restore" size={24} color={colors.info} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>{t("backup_restore_title", language)}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4, lineHeight: 17 }}>{t("backup_restore_hint", language)}</Text>
            </View>
          </View>
        </Card>

        <GhostButton testID="backup-restore-button" icon="upload-file" label={restoring ? t("restoring", language) : t("restore_backup", language)} onPress={onRestore} />
        {restoring ? <ActivityIndicator color={colors.primary} /> : null}

        {info ? <Text testID="backup-info" style={{ color: colors.primary, fontSize: 13 }}>{info}</Text> : null}
        {err ? <Text testID="backup-error" style={{ color: colors.danger, fontSize: 13 }}>{err}</Text> : null}

        {lastSummary ? (
          <Card testID="backup-summary">
            <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 6 }}>{t("backup_summary_title", language)}</Text>
            <Row label={t("transactions_label", language)} value={String(lastSummary.transactions ?? 0)} />
            <Row label={t("budgets_label", language)} value={String(lastSummary.budgets ?? 0)} />
            <Row label={t("goals_label_plain", language)} value={String(lastSummary.goals ?? 0)} />
            {typeof (lastSummary as any).achievements === "number" ? (
              <Row label={t("achievements_label", language)} value={String((lastSummary as any).achievements)} />
            ) : null}
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
      <Text style={{ color: colors.textMuted, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>{value}</Text>
    </View>
  );
}
