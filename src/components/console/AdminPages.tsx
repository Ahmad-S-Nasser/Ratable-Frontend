"use client";

import { useState } from "react";
import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/http";
import type { AdminUser, AdminUserPage, AuditPage, LookupResponse, SpendResponse } from "@/lib/api/types";
import { useConsole } from "./context";
import { Banner, Button, Card, Chip, EmptyState, Field, LoadState, PageHeader, ReasonForm, Select, TextInput, useAction, useLoad } from "./ui";

// ---------- audit log ----------

const PAGE_SIZE = 25;

/** Dictionary keys cannot contain dots (a dot separates the parts of a path), so "entity.approved" is looked up as "entity_approved". */
const actionKey = (action: string) => action.replaceAll(".", "_");

export function AuditLog() {
  const { t, has, date, number } = useConsole();
  const [draft, setDraft] = useState({ action: "", targetType: "", actor: "", from: "", to: "" });
  const [filters, setFilters] = useState(draft);
  const [page, setPage] = useState(1);

  const [state, reload] = useLoad(
    `audit:${JSON.stringify(filters)}:${page}`,
    () => unwrap<AuditPage>(api.GET("/api/admin/audit", {
      params: { query: {
        action: filters.action || undefined, targetType: filters.targetType || undefined, actor: filters.actor || undefined,
        from: filters.from ? new Date(filters.from).toISOString() : undefined,
        to: filters.to ? new Date(new Date(filters.to).getTime() + 86_400_000).toISOString() : undefined,
        page, pageSize: PAGE_SIZE,
      } },
    })),
  );

  return (
    <>
      <PageHeader title={t("audit.heading")} intro={t("audit.intro")} />
      <Card className="mb-6">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={(e) => { e.preventDefault(); setPage(1); setFilters(draft); }}>
          <Field label={t("audit.action")} htmlFor="f-action"><TextInput id="f-action" dir="ltr" value={draft.action} placeholder={t("audit.actionPlaceholder")} onChange={(e) => setDraft({ ...draft, action: e.target.value })} /></Field>
          <Field label={t("audit.targetType")} htmlFor="f-type">
            <Select id="f-type" value={draft.targetType} onChange={(e) => setDraft({ ...draft, targetType: e.target.value })}>
              <option value="">{t("common.unknown")}</option>
              {["review", "comment", "entity", "verification", "user"].map((v) => <option key={v} value={v}>{v}</option>)}
            </Select>
          </Field>
          <Field label={t("audit.actor")} htmlFor="f-actor"><TextInput id="f-actor" dir="ltr" value={draft.actor} onChange={(e) => setDraft({ ...draft, actor: e.target.value })} /></Field>
          <Field label={t("audit.from")} htmlFor="f-from"><TextInput id="f-from" type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} /></Field>
          <Field label={t("audit.to")} htmlFor="f-to"><TextInput id="f-to" type="date" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} /></Field>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
            <Button type="submit" variant="solid">{t("audit.apply")}</Button>
            <Button variant="ghost" onClick={() => { const empty = { action: "", targetType: "", actor: "", from: "", to: "" }; setDraft(empty); setFilters(empty); setPage(1); }}>{t("audit.reset")}</Button>
          </div>
        </form>
      </Card>

      <LoadState state={state} reload={reload}>
        {(data) => {
          const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
          return data.items.length === 0 ? <EmptyState>{t("audit.none")}</EmptyState> : (
            <>
              <div className="overflow-x-auto rounded-card border border-border bg-surface">
                <table className="w-full min-w-[760px] text-start text-sm" data-testid="audit-table">
                  <thead className="bg-surface-2 text-muted">
                    <tr>{["time", "who", "what", "item", "why", "model"].map((h) => <th key={h} scope="col" className="px-4 py-3 text-start font-medium">{t(`audit.${h}`)}</th>)}</tr>
                  </thead>
                  <tbody>
                    {data.items.map((e) => (
                      <tr key={e.id} className="border-t border-border align-top">
                        <td className="whitespace-nowrap px-4 py-3">{date(e.at)}</td>
                        <td className="px-4 py-3 font-mono text-xs" dir="ltr">{e.actor === "system" ? t("audit.system") : e.actor}</td>
                        <td className="px-4 py-3"><Chip>{has(`audit.actions.${actionKey(e.action)}`) ? t(`audit.actions.${actionKey(e.action)}`) : e.action}</Chip><div className="mt-1 font-mono text-[11px] text-muted" dir="ltr">{e.action}</div></td>
                        <td className="px-4 py-3 font-mono text-xs" dir="ltr">{e.targetType}<br />{e.targetId}</td>
                        <td className="px-4 py-3" dir="auto">{e.reason}</td>
                        <td className="px-4 py-3 text-xs text-muted">{e.model ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-muted">{t("common.page")} {number(data.page)} {t("common.of")} {number(pages)} · {t("common.total")}: {number(data.total)}</span>
                <div className="flex gap-2">
                  <Button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t("common.previous")}</Button>
                  <Button disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>{t("common.next")}</Button>
                </div>
              </div>
            </>
          );
        }}
      </LoadState>
    </>
  );
}

// ---------- accounts ----------

const ROLE_OPTIONS = ["Moderator", "BusinessOwner", "Admin"] as const;

export function Users() {
  const { t } = useConsole();
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const [state, reload] = useLoad(
    `users:${role}:${status}:${page}`,
    () => unwrap<AdminUserPage>(api.GET("/api/admin/users", { params: { query: { role: role || undefined, status: status || undefined, page, pageSize: 20 } } })),
  );

  return (
    <>
      <PageHeader title={t("users.heading")} intro={t("users.intro")} />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
        <Field label={t("users.role")} htmlFor="u-role">
          <Select id="u-role" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
            <option value="">{t("users.allRoles")}</option>
            {["User", "Moderator", "Admin", "BusinessOwner"].map((r) => <option key={r} value={r}>{t(`users.roles.${r}`)}</option>)}
          </Select>
        </Field>
        <Field label={t("users.status")} htmlFor="u-status">
          <Select id="u-status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">{t("users.allStatuses")}</option>
            {["Active", "Suspended"].map((s) => <option key={s} value={s}>{t(`users.statuses.${s}`)}</option>)}
          </Select>
        </Field>
      </div>
      {notice ? <div className="mb-4"><Banner tone="positive" onClose={() => setNotice(null)}>{notice}</Banner></div> : null}
      <LoadState state={state} reload={reload}>
        {(data) => {
          const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
          return (
            <>
              <div className="space-y-3">{data.items.map((u) => <UserRow key={u.id} user={u} onDone={(m) => { setNotice(m); reload(); }} />)}</div>
              {data.items.length === 0 ? <EmptyState>{t("audit.none")}</EmptyState> : null}
              {pages > 1 ? (
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-muted">{t("common.page")} {data.page} {t("common.of")} {pages}</span>
                  <div className="flex gap-2">
                    <Button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t("common.previous")}</Button>
                    <Button disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>{t("common.next")}</Button>
                  </div>
                </div>
              ) : null}
            </>
          );
        }}
      </LoadState>
    </>
  );
}

