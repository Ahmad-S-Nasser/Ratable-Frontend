import type { MetadataRoute } from "next";
import { allowTraining, searchCrawlers, trainingCrawlers } from "@/lib/crawlers";
import { absoluteUrl } from "@/lib/site";

const blocked = ["/api/", "/internal/", "/ar/console", "/en/console"];

/** Search and answer-engine crawlers are welcome; training crawlers follow the owner's setting; the back office and the API are never for indexing. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: [...searchCrawlers], allow: "/", disallow: blocked },
      { userAgent: [...trainingCrawlers], ...(allowTraining() ? { allow: "/", disallow: blocked } : { disallow: "/" }) },
      { userAgent: "*", allow: "/", disallow: blocked },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
