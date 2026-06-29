// Localized month names (short, 3-letter style) and day-of-week initials
// for all 11 supported languages. Used by format.ts + calendar components.
import type { Language } from "@/src/lib/i18n";

// Month names — short / readable form (3-4 chars or culturally native short form)
export const MONTHS_SHORT: Record<Language, string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  hi: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  mr: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  gu: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  ta: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  te: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  ml: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  bn: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  pa: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  ur: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  or: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

// Full month names for headers like "February 2026"
export const MONTHS_FULL: Record<Language, string[]> = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  hi: ["Janvari", "Farvari", "March", "April", "Mai", "Joon", "Julai", "Agast", "Sitambar", "Aktoobar", "Navambar", "Disambar"],
  mr: ["Janevari", "Februvari", "March", "April", "Mey", "June", "Julai", "Ogast", "Septembar", "Oktobar", "Novhembar", "Disembar"],
  gu: ["Janyuari", "Februari", "March", "April", "Me", "Jun", "Julai", "Ogast", "Septembar", "Oktobar", "Novembar", "Disembar"],
  ta: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  te: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  ml: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  bn: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  pa: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  ur: ["Janwari", "Farwari", "March", "April", "Mai", "Joon", "Julai", "Agast", "Sitambar", "Aktoobar", "Nawambar", "Disambar"],
  or: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

// Day initials (Sun=0 .. Sat=6)
export const DAY_INITIALS: Record<Language, string[]> = {
  en: ["S", "M", "T", "W", "T", "F", "S"],
  hi: ["R", "S", "M", "B", "G", "S", "S"], // Ra(vi) So(m) Ma(ngal) Bu(dh) Gu(ru) Sh(ukra) Sha(ni)
  mr: ["R", "S", "M", "B", "G", "S", "S"],
  gu: ["R", "S", "M", "B", "G", "S", "S"],
  ta: ["Ñ", "T", "C", "B", "V", "V", "S"], // Tamil initials approximated
  te: ["A", "S", "M", "B", "G", "S", "S"],
  ml: ["Ñ", "T", "C", "B", "V", "V", "S"],
  bn: ["R", "S", "M", "B", "B", "S", "S"],
  pa: ["E", "S", "M", "B", "V", "S", "S"],
  ur: ["E", "P", "M", "B", "J", "J", "H"],
  or: ["R", "S", "M", "B", "G", "S", "S"],
};

export function tMonthShort(monthIdxOneBased: number, lang: Language = "en"): string {
  const arr = MONTHS_SHORT[lang] || MONTHS_SHORT.en;
  return arr[Math.max(0, Math.min(11, monthIdxOneBased - 1))];
}

export function tMonthFull(monthIdxOneBased: number, lang: Language = "en"): string {
  const arr = MONTHS_FULL[lang] || MONTHS_FULL.en;
  return arr[Math.max(0, Math.min(11, monthIdxOneBased - 1))];
}

export function tDayInitials(lang: Language = "en"): string[] {
  return DAY_INITIALS[lang] || DAY_INITIALS.en;
}

/** "DD MMM" in current language e.g. "12 Feb" / "12 Farvari" / "12 Janvari" */
export function tDateShort(iso: string | Date, lang: Language = "en"): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getDate()} ${tMonthShort(d.getMonth() + 1, lang)}`;
}

/** "Month YYYY" header */
export function tMonthYear(monthOneBased: number, year: number, lang: Language = "en"): string {
  return `${tMonthFull(monthOneBased, lang)} ${year}`;
}
