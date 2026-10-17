import type { components } from "./schema";

/** Types come from the generated OpenAPI schema (npm run api:generate), never written by hand. */
type S = components["schemas"];

export type Me = S["MeResponse"];
export type Overview = S["Overview"];
export type CaseDto = S["CaseDto"];
export type CasePage = S["CasePage"];
export type ContentView = S["ModerationContentView"];
export type QueueItem = S["QueueItem"];
export type QueueCandidate = S["QueueCandidate"];
export type QueueProof = S["QueueProof"];
export type ReportGroup = S["ReportGroup"];
export type DisputeDto = S["DisputeDto"];
export type AuditPage = S["AuditPage"];
export type AuditEntry = S["AuditEntryDto"];
export type AdminUserPage = S["AdminUserPage"];
export type AdminUser = S["AdminUser"];
export type SpendResponse = S["SpendResponse"];
export type LookupResponse = S["LookupResponse"];

export type Category = S["CategoryDto"];
export type PublicEntity = S["PublicEntity"];
export type PublicReview = S["PublicReview"];
export type ScoreResponse = S["ScoreResponse"];
export type PublicComment = S["PublicComment"];
export type PlaceCard = S["PlaceCard"];
export type PlaceList = S["PlaceList"];
export type PublicAuthor = S["PublicAuthor"];
export type CategoryCriterion = S["CriterionDto"];
export type SitemapPlace = S["SitemapPlace"];
export type OwnReview = S["OwnReview"];
export type ReviewInput = S["ReviewInput"];