function UserRow({ user, onDone }: { user: AdminUser; onDone: (message: string) => void }) {
  const { t, date, me } = useConsole();
  const [mode, setMode] = useState<"none" | "roles" | "suspend" | "unsuspend">("none");
  const [roles, setRoles] = useState<string[]>(user.roles.filter((r) => r !== "User"));
  const action = useAction();
  const isSelf = me?.id === user.id;
  const suspended = user.status === "Suspended";

  const saveRoles = () => action.run(() => unwrap(api.PUT("/api/admin/users/{id}/roles", { params: { path: { id: user.id } }, body: { roles: roles.length ? roles : ["User"] } })), () => onDone(t("users.saveRoles")));
  const suspend = (reason: string) => action.run(() => unwrap(api.POST("/api/admin/users/{id}/suspend", { params: { path: { id: user.id } }, body: { reason } })), () => onDone(t("users.suspend")));
  const unsuspend = (reason: string) => action.run(() => unwrap(api.POST("/api/admin/users/{id}/unsuspend", { params: { path: { id: user.id } }, body: { reason } })), () => onDone(t("users.unsuspend")));

  return (
    <Card>
      <article data-testid="user" className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium" dir="auto">{user.displayName ?? t("users.noName")}</span>
          {isSelf ? <span className="text-xs text-muted">{t("users.you")}</span> : null}
          {user.roles.map((r) => <Chip key={r} tone={r === "Admin" ? "verified" : "neutral"}>{t(`users.roles.${r}`)}</Chip>)}
          <Chip tone={suspended ? "negative" : "positive"}>{t(`users.statuses.${user.status}`)}</Chip>
          {user.phoneVerified ? <Chip tone="positive">{t("users.phoneVerified")}</Chip> : null}
          <span className="ms-auto text-xs text-muted">{t("users.joined")}: {date(user.createdAt, false)}</span>
        </div>
        <div className="font-mono text-xs text-muted" dir="ltr">{user.id}</div>

        {mode === "none" ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setMode("roles")}>{t("users.editRoles")}</Button>
            {!isSelf ? (suspended
              ? <Button variant="secondary" onClick={() => setMode("unsuspend")}>{t("users.unsuspend")}</Button>
              : <Button variant="danger" onClick={() => setMode("suspend")}>{t("users.suspend")}</Button>) : null}
          </div>
        ) : null}

        {mode === "roles" ? (
          <div className="space-y-3 rounded-2xl border border-border bg-surface-2 p-4">
            <fieldset className="flex flex-wrap gap-4">
              <legend className="mb-1 text-sm font-medium">{t("users.role")}</legend>
              {ROLE_OPTIONS.map((r) => (
                <label key={r} className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" className="size-5" checked={roles.includes(r)} disabled={isSelf && r === "Admin"} onChange={(e) => setRoles((prev) => e.target.checked ? [...prev, r] : prev.filter((x) => x !== r))} />
                  {t(`users.roles.${r}`)}
                </label>
              ))}
            </fieldset>
            <p className="text-xs text-muted">{t("users.rolesNote")}</p>
            {action.error ? <Banner tone="negative">{action.error}</Banner> : null}
            <div className="flex gap-2">
              <Button variant="solid" busy={action.busy} onClick={saveRoles}>{t("users.saveRoles")}</Button>
              <Button variant="ghost" onClick={() => { setMode("none"); action.clearError(); }}>{t("common.cancel")}</Button>
            </div>
          </div>
        ) : null}
        {mode === "suspend" ? <ReasonForm title={t("users.suspendTitle")} help={t("users.suspendHelp")} submitLabel={t("users.suspend")} busy={action.busy} error={action.error} onSubmit={suspend} onCancel={() => { setMode("none"); action.clearError(); }} /> : null}
        {mode === "unsuspend" ? <ReasonForm title={t("users.unsuspendTitle")} help={t("common.reasonHelpInternal")} submitLabel={t("users.unsuspend")} danger={false} busy={action.busy} error={action.error} onSubmit={unsuspend} onCancel={() => { setMode("none"); action.clearError(); }} /> : null}
      </article>
    </Card>
  );
}

