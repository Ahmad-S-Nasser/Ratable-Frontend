import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale, locales } from "@/i18n/config";
import { aiCrawlerName } from "@/lib/crawlers";

// Arabic first: only an explicit English preference changes the default.
function preferredLocale(request: NextRequest) {
  const header = request.headers.get("accept-language") ?? "";
  for (const part of header.split(",")) {
    const code = part.trim().split(/[-;]/)[0].toLowerCase();
    if (isLocale(code)) return code;
  }
  return defaultLocale;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // A line for every visit from an AI crawler: its name, the page and the time. No address, no cookies, nothing about a person.
  const bot = aiCrawlerName(request.headers.get("user-agent"));
  if (bot) console.log(JSON.stringify({ event: "ai_crawler_visit", bot, path: pathname, at: new Date().toISOString() }));

  if (locales.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`))) return;

  request.nextUrl.pathname = `/${preferredLocale(request)}${pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  // Skip Next internals, the API proxy, files with an extension, and the health check.
  matcher: ["/((?!_next|api|internal|sitemaps|health|brand|.*\\..*).*)"],
};
