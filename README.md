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

## Hosting on IIS
`npm run build` produces `.next/standalone` (copy `public` and `.next/static` next to it), run with `node server.js` as a Node site (iisnode or a Windows service) behind IIS URL Rewrite/ARR. The same IIS site routes `/api` to the API.