// ---------- AI spend ----------

export function AiSpend() {
  const { t, number, date } = useConsole();
  const [state, reload] = useLoad("ai", () => unwrap<SpendResponse>(api.GET("/api/admin/ai/spend")));
  const usd = (n: number) => `$${n.toFixed(n < 1 ? 3 : 2)}`;

  return (
    <>
      <PageHeader title={t("ai.heading")} intro={t("ai.intro")} />
      <LoadState state={state} reload={reload}>
        {(s) => (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <Card><div className="text-sm text-muted">{t("ai.cap")}</div><div className="mt-1 text-3xl font-semibold tabular-nums">{usd(s.dailyCapUsd)}</div></Card>
              <Card><div className="text-sm text-muted">{t("ai.today")}</div><div className="mt-1 text-3xl font-semibold tabular-nums">{usd(s.today.costUsd)}</div></Card>
              <Card><div className="text-sm text-muted">{t("ai.remaining")}</div><div className="mt-1 text-3xl font-semibold tabular-nums">{usd(s.remainingTodayUsd)}</div></Card>
            </div>
            {[["ai.today", s.today], ["ai.month", s.thisMonth]].map(([label, p]) => {
              const period = p as SpendResponse["today"];
              return (
                <Card key={label as string}>
                  <h2 className="mb-3 font-heading text-lg font-semibold">{t(label as string)}: {usd(period.costUsd)}</h2>
                  <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <div><dt className="text-muted">{t("ai.calls")}</dt><dd className="text-xl font-semibold tabular-nums">{number(period.calls)}</dd></div>
                    <div><dt className="text-muted">{t("ai.deferred")}</dt><dd className="text-xl font-semibold tabular-nums">{number(period.deferred)}</dd></div>
                    <div><dt className="text-muted">{t("ai.failed")}</dt><dd className="text-xl font-semibold tabular-nums">{number(period.failed)}</dd></div>
                    <div><dt className="text-muted">{t("ai.cacheHits")}</dt><dd className="text-xl font-semibold tabular-nums">{number(period.cacheHits)}</dd></div>
                  </dl>
                  <p className="mt-2 text-xs text-muted">{t("ai.tokens")}: {number(period.inputTokens)} / {number(period.outputTokens)}</p>
                  {period.byFeature.length > 0 ? (
                    <table className="mt-4 w-full text-sm"><thead className="text-muted"><tr><th scope="col" className="py-1 text-start font-medium">{t("ai.feature")}</th><th scope="col" className="py-1 text-end font-medium">{t("ai.calls")}</th><th scope="col" className="py-1 text-end font-medium">{t("ai.cost")}</th></tr></thead>
                      <tbody>{period.byFeature.map((f) => <tr key={f.feature} className="border-t border-border"><td className="py-2 font-mono text-xs" dir="ltr">{f.feature}</td><td className="py-2 text-end tabular-nums">{number(f.calls)}</td><td className="py-2 text-end tabular-nums">{usd(f.costUsd)}</td></tr>)}</tbody></table>
                  ) : null}
                </Card>
              );
            })}
            <p className="text-xs text-muted">{t("ai.asOf")}: {date(s.asOf)}</p>
          </div>
        )}
      </LoadState>
    </>
  );
}

