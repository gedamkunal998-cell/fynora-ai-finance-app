// Currency + date formatters (localization-aware).
import { Language, tDay } from "@/src/lib/i18n";
import { tDateShort } from "@/src/lib/i18n-dates";

export function formatINR(n: number, compact = false): string {
  if (Number.isNaN(n) || n === undefined || n === null) return "₹0";
  if (compact && Math.abs(n) >= 100000) {
    const lakh = n / 100000;
    return `₹${lakh.toFixed(lakh >= 10 ? 1 : 2)}L`;
  }
  if (compact && Math.abs(n) >= 1000) {
    return `₹${(n / 1000).toFixed(n >= 10000 ? 1 : 2)}K`;
  }
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export function formatDate(iso: string | Date, lang: Language = "en"): string {
  return tDateShort(iso, lang);
}

export function formatDateShort(iso: string | Date, lang: Language = "en"): string {
  return tDateShort(iso, lang);
}

export function relativeDay(iso: string | Date, lang: Language = "en"): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((today.getTime() - start.getTime()) / 86400000);
  if (diff < 7 && diff >= 0) return tDay(diff, lang);
  return tDateShort(d, lang);
}
