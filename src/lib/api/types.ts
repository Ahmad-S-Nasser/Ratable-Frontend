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
