import "server-only";
import createClient from "openapi-fetch";
import type { paths } from "./schema";
import { unwrap, type ApiResult } from "./http";
import type { Category } from "./types";

/** Public pages are rendered on the server, so they read the API directly. Responses are reused for five minutes. */
const serverApi = createClient<paths>({
  baseUrl: process.env.API_URL ?? "http://localhost:5080",
  fetch: (request) => fetch(request, { next: { revalidate: 300 } }),
});

export const getCategories = (): Promise<ApiResult<Category[]>> => unwrap<Category[]>(serverApi.GET("/api/categories"));
