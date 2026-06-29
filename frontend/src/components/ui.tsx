// Reusable UI primitives for Fynora.
import React, { ReactNode } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
  StyleProp,
  ActivityIndicator,
  TextInput,
  TextInputProps,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Defs, LinearGradient as SvgLG, Stop } from "react-native-svg";
import { MaterialIcons } from "@expo/vector-icons";

import { useTheme } from "@/src/contexts/ThemeContext";
import { gradients, radii, spacing, CATEGORY_META } from "@/src/lib/theme";

// -----------------------------------------------------------------------
// Card
// -----------------------------------------------------------------------
export function Card({
  children,
  style,
  testID,
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  padded?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radii.lg,
          padding: padded ? spacing.lg : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// -----------------------------------------------------------------------
// GradientCard
// -----------------------------------------------------------------------
export function GradientCard({
  children,
  colors: g,
  style,
  testID,
}: {
  children: ReactNode;
  colors?: readonly [string, string, ...string[]];
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <LinearGradient
      testID={testID}
      colors={(g || gradients.primary) as any}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ borderRadius: radii.lg, padding: spacing.lg }, style]}
    >
      {children}
    </LinearGradient>
  );
}

// -----------------------------------------------------------------------
// GradientButton
// -----------------------------------------------------------------------
export function GradientButton({
  label,
  onPress,
  loading,
  disabled,
  testID,
  icon,
  variant = "primary",
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  icon?: string;
  variant?: "primary" | "secondary" | "danger";
  style?: StyleProp<ViewStyle>;
}) {
  const map: Record<string, readonly [string, string]> = {
    primary: gradients.primary,
    secondary: gradients.secondary,
    danger: gradients.danger,
  };
  return (
    <TouchableOpacity
      testID={testID}
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled || loading}
      style={[{ borderRadius: radii.lg, overflow: "hidden", opacity: disabled ? 0.6 : 1 }, style]}
    >
      <LinearGradient
        colors={map[variant] as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          paddingVertical: 14,
          paddingHorizontal: spacing.lg,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            {icon ? <MaterialIcons name={icon as any} size={18} color="#fff" /> : null}
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15, letterSpacing: 0.3 }}>
              {label}
            </Text>
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

// -----------------------------------------------------------------------
// PrimaryButton (outline / ghost variants)
// -----------------------------------------------------------------------
export function GhostButton({
  label,
  onPress,
  testID,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
  icon?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        {
          paddingVertical: 12,
          paddingHorizontal: spacing.lg,
          borderRadius: radii.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          flexDirection: "row",
          gap: 8,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      {icon ? <MaterialIcons name={icon as any} size={18} color={colors.text} /> : null}
      <Text style={{ color: colors.text, fontWeight: "600", fontSize: 14 }}>{label}</Text>
    </TouchableOpacity>
  );
}

// -----------------------------------------------------------------------
// Input
// -----------------------------------------------------------------------
export function Input({
  icon,
  rightIcon,
  onRightPress,
  testID,
  style,
  ...rest
}: TextInputProps & {
  icon?: string;
  rightIcon?: string;
  onRightPress?: () => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radii.md,
          paddingHorizontal: 14,
          height: 52,
        },
        style as any,
      ]}
    >
      {icon ? (
        <MaterialIcons name={icon as any} size={18} color={colors.textMuted} style={{ marginRight: 10 }} />
      ) : null}
      <TextInput
        testID={testID}
        placeholderTextColor={colors.textMuted}
        style={{
          flex: 1,
          color: colors.text,
          fontSize: 15,
          paddingVertical: 12,
        }}
        {...rest}
      />
      {rightIcon ? (
        <TouchableOpacity onPress={onRightPress} testID={`${testID}-right`}>
          <MaterialIcons name={rightIcon as any} size={20} color={colors.textMuted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// -----------------------------------------------------------------------
// Logo
// -----------------------------------------------------------------------
export function FynoraLogo({ size = 64 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <SvgLG id="lg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#00D09C" />
          <Stop offset="0.5" stopColor="#00B4D8" />
          <Stop offset="1" stopColor="#6366F1" />
        </SvgLG>
      </Defs>
      {/* squircle bg */}
      <Path
        d="M16 4 H48 A12 12 0 0 1 60 16 V48 A12 12 0 0 1 48 60 H16 A12 12 0 0 1 4 48 V16 A12 12 0 0 1 16 4 Z"
        fill="#0D1117"
        stroke="url(#lg)"
        strokeWidth="1.5"
      />
      {/* F shape */}
      <Path
        d="M18 14 H44 V22 H26 V30 H40 V38 H26 V50 H18 Z"
        fill="url(#lg)"
      />
      {/* arrow */}
      <Path
        d="M34 44 L46 32 M40 32 H46 V38"
        stroke="#FFFFFF"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

// -----------------------------------------------------------------------
// Header
// -----------------------------------------------------------------------
export function ScreenHeader({
  title,
  subtitle,
  right,
  back,
  onBack,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  back?: boolean;
  onBack?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      {back ? (
        <TouchableOpacity
          testID="back-button"
          onPress={onBack}
          style={{
            width: 38,
            height: 38,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.surface,
          }}
        >
          <MaterialIcons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 22 }}>{title}</Text>
        {subtitle ? (
          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>{subtitle}</Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

// -----------------------------------------------------------------------
// CategoryIcon
// -----------------------------------------------------------------------
export function CategoryIcon({ category, size = 40 }: { category: string; size?: number }) {
  const meta = CATEGORY_META[category] || CATEGORY_META.Others;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: `${meta.color}22`,
        borderColor: `${meta.color}55`,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <MaterialIcons name={meta.icon as any} size={size * 0.5} color={meta.color} />
    </View>
  );
}

// -----------------------------------------------------------------------
// Empty
// -----------------------------------------------------------------------
export function EmptyState({
  icon = "inbox",
  title,
  message,
  testID,
}: {
  icon?: string;
  title: string;
  message?: string;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={{ alignItems: "center", padding: spacing.xxl, gap: 8 }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialIcons name={icon as any} size={28} color={colors.textMuted} />
      </View>
      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16, marginTop: 8 }}>{title}</Text>
      {message ? (
        <Text style={{ color: colors.textMuted, textAlign: "center", maxWidth: 280, fontSize: 13 }}>{message}</Text>
      ) : null}
    </View>
  );
}

// -----------------------------------------------------------------------
// Pill (filter chip)
// -----------------------------------------------------------------------
export function Pill({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        flexShrink: 0,
        height: 36,
        paddingHorizontal: 14,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active ? `${colors.primary}22` : colors.surface,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: active ? colors.primary : colors.text, fontWeight: "600", fontSize: 13 }}>{label}</Text>
    </TouchableOpacity>
  );
}

export const uiStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
});
