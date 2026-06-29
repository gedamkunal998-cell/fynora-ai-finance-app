import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  Linking,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { MaterialIcons } from "@expo/vector-icons";

import { useTheme } from "@/src/contexts/ThemeContext";
import { api } from "@/src/lib/api";
import {
  Card,
  CategoryIcon,
  GradientButton,
  Input,
  ScreenHeader,
} from "@/src/components/ui";
import { ALL_CATEGORIES, spacing, radii } from "@/src/lib/theme";
import { t, tCat } from "@/src/lib/i18n";

type Parsed = {
  merchant?: string;
  amount?: number;
  currency?: string;
  date?: string | null;
  category_hint?: string;
};

type Stage = "choose" | "processing" | "review" | "error";

const KNOWN_CATEGORIES = new Set(ALL_CATEGORIES);

export default function ScanReceipt() {
  const { colors, language } = useTheme();
  const router = useRouter();

  const [stage, setStage] = useState<Stage>("choose");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [permissionBlocked, setPermissionBlocked] = useState(false);

  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(""); // YYYY-MM-DD
  const [saving, setSaving] = useState(false);

  const reset = useCallback(() => {
    setStage("choose");
    setImageUri(null);
    setErrorMsg(null);
    setAmount("");
    setMerchant("");
    setCategory("");
    setDate("");
  }, []);

  const sendToOcr = useCallback(
    async (base64: string, uri: string) => {
      setStage("processing");
      setImageUri(uri);
      setErrorMsg(null);
      try {
        const resp = await api<{ ok: boolean; parsed: Parsed }>("/ocr/receipt", {
          method: "POST",
          body: JSON.stringify({ image_base64: base64 }),
        });
        const p = resp.parsed || {};
        setAmount(p.amount != null ? String(p.amount) : "");
        setMerchant((p.merchant || "").trim());
        const hint = (p.category_hint || "").trim();
        setCategory(KNOWN_CATEGORIES.has(hint) ? hint : "");
        setDate(p.date && p.date !== "null" ? p.date : "");
        setStage("review");
      } catch (e: any) {
        const msg = String(e?.message || "");
        if (msg.includes("Premium required") || msg.includes("free OCR limit")) {
          setErrorMsg(t("ocr_premium_limit", language));
        } else {
          setErrorMsg(t("ocr_failed", language));
        }
        setStage("error");
      }
    },
    [language],
  );

  const pickFromCamera = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setPermissionBlocked(!perm.canAskAgain);
      setErrorMsg(t("ocr_no_permission", language));
      setStage("error");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.6,
      allowsEditing: false,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    if (!asset.base64) {
      setErrorMsg(t("ocr_failed", language));
      setStage("error");
      return;
    }
    await sendToOcr(asset.base64, asset.uri);
  }, [language, sendToOcr]);

  const pickFromGallery = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setPermissionBlocked(!perm.canAskAgain);
      setErrorMsg(t("ocr_no_permission", language));
      setStage("error");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.7,
      allowsEditing: false,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    if (!asset.base64) {
      setErrorMsg(t("ocr_failed", language));
      setStage("error");
      return;
    }
    await sendToOcr(asset.base64, asset.uri);
  }, [language, sendToOcr]);

  const saveTransaction = useCallback(async () => {
    const amt = parseFloat(amount);
    if (!amt || isNaN(amt) || amt <= 0) {
      setErrorMsg(t("ocr_invalid_amount", language));
      return;
    }
    if (!merchant.trim()) {
      setErrorMsg(t("enter_amount_merchant", language));
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      const body: Record<string, unknown> = {
        amount: amt,
        merchant: merchant.trim(),
        type: "debit",
        payment_method: "manual",
        source: "ocr",
      };
      if (category) body.category = category;
      if (date) body.date = new Date(`${date}T12:00:00Z`).toISOString();
      await api("/transactions", { method: "POST", body: JSON.stringify(body) });
      router.replace("/(tabs)/transactions" as any);
    } catch (e: any) {
      setErrorMsg(String(e?.message || "Failed to save"));
    } finally {
      setSaving(false);
    }
  }, [amount, merchant, category, date, language, router]);

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={t("ocr_title", language)} back onBack={() => router.back()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          testID="ocr-scroll"
          contentContainerStyle={{ padding: spacing.lg, gap: 14, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
        >
          {stage === "choose" && (
            <ChooseStage
              colors={colors}
              language={language}
              onCamera={pickFromCamera}
              onGallery={pickFromGallery}
            />
          )}

          {stage === "processing" && (
            <ProcessingStage colors={colors} language={language} imageUri={imageUri} />
          )}

          {stage === "review" && (
            <ReviewStage
              colors={colors}
              language={language}
              imageUri={imageUri}
              amount={amount}
              setAmount={setAmount}
              merchant={merchant}
              setMerchant={setMerchant}
              category={category}
              setCategory={setCategory}
              date={date}
              setDate={setDate}
              onRetake={reset}
              onSave={saveTransaction}
              saving={saving}
              errorMsg={errorMsg}
            />
          )}

          {stage === "error" && (
            <ErrorStage
              colors={colors}
              language={language}
              message={errorMsg}
              showSettings={permissionBlocked}
              onRetry={reset}
              onOpenSettings={() => Linking.openSettings()}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------- Sub-stages ----------

function ChooseStage({
  colors,
  language,
  onCamera,
  onGallery,
}: {
  colors: any;
  language: any;
  onCamera: () => void;
  onGallery: () => void;
}) {
  return (
    <View style={{ gap: 14 }}>
      <Card testID="ocr-intro-card">
        <View style={{ alignItems: "center", gap: 8, paddingVertical: 4 }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: `${colors.primary}22`,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MaterialIcons name="receipt-long" size={32} color={colors.primary} />
          </View>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800", textAlign: "center" }}>
            {t("ocr_title", language)}
          </Text>
          <Text
            style={{
              color: colors.textMuted,
              fontSize: 13,
              textAlign: "center",
              lineHeight: 18,
            }}
          >
            {t("ocr_sub", language)}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 6 }}>
            ✨ {t("ocr_powered_by", language)}
          </Text>
        </View>
      </Card>

      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
        {t("ocr_choose_source", language)}
      </Text>

      <TouchableOpacity
        testID="ocr-take-photo"
        onPress={onCamera}
        activeOpacity={0.85}
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radii.lg,
          padding: 18,
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: `${colors.primary}22`,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialIcons name="photo-camera" size={22} color={colors.primary} />
        </View>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700", flex: 1 }}>
          {t("ocr_take_photo", language)}
        </Text>
        <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} />
      </TouchableOpacity>

      <TouchableOpacity
        testID="ocr-pick-gallery"
        onPress={onGallery}
        activeOpacity={0.85}
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radii.lg,
          padding: 18,
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: `${colors.success}22`,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialIcons name="photo-library" size={22} color={colors.success} />
        </View>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700", flex: 1 }}>
          {t("ocr_pick_gallery", language)}
        </Text>
        <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

function ProcessingStage({
  colors,
  language,
  imageUri,
}: {
  colors: any;
  language: any;
  imageUri: string | null;
}) {
  return (
    <View testID="ocr-processing" style={{ alignItems: "center", gap: 14, paddingVertical: 30 }}>
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={{
            width: 200,
            height: 260,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
          }}
          resizeMode="cover"
        />
      ) : null}
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>
        {t("ocr_processing", language)}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>
        {t("ocr_powered_by", language)}
      </Text>
    </View>
  );
}

function ReviewStage({
  colors,
  language,
  imageUri,
  amount,
  setAmount,
  merchant,
  setMerchant,
  category,
  setCategory,
  date,
  setDate,
  onRetake,
  onSave,
  saving,
  errorMsg,
}: {
  colors: any;
  language: any;
  imageUri: string | null;
  amount: string;
  setAmount: (v: string) => void;
  merchant: string;
  setMerchant: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
  date: string;
  setDate: (v: string) => void;
  onRetake: () => void;
  onSave: () => void;
  saving: boolean;
  errorMsg: string | null;
}) {
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={{
              width: 80,
              height: 100,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.border,
            }}
            resizeMode="cover"
          />
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
            {t("ocr_review_title", language)}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
            {t("ocr_review_hint", language)}
          </Text>
        </View>
        <TouchableOpacity
          testID="ocr-retake"
          onPress={onRetake}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 12 }}>
            {t("ocr_retake", language)}
          </Text>
        </TouchableOpacity>
      </View>

      <Input
        testID="ocr-amount-input"
        icon="payments"
        placeholder={t("amount_placeholder", language)}
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
      />
      <Input
        testID="ocr-merchant-input"
        icon="storefront"
        placeholder={t("merchant_placeholder", language)}
        value={merchant}
        onChangeText={setMerchant}
      />
      <Input
        testID="ocr-date-input"
        icon="event"
        placeholder={`${t("ocr_date", language)} (YYYY-MM-DD)`}
        value={date}
        onChangeText={setDate}
        autoCapitalize="none"
      />

      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
        {t("pick_category", language)}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {ALL_CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c}
            testID={`ocr-cat-${c}`}
            onPress={() => setCategory(c === category ? "" : c)}
            style={{
              flexBasis: "30%",
              flexGrow: 1,
              alignItems: "center",
              gap: 6,
              paddingVertical: 10,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: category === c ? colors.primary : colors.border,
              backgroundColor: category === c ? `${colors.primary}22` : colors.surface,
            }}
          >
            <CategoryIcon category={c} size={28} />
            <Text style={{ color: colors.text, fontSize: 11 }} numberOfLines={1}>
              {tCat(c, language)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {errorMsg ? (
        <Text testID="ocr-error" style={{ color: colors.danger, fontSize: 13 }}>
          {errorMsg}
        </Text>
      ) : null}

      <GradientButton
        testID="ocr-save"
        label={t("save_transaction", language)}
        onPress={onSave}
        loading={saving}
        icon="check"
      />
    </View>
  );
}

function ErrorStage({
  colors,
  language,
  message,
  showSettings,
  onRetry,
  onOpenSettings,
}: {
  colors: any;
  language: any;
  message: string | null;
  showSettings: boolean;
  onRetry: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <View testID="ocr-error-stage" style={{ alignItems: "center", gap: 14, paddingVertical: 24 }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: `${colors.danger}22`,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialIcons name="error-outline" size={32} color={colors.danger} />
      </View>
      <Text
        style={{
          color: colors.text,
          fontSize: 15,
          fontWeight: "700",
          textAlign: "center",
          paddingHorizontal: 16,
        }}
      >
        {message || t("ocr_failed", language)}
      </Text>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
        {showSettings ? (
          <TouchableOpacity
            testID="ocr-open-settings"
            onPress={onOpenSettings}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              {t("ocr_open_settings", language)}
            </Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          testID="ocr-retry"
          onPress={onRetry}
          style={{
            paddingHorizontal: 18,
            paddingVertical: 12,
            borderRadius: 12,
            backgroundColor: colors.primary,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>
            {t("ocr_retake", language)}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
