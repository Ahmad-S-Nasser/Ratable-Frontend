"use client";

import { useState } from "react";
import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/http";
import type { ContentView, DisputeDto, ReportGroup } from "@/lib/api/types";
import { useConsole } from "./context";
import { Banner, Button, Card, Chip, EmptyState, Icon, LoadState, PageHeader, ReasonForm, useAction, useLoad } from "./ui";

function Quoted({ content, empty }: { content?: ContentView | null; empty: string }) {
  return (
    <blockquote className="rounded-2xl border border-border bg-background p-4">
      {content?.text ? <p dir="auto" className="whitespace-pre-wrap leading-relaxed">{content.text}</p> : <p className="text-muted">{empty}</p>}
    </blockquote>
  );
}

// ---------- reports ----------

export function ReportQueue() {
  const { t, number } = useConsole();
  const [state, reload] = useLoad("reports", () => unwrap<ReportGroup[]>(api.GET("/api/moderation/reports")));
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <>
      <PageHeader title={t("reports.heading")} intro={t("reports.intro")} right={state.status === "ready" ? <span className="text-sm text-muted" data-testid="queue-total">{t("common.total")}: {number(state.data.length)}</span> : null} />
      {notice ? <div className="mb-4"><Banner tone="positive" onClose={() => setNotice(null)}>{notice}</Banner></div> : null}
      <LoadState state={state} reload={reload}>
        {(groups) =>
          groups.length === 0 ? <EmptyState>{t("common.empty")}</EmptyState> : (
            <div className="space-y-4">{groups.map((g) => <ReportCard key={g.resolveId} group={g} onDone={(m) => { setNotice(m); reload(); }} />)}</div>
          )
        }
      </LoadState>
    </>
  );
}

function ReportCard({ group, onDone }: { group: ReportGroup; onDone: (message: string) => void }) {
  const { t, has, date } = useConsole();
  const [hiding, setHiding] = useState(false);
  const action = useAction();

  const dismiss = () => action.run(() => unwrap(api.POST("/api/moderation/reports/{id}/resolve", { params: { path: { id: group.resolveId } }, body: { action: "dismiss", reason: null } })), () => onDone(t("reports.dismiss")), (c) => c === "wrong_state" && onDone(""));
  const hide = (reason: string) => action.run(() => unwrap(api.POST("/api/moderation/reports/{id}/resolve", { params: { path: { id: group.resolveId } }, body: { action: "hide", reason } })), () => onDone(t("queue.hidden")));

  return (
    <Card>
      <article data-testid="report" className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="negative">{t("reports.count", { n: group.reportCount })}</Chip>
          <Chip>{group.targetType === "Comment" ? t("queue.kindComment") : t("queue.kindReview")}</Chip>
          {group.reasons.map((r) => <Chip key={r.reason}>{has(`reports.reasons.${r.reason}`) ? t(`reports.reasons.${r.reason}`) : r.reason} × {r.count}</Chip>)}
          <span className="ms-auto text-xs text-muted">{t("reports.firstReported")}: {date(group.firstReportedAt)}</span>
        </div>
        <Quoted content={group.content} empty={t("reports.itemGone")} />
        {group.notes.length > 0 ? (
          <div>
            <h3 className="mb-1 text-sm font-semibold">{t("reports.notes")}</h3>
            <ul className="list-disc space-y-1 ps-5 text-sm text-muted">{group.notes.map((n, i) => <li key={i} dir="auto">{n}</li>)}</ul>
          </div>
        ) : null}
        {!hiding ? (
          <>
            {action.error ? <Banner tone="negative">{action.error}</Banner> : null}
            <div className="flex flex-wrap gap-2">
              <Button variant="solid" busy={action.busy} onClick={dismiss}>{t("reports.dismiss")}</Button>
              <Button variant="danger" onClick={() => { setHiding(true); action.clearError(); }}>{t("reports.hide")}</Button>
            </div>
          </>
        ) : (
          <ReasonForm title={t("reports.hideTitle")} help={t("common.reasonHelp")} submitLabel={t("queue.hideConfirm")} busy={action.busy} error={action.error} onSubmit={hide} onCancel={() => { setHiding(false); action.clearError(); }} />
        )}
      </article>
    </Card>
  );
}

// ---------- disputes ----------

export function DisputeQueue() {
  const { t, number } = useConsole();
  const [state, reload] = useLoad("disputes", () => unwrap<DisputeDto[]>(api.GET("/api/moderation/disputes")));
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <>
      <PageHeader title={t("disputes.heading")} intro={t("disputes.intro")} right={state.status === "ready" ? <span className="text-sm text-muted" data-testid="queue-total">{t("common.total")}: {number(state.data.length)}</span> : null} />
      {notice ? <div className="mb-4"><Banner tone="positive" onClose={() => setNotice(null)}>{notice}</Banner></div> : null}
      <LoadState state={state} reload={reload}>
        {(items) =>
          items.length === 0 ? <EmptyState>{t("common.empty")}</EmptyState> : (
            <div className="space-y-4">{items.map((d) => <DisputeCard key={d.id} item={d} onDone={(m) => { setNotice(m); reload(); }} />)}</div>
          )
        }
      </LoadState>
    </>
  );
}

function DisputeCard({ item, onDone }: { item: DisputeDto; onDone: (message: string) => void }) {
  const { t, date } = useConsole();
  const [upholding, setUpholding] = useState(false);
  const action = useAction();

  const dismiss = () => action.run(() => unwrap(api.POST("/api/moderation/disputes/{id}/dismiss", { params: { path: { id: item.id } }, body: { reason: null } })), () => onDone(t("disputes.dismiss")), (c) => c === "wrong_state" && onDone(""));
  const uphold = (reason: string) => action.run(() => unwrap(api.POST("/api/moderation/disputes/{id}/uphold", { params: { path: { id: item.id } }, body: { reason } })), () => onDone(t("queue.hidden")));

  return (
    <Card>
      <article data-testid="dispute" className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="warning">{t("queue.underReview")}</Chip>
          <span className="ms-auto text-xs text-muted">{t("common.created")}: {date(item.createdAt)}</span>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="mb-1 text-sm font-semibold">{t("disputes.reviewIs")}</h3>
            <Quoted content={item.review} empty={t("reports.itemGone")} />
          </div>
          <div>
            <h3 className="mb-1 text-sm font-semibold">{t("disputes.businessSays")}</h3>
            <blockquote className="rounded-2xl border border-border bg-surface-2 p-4"><p dir="auto" className="whitespace-pre-wrap leading-relaxed">{item.reason}</p></blockquote>
          </div>
        </div>
        {!upholding ? (
          <>
            {action.error ? <Banner tone="negative">{action.error}</Banner> : null}
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="solid" busy={action.busy} onClick={dismiss}><Icon name="check" className="size-4" />{t("disputes.dismiss")}</Button>
              <Button variant="danger" onClick={() => { setUpholding(true); action.clearError(); }}>{t("disputes.uphold")}</Button>
              <span className="text-xs text-muted">{t("disputes.dismissHint")}</span>
            </div>
          </>
        ) : (
          <ReasonForm title={t("disputes.upholdTitle")} help={t("common.reasonHelp")} submitLabel={t("queue.hideConfirm")} busy={action.busy} error={action.error} onSubmit={uphold} onCancel={() => { setUpholding(false); action.clearError(); }} />
        )}
      </article>
    </Card>
  );
}
