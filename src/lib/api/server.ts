import "server-only";
import createClient from "openapi-fetch";
import type { paths } from "./schema";
import { unwrap, type ApiResult } from "./http";
import type { PublicComment, ReviewHistory, Category, SitemapPlace, PlaceList, PublicEntity, PublicReview, ScoreResponse } from "./types";

/** Public pages are rendered on the server, so they read the API directly. Responses are reused for five minutes (API_REVALIDATE_SECONDS changes that; the browser tests use 0). */
const revalidate = Number(process.env.API_REVALIDATE_SECONDS ?? 300);
const serverApi = createClient<paths>({
  baseUrl: process.env.API_URL ?? "http://localhost:5080",
  fetch: (request) => fetch(request, { next: { revalidate } }),
});

export const getCategories = (): Promise<ApiResult<Category[]>> => unwrap<Category[]>(serverApi.GET("/api/categories"));

export const getCategory = (id: string) => unwrap<Category>(serverApi.GET("/api/categories/{id}", { params: { path: { id } } }));

export const getPlaces = (categoryId: string, lang: string, limit = 20, skip = 0) =>
  unwrap<PlaceList>(serverApi.GET("/api/categories/{categoryId}/places", { params: { path: { categoryId }, query: { limit, skip, lang } } }));

export const getEntity = (id: string) => unwrap<PublicEntity>(serverApi.GET("/api/entities/{id}", { params: { path: { id } } }));

export const getScore = (entityId: string) => unwrap<ScoreResponse>(serverApi.GET("/api/entities/{entityId}/score", { params: { path: { entityId } } }));

export const getReviews = (entityId: string, opts: { limit?: number; skip?: number; sort?: string; verified?: boolean } = {}) =>
  unwrap<PublicReview[]>(
    serverApi.GET("/api/entities/{entityId}/reviews", {
      params: { path: { entityId }, query: { limit: opts.limit ?? 20, skip: opts.skip ?? 0, sort: opts.sort, verified: opts.verified } },
    }),
  );

export const getHistory = (id: string) => unwrap<ReviewHistory>(serverApi.GET("/api/reviews/{id}/history", { params: { path: { id } } }));

export const getComments = (reviewId: string) =>
  unwrap<PublicComment[]>(serverApi.GET("/api/reviews/{reviewId}/comments", { params: { path: { reviewId } } }));

export const searchEntities = (q: string, category?: string) =>
  unwrap<PublicEntity[]>(serverApi.GET("/api/entities/search", { params: { query: { q, category, limit: 20 } } }));

export const getSitemapPlaces = (skip = 0, limit = 1000) =>
  unwrap<SitemapPlace[]>(serverApi.GET("/api/sitemap/places", { params: { query: { skip, limit } } }));
