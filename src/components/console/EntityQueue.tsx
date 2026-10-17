"use client";

import { useState } from "react";
import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/http";
import type { QueueCandidate, QueueItem } from "@/lib/api/types";
import { useConsole } from "./context";
import { Banner, Button, Card, Chip, EmptyState, Icon, LoadState, PageHeader, ReasonForm, useAction, useLoad } from "./ui";

export function EntityQueue() {
  const { t, number } = useConsole();
  const [state, reload] = useLoad("entities", () => unwrap<QueueItem[]>(api.GET("/api/moderation/entities")));
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <>
      <PageHeader title={t("entities.heading")} intro={t("entities.intro")} right={state.status === "ready" ? <span className="text-sm text-muted" data-testid="queue-total">{t("common.total")}: {number(state.data.length)}</span> : null} />
      {notice ? <div className="mb-4"><Banner tone="positive" onClose={() => setNotice(null)}>{notice}</Banner></div> : null}
      <LoadState state={state} reload={reload}>
        {(items) =>
          items.length === 0 ? (
            <EmptyState>{t("common.empty")}</EmptyState>
          ) : (
            <div className="space-y-4">
              {items.map((item) => <EntityCard key={item.id} item={item} onDone={(message) => { setNotice(message); reload(); }} />)}
            </div>
          )
        }
      </LoadState>
    </>
  );
}

function EntityCard({ item, onDone }: { item: QueueItem; onDone: (message: string) => void }) {
  const { t, has, lang, date } = useConsole();
  const [mode, setMode] = useState<"none" | "reject" | "merge">("none");
  const [mergeTarget, setMergeTarget] = useState<QueueCandidate | null>(null);
  const action = useAction();

  const approve = () => action.run(() => unwrap(api.POST("/api/moderation/entities/{id}/approve", { params: { path: { id: item.id } } })), () => onDone(t("entities.approved")), (c) => c === "wrong_state" && onDone(""));
  const reject = (reason: string) => action.run(() => unwrap(api.POST("/api/moderation/entities/{id}/reject", { params: { path: { id: item.id } }, body: { reason } })), () => onDone(t("entities.rejected")));
  const merge = (target: QueueCandidate) => action.run(() => unwrap(api.POST("/api/moderation/entities/{id}/merge", { params: { path: { id: item.id } }, body: { intoEntityId: target.entityId } })), () => onDone(t("entities.merged")));

  const primary = lang === "ar" ? item.name.ar || item.name.en : item.name.en || item.name.ar;
  const secondary = lang === "ar" ? item.name.en : item.name.ar;
  const fields = Object.entries(item.fields ?? {});

  return (
    <Card>
      <article data-testid="entity" className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-heading text-xl font-semibold" dir="auto">{primary}</h2>
            {secondary ? <p className="text-sm text-muted" dir="auto">{secondary}</p> : null}
          </div>
          <div className="text-end text-xs text-muted">
            <div>{t("entities.submitted")}: {date(item.submittedAt)}</div>
            <div>{t("entities.category")}: {item.categoryId}</div>
          </div>
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {item.city || item.address ? (
            <div><dt className="text-muted">{t("entities.address")}</dt><dd dir="auto">{[item.address, item.city].filter(Boolean).join(", ")}</dd></div>
          ) : null}
          {item.latitude != null && item.longitude != null ? (
            <div>
              <dt className="text-muted">{t("entities.map")}</dt>
              <dd dir="ltr" className="text-start">
                <a className="text-link underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${item.latitude}&mlon=${item.longitude}#map=17/${item.latitude}/${item.longitude}`}>
                  {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
                </a>
              </dd>
            </div>
          ) : null}
          {item.alternateNames.length > 0 ? <div><dt className="text-muted">{t("entities.alternateNames")}</dt><dd dir="auto">{item.alternateNames.join(" · ")}</dd></div> : null}
          {fields.length > 0 ? <div><dt className="text-muted">{t("entities.fields")}</dt><dd dir="auto">{fields.map(([k, v]) => `${k}: ${v}`).join(" · ")}</dd></div> : null}
        </dl>

        <div className="rounded-2xl bg-surface-2 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={item.suggestion === "Duplicate" ? "warning" : item.suggestion === "New" ? "positive" : "neutral"}>
              {has(`entities.ai.${item.suggestion}`) ? t(`entities.ai.${item.suggestion}`) : item.suggestion}
            </Chip>
            {item.confidence != null ? <span className="text-xs text-muted">{t("queue.confidence", { n: Math.round(item.confidence * 100) })}</span> : null}
          </div>
          <p className="mt-1 text-xs text-muted">{has(`entities.aiStatus.${item.aiStatus}`) ? t(`entities.aiStatus.${item.aiStatus}`) : item.aiStatus}</p>

          <h3 className="mb-2 mt-4 text-sm font-semibold">{t("entities.candidates")}</h3>
          {item.candidates.length === 0 ? <p className="text-sm text-muted">{t("entities.noCandidates")}</p> : (
            <ul className="space-y-2">
              {item.candidates.map((c) => (
                <li key={c.entityId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2" data-testid="candidate">
                  <div>
                    <div className="font-medium" dir="auto">{lang === "ar" ? c.name.ar || c.name.en : c.name.en || c.name.ar}</div>
                    <div className="text-xs text-muted">
                      {t("entities.nameMatch", { n: Math.round(c.nameScore * 100) })}
                      {c.distanceMeters != null ? ` · ${t("entities.distance", { n: Math.round(c.distanceMeters) })}` : ""}
                      {c.status === "PendingModeration" ? ` · ${t("entities.pendingCandidate")}` : ""}
                      {item.suggestedDuplicateOfId === c.entityId ? ` · ${t("entities.ai.Duplicate")}` : ""}
                    </div>
                  </div>
                  {c.status === "Active" ? <Button variant="secondary" onClick={() => { setMergeTarget(c); setMode("merge"); action.clearError(); }}>{t("entities.merge")}</Button> : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {mode === "none" ? (
          <>
            {action.error ? <Banner tone="negative">{action.error}</Banner> : null}
            <div className="flex flex-wrap gap-2">
              <Button variant="solid" busy={action.busy} onClick={approve}><Icon name="check" className="size-4" />{t("entities.approve")}</Button>
              <Button variant="danger" onClick={() => { setMode("reject"); action.clearError(); }}>{t("entities.reject")}</Button>
            </div>
          </>
        ) : null}

        {mode === "reject" ? (
          <ReasonForm title={t("entities.rejectTitle")} help={t("common.reasonHelpInternal")} submitLabel={t("entities.rejectConfirm")} busy={action.busy} error={action.error} onSubmit={reject} onCancel={() => { setMode("none"); action.clearError(); }} />
        ) : null}

        {mode === "merge" && mergeTarget ? (
          <div className="space-y-3 rounded-2xl border border-border bg-surface-2 p-4">
            <p className="font-medium">{t("entities.mergeTitle")}: <span dir="auto">{mergeTarget.name.ar || mergeTarget.name.en}</span></p>
            <p className="text-sm text-muted">{t("entities.mergeHelp")}</p>
            {action.error ? <Banner tone="negative">{action.error}</Banner> : null}
            <div className="flex flex-wrap gap-2">
              <Button variant="solid" busy={action.busy} onClick={() => merge(mergeTarget)}>{t("common.confirm")}</Button>
              <Button variant="ghost" onClick={() => { setMode("none"); setMergeTarget(null); action.clearError(); }}>{t("common.cancel")}</Button>
            </div>
          </div>
        ) : null}
      </article>
    </Card>
  );
}
