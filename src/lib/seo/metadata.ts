import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";
import { locales } from "@/i18n/config";
import { absoluteUrl, hreflangTargets, ogLocale } from "@/lib/site";

type Input = {
  lang: Locale;
  /** The path without the language, for example "" for the home page or "/categories". */
  path: string;
  title: string;
  description: string;
  /** Empty or thin pages, and anything that is not meant for search, are noindex. */
  noindex?: boolean;
  image?: string;
  type?: "website" | "article";
};

/**
 * The one place page metadata is built: unique title and description, canonical (always the base page, never a filtered or sorted one),
 * hreflang for every language, Open Graph and the robots directive.
 */
export function buildMetadata({ lang, path, title, description, noindex = false, image, type = "website" }: Input): Metadata {
  const url = absoluteUrl(`/${lang}${path}`);
  const languages: Record<string, string> = {};
  for (const target of hreflangTargets) languages[target.hreflang] = absoluteUrl(`/${target.lang}${path}`);
  languages["x-default"] = absoluteUrl(`/ar${path}`);

  return {
    title,
    description,
    alternates: { canonical: url, languages },
    robots: noindex ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      title,
      description,
      url,
      type,
      siteName: lang === "ar" ? "ريتابل" : "Ratable",
      locale: ogLocale[lang],
      alternateLocale: locales.filter((l) => l !== lang).map((l) => ogLocale[l]),
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: { card: "summary_large_image", title, description },
  };
}
