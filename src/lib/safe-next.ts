import type { Locale } from "@/i18n/config";

/**
 * Where to go after signing in. Only a path on this site that starts with a language is accepted, so a link such as
 * /ar/sign-in?next=https://evil.example can never send a signed-in person to another site.
 */
export function safeNext(next: string | null | undefined, lang: Locale, fallback?: string): string {
  if (!next || !/^\/(ar|en)(\/|$|\?|#)/.test(next) || next.startsWith("//") || next.includes("\\")) return fallback ?? `/${lang}`;
  return next;
}
