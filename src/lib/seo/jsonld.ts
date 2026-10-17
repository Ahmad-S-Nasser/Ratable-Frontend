import type { Locale } from "@/i18n/config";
import { absoluteUrl, siteUrl } from "@/lib/site";

/** JSON-LD builders. Rating data is never built here from anything but Verified reviews (added with the entity page). */
export type JsonLd = Record<string, unknown>;

export const organizationJsonLd = (): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${siteUrl}/#organization`,
  name: "Ratable",
  alternateName: "ريتابل",
  url: siteUrl,
  logo: absoluteUrl("/brand/ratable-app-icon.svg"),
});

export const websiteJsonLd = (lang: Locale): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${siteUrl}/#website`,
  name: "Ratable",
  alternateName: "ريتابل",
  url: absoluteUrl(`/${lang}`),
  inLanguage: lang,
  publisher: { "@id": `${siteUrl}/#organization` },
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: `${absoluteUrl(`/${lang}/search`)}?q={search_term_string}` },
    "query-input": "required name=search_term_string",
  },
});

export const breadcrumbJsonLd = (items: { name: string; path: string }[]): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: absoluteUrl(item.path) })),
});

export const itemListJsonLd = (items: { name: string; path: string }[]): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "ItemList",
  itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, url: absoluteUrl(item.path) })),
});

/** Serialises for a script tag. "<" is escaped so user-controlled text can never close the tag. */
export const serializeJsonLd = (data: JsonLd | JsonLd[]) => JSON.stringify(data).replace(/</g, "\u003c");
