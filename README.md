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

## Moderation and admin console
Under `/{lang}/console` (Arabic and English, light by default with a dark switch, never indexed). It signs in with the phone code and needs the Moderator or Admin role; admin pages are hidden from moderators and refused by the API.
- Moderator: overview of every queue, reviews and comments (text, why a person is looking, what the AI said, before/after for edits; publish, or hide with a reason the author sees), new places (duplicate candidates, approve, reject, merge), proofs (open the file, accept or reject), reports, disputes.
- Admin: audit log (filters, paging), accounts (roles, suspend and restore with a reason), AI spend, and the audited author look-up.
- Every string is in `src/i18n/dictionaries` (`console` section); API types come from the generated schema (`npm run api:generate` after the backend's endpoints change).

### End-to-end tests
`npm run e2e` runs 23 browser tests against the real API and a throwaway MongoDB database (`ratable_e2e`, on your local MongoDB, no Docker): sign-in rules, every queue and decision, the admin pages, Arabic/RTL, theme, a phone-sized screen, no browser errors, and accessibility (axe, WCAG 2.1 AA) in both languages and both themes. Build the backend first (`dotnet build` in Ratable-Backend). It uses the installed Edge (set `E2E_BROWSER=chrome` for Chrome), so nothing is downloaded.

## Hosting on IIS
`npm run build` produces `.next/standalone` (copy `public` and `.next/static` next to it), run with `node server.js` as a Node site (iisnode or a Windows service) behind IIS URL Rewrite/ARR. The same IIS site routes `/api` to the API.
