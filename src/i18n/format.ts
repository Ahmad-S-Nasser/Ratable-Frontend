import type { Locale } from "./config";

/** Fills {name}-style placeholders in a translation string. */
export const fmt = (template: string, vars: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`));

const locale = (lang: Locale) => (lang === "ar" ? "ar-EG" : "en-GB");

export const formatNumber = (lang: Locale, n: number, digits = 0) =>
  n.toLocaleString(locale(lang), { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const formatScore = (lang: Locale, n: number) => formatNumber(lang, Math.round(n * 10) / 10, 1);

export const formatDate = (lang: Locale, iso: string) =>
  new Date(iso).toLocaleDateString(locale(lang), { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
