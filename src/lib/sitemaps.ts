import { locales, type Locale } from "@/i18n/config";
import { getCategories, getSitemapPlaces } from "@/lib/api/server";
import type { SitemapPlace } from "@/lib/api/types";
import { absoluteUrl, hreflangTargets } from "@/lib/site";
import { entityPath } from "@/lib/urls";

/**
 * Sitemaps are generated from the database, split by language and category, with a real lastmod from the last change to a place or its
 * reviews. Static pages carry no lastmod rather than a made-up one.
 */
export async function allPlaces(): Promise<SitemapPlace[]> {
  const places: SitemapPlace[] = [];
  for (let skip = 0; skip < 50_000; skip += 1000) {
    const page = await getSitemapPlaces(skip, 1000);
    if (!page.ok) break;
    places.push(...page.data);
    if (page.data.length < 1000) break;
  }
  return places;
}

export type SitemapPart = { name: string; lang: Locale; kind: "static" | "category"; categoryId?: string; lastModified?: string };

/** The list of sitemap files: one for the static pages of each language, one per language and category. */
export async function sitemapParts(): Promise<SitemapPart[]> {
  const [categories, places] = await Promise.all([getCategories(), allPlaces()]);
  const ids = categories.ok ? categories.data.map((c) => c.id) : [];
  const newest = (categoryId: string) => places.filter((p) => p.categoryId === categoryId).map((p) => p.lastModified).sort().at(-1);
  return locales.flatMap((lang) => [
    { name: `${lang}-static.xml`, lang, kind: "static" as const },
    ...ids.map((categoryId) => ({ name: `${lang}-${categoryId}.xml`, lang, kind: "category" as const, categoryId, lastModified: newest(categoryId) })),
  ]);
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const alternates = (path: string) =>
  hreflangTargets.map((t) => `<xhtml:link rel="alternate" hreflang="${t.hreflang}" href="${escape(absoluteUrl(`/${t.lang}${path}`))}"/>`).join("");

const urlEntry = (loc: string, path: string, lastmod?: string) =>
  `<url><loc>${escape(loc)}</loc>${lastmod ? `<lastmod>${new Date(lastmod).toISOString()}</lastmod>` : ""}${alternates(path)}</url>`;

const wrap = (body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${body}</urlset>`;

export function indexXml(parts: SitemapPart[]): string {
  const items = parts
    .map((p) => `<sitemap><loc>${escape(absoluteUrl(`/sitemaps/${p.name}`))}</loc>${p.lastModified ? `<lastmod>${new Date(p.lastModified).toISOString()}</lastmod>` : ""}</sitemap>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</sitemapindex>`;
}

export async function partXml(name: string): Promise<string | null> {
  const parts = await sitemapParts();
  const part = parts.find((p) => p.name === name);
  if (!part) return null;
  const categories = await getCategories();
  const ids = categories.ok ? categories.data.map((c) => c.id) : [];

  if (part.kind === "static") {
    const paths = ["", "/categories", "/feed", "/methodology", "/methodology/verification", "/methodology/moderation", ...ids.flatMap((id) => [`/${id}`, `/${id}/best`])];
    return wrap(paths.map((p) => urlEntry(absoluteUrl(`/${part.lang}${p}`), p)).join(""));
  }
  const places = (await allPlaces()).filter((p) => p.categoryId === part.categoryId);
  return wrap(
    places
      .map((p) => {
        const path = entityPath(part.lang, p.categoryId, p);
        return urlEntry(absoluteUrl(path), path.slice(part.lang.length + 1), p.lastModified);
      })
      .join(""),
  );
}
