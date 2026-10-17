import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";
import { getCategories } from "@/lib/api/server";
import { absoluteUrl, hreflangTargets } from "@/lib/site";

/**
 * Generated from the API, never a hand-kept list. Entity, category and collection pages are added with their pages (P9b onward) from the
 * same source with real lastmod dates; the static pages carry no lastmod rather than a made-up one.
 */
export const revalidate = 3600;

const alternates = (path: string) => ({
  languages: Object.fromEntries(hreflangTargets.map((t) => [t.hreflang, absoluteUrl(`/${t.lang}${path}`)])),
});

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const categories = await getCategories();
  const paths = ["", "/categories", ...(categories.ok ? categories.data.map((c) => `/${c.id}`) : [])];
  return locales.flatMap((lang) => paths.map((path) => ({ url: absoluteUrl(`/${lang}${path}`), alternates: alternates(path) })));
}
