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

type EntityJsonLdInput = {
  lang: Locale;
  url: string;
  schemaType: string;
  name: string;
  description: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  sameAs: string[];
  /** Only Verified reviews: the same numbers the page shows. */
  rating: { value: number; count: number } | null;
  reviews: { author: string | null; rating: number | null; text: string | null; date: string; language: string }[];
};

/**
 * The entity page's schema.org block. AggregateRating is built only from Verified reviews and only when there are some, so it always
 * matches what the page shows. An anonymous review carries the author name "Anonymous" and nothing else (rule 1).
 */
export const entityJsonLd = (i: EntityJsonLdInput): JsonLd => ({
  "@context": "https://schema.org",
  "@type": i.schemaType,
  "@id": `${i.url}#entity`,
  name: i.name,
  url: i.url,
  description: i.description,
  inLanguage: i.lang,
  ...(i.address || i.city || i.country
    ? { address: { "@type": "PostalAddress", streetAddress: i.address ?? undefined, addressLocality: i.city ?? undefined, addressCountry: i.country ?? undefined } }
    : {}),
  ...(i.sameAs.length ? { sameAs: i.sameAs } : {}),
  ...(i.rating ? { aggregateRating: { "@type": "AggregateRating", ratingValue: i.rating.value, reviewCount: i.rating.count, bestRating: 5, worstRating: 1 } } : {}),
  ...(i.reviews.length
    ? {
        review: i.reviews.map((r) => ({
          "@type": "Review",
          author: { "@type": "Person", name: r.author ?? "Anonymous" },
          datePublished: r.date,
          inLanguage: r.language,
          ...(r.text ? { reviewBody: r.text } : {}),
          ...(r.rating !== null ? { reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 } } : {}),
        })),
      }
    : {}),
});

export const faqJsonLd = (items: { question: string; answer: string }[]): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: items.map((q) => ({ "@type": "Question", name: q.question, acceptedAnswer: { "@type": "Answer", text: q.answer } })),
});
