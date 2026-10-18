import type { Locale } from "@/i18n/config";

type Localized = { ar?: string; en?: string } | null | undefined;

/**
 * The text in the page's language, or the other language when this one is empty. Names are stored as a pair, and a place added in one language only has
 * an empty string (not a missing value) in the other, so a plain "??" would show nothing. Always use this for names and labels.
 */
export function pick(text: Localized, lang: Locale, fallback = ""): string {
  const first = text?.[lang];
  if (first && first.trim()) return first;
  const other = text?.[lang === "ar" ? "en" : "ar"];
  return other && other.trim() ? other : fallback;
}
