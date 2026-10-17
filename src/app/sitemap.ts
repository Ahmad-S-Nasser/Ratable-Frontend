import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";
import { getCategories, getSitemapPlaces } from "@/lib/api/server";
import type { SitemapPlace } from "@/lib/api/types";
import { absoluteUrl, hreflangTargets } from "@/lib/site";
import { entityPath } from "@/lib/urls";

/**
 * Generated from the API, never a hand-kept list: static pages, every category, and every place that has a verified review (the rest are
 * noindex, so they are not listed), with the real date of the last change as lastmod. The static pages carry no lastmod rather than a made-up one.
 * Collections are added with their pages (P9f).
 */
export const revalidate = 3600;

const alternates = (path: string) => ({
  languages: Object.fromEntries(hreflangTargets.map((t) => [t.hreflang, absoluteUrl(`/${t.lang}${path}`)])),
});

async function allPlaces(): Promise<SitemapPlace[]> {
  const places: SitemapPlace[] = [];
  for (let skip = 0; skip < 50_000; skip += 1000) {
    const page = await getSitemapPlaces(skip, 1000);
    if (!page.ok) break;
    places.push(...page.data);
    if (page.data.length < 1000) break;
  }
  return places;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, places] = await Promise.all([getCategories(), allPlaces()]);
  const staticPaths = ["", "/categories", ...(categories.ok ? categories.data.map((c) => `/${c.id}`) : [])];
  const entries: MetadataRoute.Sitemap = locales.flatMap((lang) =>
    staticPaths.map((path) => ({ url: absoluteUrl(`/${lang}${path}`), alternates: alternates(path) })),
  );
  for (const lang of locales) {
    for (const place of places) {
      const path = entityPath(lang, place.categoryId, place);
      entries.push({ url: absoluteUrl(path), lastModified: new Date(place.lastModified), alternates: alternates(path.slice(lang.length + 1)) });
    }
  }
  return entries;
}
