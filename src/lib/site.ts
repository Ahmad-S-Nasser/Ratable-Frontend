import type { Locale } from "@/i18n/config";

/** The one public origin (the API is /api on the same origin). Set NEXT_PUBLIC_SITE_URL in production. */
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const absoluteUrl = (path: string) => `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;

/** Country-targeted hreflang values for the Arabic pages, plus English (rule: ar-EG, ar-SA, ar-AE, en). */
export const hreflangTargets = [
  { hreflang: "ar-EG", lang: "ar" },
  { hreflang: "ar-SA", lang: "ar" },
  { hreflang: "ar-AE", lang: "ar" },
  { hreflang: "en", lang: "en" },
] as const satisfies readonly { hreflang: string; lang: Locale }[];

export const ogLocale: Record<Locale, string> = { ar: "ar_EG", en: "en_US" };
