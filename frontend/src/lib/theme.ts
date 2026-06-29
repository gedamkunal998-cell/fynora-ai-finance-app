// Centralised theme tokens for Fynora.
// Both dark and light palettes. Components consume via useTheme().

export type ThemeMode = "dark" | "light";

export const palette = {
  dark: {
    bg: "#0D1117",
    surface: "#161B22",
    surfaceAlt: "#1C212B",
    border: "rgba(255,255,255,0.08)",
    borderStrong: "rgba(255,255,255,0.14)",
    text: "#FFFFFF",
    textMuted: "#9CA3AF",
    textDim: "#6B7280",
    primary: "#00D09C",
    primaryAlt: "#00B4D8",
    secondary: "#6366F1",
    secondaryAlt: "#9B5CF6",
    success: "#00D09C",
    danger: "#EF4444",
    warning: "#F59E0B",
    info: "#00B4D8",
    overlay: "rgba(0,0,0,0.65)",
  },
  light: {
    bg: "#F6F7FB",
    surface: "#FFFFFF",
    surfaceAlt: "#F0F2F7",
    border: "rgba(0,0,0,0.08)",
    borderStrong: "rgba(0,0,0,0.14)",
    text: "#0D1117",
    textMuted: "#4B5563",
    textDim: "#9CA3AF",
    primary: "#00B07A",
    primaryAlt: "#0096B8",
    secondary: "#4F46E5",
    secondaryAlt: "#7C3AED",
    success: "#0FA876",
    danger: "#DC2626",
    warning: "#D97706",
    info: "#0096B8",
    overlay: "rgba(0,0,0,0.4)",
  },
} as const;

export type Palette = (typeof palette)["dark"];

export const gradients = {
  primary: ["#00D09C", "#00B4D8"] as const,
  secondary: ["#6366F1", "#9B5CF6"] as const,
  danger: ["#EF4444", "#F97316"] as const,
  card: ["#161B22", "#1C212B"] as const,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
};

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};

export const fontFamily = {
  regular: "System",
  medium: "System",
  bold: "System",
};

export const CATEGORY_META: Record<
  string,
  { icon: string; color: string; emoji: string }
> = {
  Food: { icon: "restaurant", color: "#F97316", emoji: "🍔" },
  Fuel: { icon: "local-gas-station", color: "#10B981", emoji: "⛽" },
  Shopping: { icon: "shopping-bag", color: "#EC4899", emoji: "🛍️" },
  Travel: { icon: "flight", color: "#06B6D4", emoji: "✈️" },
  Bills: { icon: "receipt-long", color: "#F59E0B", emoji: "🧾" },
  Healthcare: { icon: "local-hospital", color: "#EF4444", emoji: "🏥" },
  Education: { icon: "school", color: "#3B82F6", emoji: "📚" },
  Entertainment: { icon: "movie", color: "#A855F7", emoji: "🎬" },
  Rent: { icon: "home", color: "#14B8A6", emoji: "🏠" },
  EMI: { icon: "account-balance", color: "#F97316", emoji: "🏦" },
  Salary: { icon: "payments", color: "#22C55E", emoji: "💰" },
  Investment: { icon: "trending-up", color: "#0EA5E9", emoji: "📈" },
  Others: { icon: "category", color: "#9CA3AF", emoji: "📦" },
};

export const ALL_CATEGORIES = Object.keys(CATEGORY_META);
