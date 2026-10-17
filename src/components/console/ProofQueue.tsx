"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { fetchBlob, unwrap } from "@/lib/api/http";
import type { QueueProof } from "@/lib/api/types";
import { useConsole } from "./context";
import { Banner, Button, Card, Chip, EmptyState, Icon, LoadState, PageHeader, ReasonForm, useAction, useLoad } from "./ui";

export function ProofQueue() {
  const { t, number } = useConsole();
  const [state, reload] = useLoad("proofs", () => unwrap<QueueProof[]>(api.GET("/api/moderation/proofs")));
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <>
      <PageHeader title={t("proofs.heading")} intro={t("proofs.intro")} right={state.status === "ready" ? <span className="text-sm text-muted" data-testid="queue-total">{t("common.total")}: {number(state.data.length)}</span> : null} />
      <p className="mb-4 text-xs text-muted">{t("proofs.everyOpeningLogged")}</p>
      {notice ? <div className="mb-4"><Banner tone="positive" onClose={() => setNotice(null)}>{notice}</Banner></div> : null}
      <LoadState state={state} reload={reload}>
        {(items) =>
          items.length === 0 ? <EmptyState>{t("common.empty")}</EmptyState> : (
            <div className="space-y-4">{items.map((p) => <ProofCard key={p.id} item={p} onDone={(m) => { setNotice(m); reload(); }} />)}</div>
          )
        }
      </LoadState>
    </>
  );
}

type Viewer = { url: string; type: string } | null;

function ProofCard({ item, onDone }: { item: QueueProof; onDone: (message: string) => void }) {
  const { t, has, date } = useConsole();
  const [rejecting, setRejecting] = useState(false);
  const [viewer, setViewer] = useState<Viewer>(null);
  const [viewState, setViewState] = useState<"idle" | "loading" | "gone">("idle");
  const action = useAction();
  const isAudit = item.kind === "audit";

  // The file lives only in memory while it is open; closing it frees it.
  useEffect(() => () => { if (viewer) URL.revokeObjectURL(viewer.url); }, [viewer]);

  async function open() {
    setViewState("loading");
    const result = await fetchBlob(`/api/moderation/proofs/${item.id}/file`);
    if (!result.ok) return setViewState("gone");
    setViewer({ url: URL.createObjectURL(result.blob), type: result.blob.type });
    setViewState("idle");
  }

  const approve = () => action.run(() => unwrap(api.POST("/api/moderation/proofs/{id}/approve", { params: { path: { id: item.id } } })), () => onDone(t("queue.published")), (c) => c === "wrong_state" && onDone(""));
  const reject = (reason: string) => action.run(() => unwrap(api.POST("/api/moderation/proofs/{id}/reject", { params: { path: { id: item.id } }, body: { reason } })), () => onDone(t("proofs.reject")));

  return (
    <Card>
      <article data-testid="proof" className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={isAudit ? "verified" : "warning"}>{t(`proofs.kind.${item.kind}`)}</Chip>
          <Chip>{t("proofs.proofType")}: {item.proofType}</Chip>
          <span className="ms-auto text-xs text-muted">{t("common.created")}: {date(item.createdAt)}</span>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold">{t("queue.whyHere")}</h3>
            {item.reasons.length === 0 ? <p className="text-sm text-muted">{t("proofs.kind.audit")}</p> : (
              <ul className="space-y-1 text-sm">{item.reasons.map((r) => <li key={r} className="flex gap-2"><span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-warning-text" />{has(`proofs.reasons.${r}`) ? t(`proofs.reasons.${r}`) : r}</li>)}</ul>
            )}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">{t("proofs.read")}</h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted">{t("proofs.documentType")}</dt><dd dir="auto">{item.documentType ?? "—"}</dd>
              <dt className="text-muted">{t("proofs.placeName")}</dt><dd dir="auto">{item.readEntityName ?? "—"}</dd>
              <dt className="text-muted">{t("proofs.date")}</dt><dd dir="ltr" className="text-start">{item.readDate ?? "—"}</dd>
              {item.confidence != null ? (<><dt className="text-muted">{t("queue.model")}</dt><dd>{t("queue.confidence", { n: Math.round(item.confidence * 100) })}</dd></>) : null}
            </dl>
          </div>
        </div>

        {item.fileStored ? (
          viewer ? (
            <div className="space-y-2">
              {viewer.type === "application/pdf"
                ? <iframe title={t("proofs.viewFile")} src={viewer.url} className="h-[480px] w-full rounded-2xl border border-border" />
                // eslint-disable-next-line @next/next/no-img-element
                : <img src={viewer.url} alt={t("proofs.viewFile")} className="max-h-[480px] rounded-2xl border border-border" />}
              <Button variant="ghost" onClick={() => setViewer(null)}>{t("proofs.closeFile")}</Button>
            </div>
          ) : (
            <Button variant="secondary" busy={viewState === "loading"} onClick={() => void open()}><Icon name="eye" className="size-4" />{t("proofs.viewFile")}</Button>
          )
        ) : <p className="text-sm text-muted">{t("proofs.fileGone")}</p>}
        {viewState === "gone" ? <Banner tone="warning">{t("proofs.fileGone")}</Banner> : null}

        {!rejecting ? (
          <>
            {action.error ? <Banner tone="negative">{action.error}</Banner> : null}
            <div className="flex flex-wrap gap-2">
              <Button variant="solid" busy={action.busy} onClick={approve}><Icon name="check" className="size-4" />{isAudit ? t("proofs.confirmAudit") : t("proofs.approve")}</Button>
              <Button variant="danger" onClick={() => { setRejecting(true); action.clearError(); }}>{t("proofs.reject")}</Button>
            </div>
          </>
        ) : (
          <ReasonForm title={t("proofs.rejectTitle")} help={t("common.reasonHelp")} submitLabel={t("proofs.rejectConfirm")} busy={action.busy} error={action.error} onSubmit={reject} onCancel={() => { setRejecting(false); action.clearError(); }} />
        )}
      </article>
    </Card>
  );
}
