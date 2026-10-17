export const locales = ["ar", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ar";

export const isLocale = (value: string): value is Locale =>
  (locales as readonly string[]).includes(value);

export const direction = (lang: Locale) => (lang === "ar" ? "rtl" : "ltr");