// ---------- the audited author look-up ----------

export function Lookup() {
  const { t, date } = useConsole();
  const [targetType, setTargetType] = useState("Review");
  const [targetId, setTargetId] = useState("");
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<LookupResponse | null>(null);
  const action = useAction();

  const run = () => action.run(
    () => unwrap<LookupResponse>(api.POST("/api/admin/anonymous-author-lookups", { body: { targetType, targetId, reason } })),
    (data) => setResult(data),
  );

  return (
    <>
      <PageHeader title={t("lookup.heading")} intro={t("lookup.intro")} />
      <div className="mb-5"><Banner tone="warning">{t("lookup.warning")}</Banner></div>
      <Card className="max-w-2xl">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setResult(null); void run(); }}>
          <Field label={t("lookup.type")} htmlFor="l-type">
            <Select id="l-type" value={targetType} onChange={(e) => setTargetType(e.target.value)}>
              <option value="Review">{t("lookup.review")}</option>
              <option value="Comment">{t("lookup.comment")}</option>
            </Select>
          </Field>
          <Field label={t("lookup.id")} htmlFor="l-id"><TextInput id="l-id" dir="ltr" value={targetId} onChange={(e) => setTargetId(e.target.value)} required /></Field>
          <Field label={t("common.reason")} help={t("lookup.reasonHelp")} htmlFor="l-reason">
            <TextInput id="l-reason" value={reason} onChange={(e) => setReason(e.target.value)} minLength={10} maxLength={500} required />
          </Field>
          {action.error ? <Banner tone="negative">{action.error}</Banner> : null}
          <Button type="submit" variant="primary" busy={action.busy} disabled={reason.trim().length < 10 || !targetId.trim()}>{t("lookup.run")}</Button>
        </form>
      </Card>

      {result ? (
        <Card className="mt-6 max-w-2xl" >
          <h2 className="mb-3 font-heading text-lg font-semibold">{t("lookup.result")}</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm" data-testid="lookup-result">
            <dt className="text-muted">{t("lookup.accountId")}</dt><dd className="font-mono text-xs" dir="ltr">{result.userId}</dd>
            <dt className="text-muted">{t("lookup.publicName")}</dt><dd dir="auto">{result.displayName ?? t("users.noName")}</dd>
            <dt className="text-muted">{t("lookup.created")}</dt><dd>{date(result.accountCreatedAt, false)}</dd>
            <dt className="text-muted">{t("lookup.status")}</dt><dd>{t(`users.statuses.${result.accountStatus}`)}</dd>
          </dl>
          <p className="mt-3 text-xs text-muted">{t("lookup.phoneNote")}</p>
        </Card>
      ) : null}
    </>
  );
}
