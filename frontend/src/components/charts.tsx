// SVG-based charts: Pie (donut), Bar, Line, Gauge.
import React from "react";
import { View, Text } from "react-native";
import Svg, { Circle, Path, Rect, Defs, LinearGradient, Stop, G, Line, Text as SvgText } from "react-native-svg";

import { useTheme } from "@/src/contexts/ThemeContext";
import { CATEGORY_META } from "@/src/lib/theme";
import { formatINR } from "@/src/lib/format";
import { tDayInitials } from "@/src/lib/i18n-dates";
import { t } from "@/src/lib/i18n";

// ---------------------------------------------------------------------------
// Donut / Pie
// ---------------------------------------------------------------------------
export function DonutChart({
  data,
  size = 200,
  thickness = 26,
  centerLabel,
  centerSub,
}: {
  data: { label: string; value: number; color?: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerSub?: string;
}) {
  const { colors } = useTheme();
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={r} stroke={colors.surfaceAlt} strokeWidth={thickness} fill="none" />
        {data.map((d, i) => {
          const len = (d.value / total) * circumference;
          const color = d.color || CATEGORY_META[d.label]?.color || "#9CA3AF";
          const dashArr = `${len} ${circumference - len}`;
          const node = (
            <Circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              stroke={color}
              strokeWidth={thickness}
              fill="none"
              strokeDasharray={dashArr}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          );
          offset += len;
          return node;
        })}
      </Svg>
      <View style={{ position: "absolute", alignItems: "center" }}>
        {centerLabel ? (
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 20 }}>{centerLabel}</Text>
        ) : null}
        {centerSub ? (
          <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>{centerSub}</Text>
        ) : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Spending Score Gauge (half-donut)
// ---------------------------------------------------------------------------
export function GaugeChart({ score, size = 200 }: { score: number; size?: number }) {
  const { colors } = useTheme();
  const stroke = 18;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size - stroke;
  // half circle from 180deg to 0deg (left to right)
  const startAngle = Math.PI;
  const endAngle = Math.PI - (score / 100) * Math.PI;
  const arc = (a1: number, a2: number) => {
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy - r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2);
    const y2 = cy - r * Math.sin(a2);
    const large = Math.abs(a1 - a2) > Math.PI ? 1 : 0;
    const sweep = a2 > a1 ? 0 : 1;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} ${sweep} ${x2} ${y2}`;
  };
  const color = score >= 85 ? "#00D09C" : score >= 65 ? "#00B4D8" : score >= 40 ? "#F59E0B" : "#EF4444";
  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={size} height={size / 2 + stroke}>
        <Defs>
          <LinearGradient id="gg" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={color} stopOpacity="0.4" />
            <Stop offset="1" stopColor={color} />
          </LinearGradient>
        </Defs>
        <Path
          d={arc(startAngle, 0)}
          stroke={colors.surfaceAlt}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
        />
        <Path
          d={arc(startAngle, endAngle)}
          stroke="url(#gg)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
      <View style={{ alignItems: "center", marginTop: -size / 3 }}>
        <Text style={{ color: colors.text, fontWeight: "800", fontSize: 40 }}>{score}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>out of 100</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Bar chart (vertical)
// ---------------------------------------------------------------------------
export function BarChartMini({
  data,
  height = 140,
  barColor,
}: {
  data: { label: string; value: number }[];
  height?: number;
  barColor?: string;
}) {
  const { colors } = useTheme();
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10, height }}>
      {data.map((d, i) => {
        const h = (d.value / max) * (height - 24);
        return (
          <View key={i} style={{ flex: 1, alignItems: "center" }}>
            <View
              style={{
                width: "70%",
                height: Math.max(h, 4),
                backgroundColor: barColor || colors.primary,
                borderRadius: 6,
                opacity: 0.9,
              }}
            />
            <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 6 }} numberOfLines={1}>
              {d.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Line chart
// ---------------------------------------------------------------------------
export function LineChartMini({
  data,
  width = 320,
  height = 140,
}: {
  data: { label: string; value: number }[];
  width?: number;
  height?: number;
}) {
  const { colors } = useTheme();
  if (!data.length) return null;
  const pad = 16;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const max = Math.max(...data.map((d) => d.value), 1);
  const min = 0;
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const pts = data.map((d, i) => [pad + i * step, pad + h - ((d.value - min) / (max - min)) * h]);
  const path = pts.reduce(
    (acc, [x, y], i) => acc + (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`),
    "",
  );
  const areaPath = `${path} L ${pts[pts.length - 1][0]} ${pad + h} L ${pts[0][0]} ${pad + h} Z`;
  return (
    <View>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="line-area" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.primary} stopOpacity="0.4" />
            <Stop offset="1" stopColor={colors.primary} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path d={areaPath} fill="url(#line-area)" />
        <Path d={path} stroke={colors.primary} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        {pts.map(([x, y], i) => (
          <Circle key={i} cx={x} cy={y} r={3} fill={colors.primary} />
        ))}
      </Svg>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Calendar heatmap
// ---------------------------------------------------------------------------
export function SpendCalendar({
  days,
  month,
  year,
  lang = "en",
}: {
  days: { date: string; amount: number }[];
  month: number;
  year: number;
  lang?: import("@/src/lib/i18n").Language;
}) {
  const { colors } = useTheme();
  const map: Record<string, number> = {};
  days.forEach((d) => (map[d.date] = d.amount));
  const max = Math.max(...days.map((d) => d.amount), 1);
  const first = new Date(year, month - 1, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const grid: ({ day: number; key: string } | null)[] = [];
  for (let i = 0; i < startWeekday; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    grid.push({ day: d, key });
  }
  const colorFor = (amount: number) => {
    if (!amount) return colors.surface;
    const ratio = amount / max;
    if (ratio < 0.34) return "#00D09C44";
    if (ratio < 0.67) return "#F59E0B44";
    return "#EF444466";
  };
  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
        {tDayInitials(lang).map((d, i) => (
          <Text key={i} style={{ color: colors.textMuted, width: 36, textAlign: "center", fontSize: 11 }}>
            {d}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
        {grid.map((cell, i) => {
          if (!cell) return <View key={i} style={{ width: 36, height: 36 }} />;
          const amount = map[cell.key] || 0;
          return (
            <View
              key={i}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: colorFor(amount),
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>{cell.day}</Text>
              {amount ? (
                <Text style={{ color: colors.textMuted, fontSize: 8 }}>{formatINR(amount, true)}</Text>
              ) : null}
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 14, marginTop: 12 }}>
        <Legend color="#00D09C44" label={t("legend_low", lang)} />
        <Legend color="#F59E0B44" label={t("legend_medium", lang)} />
        <Legend color="#EF444466" label={t("legend_high", lang)} />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ color: colors.textMuted, fontSize: 11 }}>{label}</Text>
    </View>
  );
}
