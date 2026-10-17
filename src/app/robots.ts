import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

/** Search and answer-engine crawlers are welcome; the back office and the API are not for indexing. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/ar/console", "/en/console"] }],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
