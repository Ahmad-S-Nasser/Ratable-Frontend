import { indexXml, sitemapParts } from "@/lib/sitemaps";

export const revalidate = 3600;

/** The sitemap index: one file per language for the static pages and one per language and category for places. */
export async function GET() {
  return new Response(indexXml(await sitemapParts()), { headers: { "content-type": "application/xml; charset=utf-8" } });
}
