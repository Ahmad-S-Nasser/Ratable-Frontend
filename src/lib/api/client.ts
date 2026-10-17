import createClient from "openapi-fetch";
import type { paths } from "./schema";

// Browser calls go to the same origin (/api, routed by IIS or the dev rewrite).
// Server components call the API directly through API_URL.
const baseUrl = typeof window === "undefined" ? (process.env.API_URL ?? "http://localhost:5080") : "";

export const api = createClient<paths>({ baseUrl });
