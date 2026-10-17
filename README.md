# Ratable Frontend

Next.js (App Router), React, TypeScript and Tailwind. Arabic first (RTL), English second, routes `/ar/...` and `/en/...`.
Rules and plan: `CLAUDE.md` and `docs/PLAN.md` in the workspace root. The web app never talks to MongoDB.

## Run
```
npm install
npm run dev          # http://localhost:3000, /api is proxied to API_URL (default http://localhost:5080)
```

## API client
Generated from the backend's OpenAPI document, never written by hand:
```
npm run api:generate   # OPENAPI_URL defaults to http://localhost:5080/openapi/v1.json
```
Use `import { api } from "@/lib/api/client"`.

## Checks
`npm run lint`, `npm run typecheck`, `npm run build`.

## Structure
- `src/app/[lang]`: all pages, with `dir` and `lang` set on `<html>`.
- `src/i18n`: dictionaries (ar, en) and locale routing (`src/proxy.ts`).
- `src/app/globals.css`: semantic design tokens (light and dark). Never write colour literals in components.
- `public/brand`: logo SVGs from the design system.

## Public site (P9a)
- Shell: header (logo, categories, theme switch, language switch), ink footer listing every category with an "All categories" link. Theme follows the device until the visitor chooses (stored in this browser only); light and dark come from the semantic tokens in `src/app/globals.css`.
- Data: public pages read the API on the server (`src/lib/api/server.ts`, cached 5 minutes) with types from the generated schema. When the API is down the pages show an empty state instead of failing.
- SEO and answer engines: `src/lib/seo/metadata.ts` (title, description, canonical, hreflang ar-EG, ar-SA, ar-AE, en and x-default, Open Graph, robots) and `src/lib/seo/jsonld.ts` (Organization with the Arabic alternate name, WebSite, BreadcrumbList, ItemList). `robots.txt` and `sitemap.xml` are generated. Set `NEXT_PUBLIC_SITE_URL` to the public origin.
- Tests: `e2e/site.spec.ts` (shell, theme, language, phone width, axe contrast in both themes and languages, screenshots in `test-results/screens`) and `e2e/seo.spec.ts` (run with JavaScript off: one h1, title, description, canonical, hreflang, JSON-LD, robots, sitemap). `npm run lhci` checks the performance budget (the CI `lighthouse` job).

## Moderation and admin console
Under `/{lang}/console` (Arabic and English, light by default with a dark switch, never indexed). It signs in with the phone code and needs the Moderator or Admin role; admin pages are hidden from moderators and refused by the API.
- Moderator: overview of every queue, reviews and comments (text, why a person is looking, what the AI said, before/after for edits; publish, or hide with a reason the author sees), new places (duplicate candidates, approve, reject, merge), proofs (open the file, accept or reject), reports, disputes.
- Admin: audit log (filters, paging), accounts (roles, suspend and restore with a reason), AI spend, and the audited author look-up.
- Every string is in `src/i18n/dictionaries` (`console` section); API types come from the generated schema (`npm run api:generate` after the backend's endpoints change).

### End-to-end tests
`npm run e2e` runs 23 browser tests against the real API and a throwaway MongoDB database (`ratable_e2e`, on your local MongoDB, no Docker): sign-in rules, every queue and decision, the admin pages, Arabic/RTL, theme, a phone-sized screen, no browser errors, and accessibility (axe, WCAG 2.1 AA) in both languages and both themes. Build the backend first (`dotnet build` in Ratable-Backend). It uses the installed Edge (set `E2E_BROWSER=chrome` for Chrome), so nothing is downloaded.

## Hosting on IIS
`npm run build` produces `.next/standalone` (copy `public` and `.next/static` next to it), run with `node server.js` as a Node site (iisnode or a Windows service) behind IIS URL Rewrite/ARR. The same IIS site routes `/api` to the API.
