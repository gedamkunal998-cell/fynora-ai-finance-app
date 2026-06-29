import React from "react";
import { View, Text, Modal, TouchableOpacity, ScrollView, Pressable, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";

import { useTheme } from "@/src/contexts/ThemeContext";
import { Language, SUPPORTED_LANGUAGES, t } from "@/src/lib/i18n";
import { spacing, radii } from "@/src/lib/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (lang: Language) => void;
  current: Language;
};

export function LanguagePickerSheet({ visible, onClose, onSelect, current }: Props) {
  const { colors, language } = useTheme();

  return (
    <Modal visible={visible} transparent animationType={Platform.OS === "ios" ? "slide" : "fade"} onRequestClose={onClose}>
      <Pressable testID="lang-sheet-backdrop" onPress={onClose} style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, paddingTop: spacing.md, paddingBottom: 8, maxHeight: "85%", borderWidth: 1, borderColor: colors.border }}>
          <SafeAreaView edges={["bottom"]}>
            <View style={{ alignItems: "center", marginBottom: 6 }}>
              <View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong }} />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: 10 }}>
              <MaterialIcons name="language" size={22} color={colors.primary} />
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800", flex: 1 }}>
                {t("choose_language", language)}
              </Text>
              <TouchableOpacity testID="lang-sheet-close" onPress={onClose} hitSlop={10}>
                <MaterialIcons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 12, paddingHorizontal: spacing.lg, marginBottom: 6 }}>
              {t("choose_language_hint", language)}
            </Text>
            <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: 8 }}>
              {SUPPORTED_LANGUAGES.map((l) => {
                const selected = l.code === current;
                return (
                  <TouchableOpacity
                    key={l.code}
                    testID={`lang-option-${l.code}`}
                    onPress={() => onSelect(l.code)}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      paddingVertical: 14,
                      paddingHorizontal: 14,
                      borderRadius: radii.lg,
                      borderWidth: 1.5,
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? `${colors.primary}14` : colors.surfaceAlt,
                    }}
                  >
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        borderWidth: 2,
                        borderColor: selected ? colors.primary : colors.borderStrong,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {selected ? (
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} />
                      ) : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>{l.native}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 11 }}>{l.english}</Text>
                    </View>
                    {selected ? <MaterialIcons name="check-circle" size={20} color={colors.primary} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
