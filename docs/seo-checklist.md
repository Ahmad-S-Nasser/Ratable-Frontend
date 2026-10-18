# Search and answer-engine launch checklist

Do these once the public domain is known. Nothing here needs a code change; it is settings and accounts.

## Settings (environment variables)
| Where | Variable | Value |
| --- | --- | --- |
| Web | `NEXT_PUBLIC_SITE_URL` | the public origin, no trailing slash |
| Web | `REVALIDATE_SECRET` | a long random value, the same as the API's `Seo__RevalidateSecret` |
| Web | `INDEXNOW_KEY` | a key made at indexnow.org (8 to 128 letters, digits or dashes); the web app serves it at `/indexnow-key.txt` |
| Web | `ROBOTS_TRAINING_CRAWLERS` | `allow` or `disallow` (default `disallow`): GPTBot, ClaudeBot, Google-Extended, CCBot, Applebot-Extended |
| Web | `LLMS_TXT` | `1` to serve `/llms.txt` (optional; its benefit is unproven) |
| API | `Seo__Enabled` | `true` |
| API | `Seo__SiteUrl` | the same public origin |
| API | `Seo__IndexNowKey` | the same key |
| API | `Seo__RevalidateUrl` | the web app's internal address, for example `http://localhost:3000/internal/revalidate` |
| API | `Seo__RevalidateSecret` | the same secret |

`/internal/*` and `/api/*` must not be reachable from the internet except `/api` through IIS as designed; `/internal/revalidate` is for the API on the same machine only (the secret is a second lock).

## Google Search Console
1. Add the domain property (DNS verification) and the `https://` URL-prefix property for `/ar` and `/en`.
2. Submit `https://<domain>/sitemap.xml` (the index; it links one sitemap per language and category).
3. Check Pages > Indexing for "Crawled, not indexed" and "Duplicate without user-selected canonical"; filtered and sorted lists and the comparison pages are intentionally noindex or canonical to the base page.
4. Check Enhancements: Breadcrumbs, FAQ, Review snippets (AggregateRating comes only from verified reviews and matches the page).
5. Check Core Web Vitals after a few weeks of real traffic (LCP under 2.5 s, INP under 200 ms, CLS under 0.1).
6. Set the international targeting note: Arabic pages are declared for Egypt, Saudi Arabia and the UAE (`ar-EG`, `ar-SA`, `ar-AE`) and English as `en`.

## Bing Webmaster Tools
1. Import the site from Search Console or verify by DNS.
2. Submit the same sitemap index.
3. Turn on IndexNow in the site's settings; the API submits changed pages automatically (it also feeds Yandex and other IndexNow engines).
4. Check "Site Scan" for the same issues as above.

## Answer engines
- Search and answer crawlers are always allowed in `robots.txt`: Googlebot, Bingbot, OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot, Perplexity-User. Verify the names against each vendor's page before launch; they change.
- AI crawler visits are logged as JSON lines (`event: ai_crawler_visit`, bot name, path, time; no address or cookie). Ship the web app's output to your log store and review them monthly.
- Each entity page opens with a plain-HTML summary (score, verified count, strengths, weaknesses, last updated date, source), then a visible FAQ and tables. Keep those facts true and dated.

## Brand spellings
Redirect `reviewhat` and `reviewat` hosts to the Ratable domain (301) in IIS URL Rewrite when the domains are registered.

## After launch
- Weekly: Search Console coverage and the AI crawler log.
- Monthly: re-run `npm run lhci` against a seeded API (the CI job runs it without data, the lightest case) and compare.
- When a vendor adds a crawler, add its name to `src/lib/crawlers.ts` and deploy.
