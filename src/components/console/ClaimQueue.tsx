"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { fetchBlob, unwrap } from "@/lib/api/http";
import type { ClaimForReview } from "@/lib/api/types";
import { useConsole } from "./context";
import { Banner, Button, Card, Chip, EmptyState, Icon, LoadState, PageHeader, ReasonForm, useAction, useLoad } from "./ui";

/** Place claims: the moderator reads the document (every opening is logged by the server), checks the email, then approves or refuses. */
export function ClaimQueue() {
  const { t, number } = useConsole();
  const [state, reload] = useLoad("claims", () => unwrap<ClaimForReview[]>(api.GET("/api/moderation/claims")));
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <>
      <PageHeader title={t("claims.heading")} intro={t("claims.intro")} right={state.status === "ready" ? <span className="text-sm text-muted" data-testid="queue-total">{t("common.total")}: {number(state.data.length)}</span> : null} />
      <p className="mb-4 text-xs text-muted">{t("claims.everyOpeningLogged")}</p>
      {notice ? <div className="mb-4"><Banner tone="positive" onClose={() => setNotice(null)}>{notice}</Banner></div> : null}
      <LoadState state={state} reload={reload}>
        {(items) =>
          items.length === 0 ? <EmptyState>{t("common.empty")}</EmptyState> : (
            <div className="space-y-4">{items.map((c) => <ClaimCard key={c.id} item={c} onDone={(m) => { setNotice(m); reload(); }} />)}</div>
          )
        }
      </LoadState>
    </>
  );
}

type Viewer = { url: string; type: string } | null;

function ClaimCard({ item, onDone }: { item: ClaimForReview; onDone: (message: string) => void }) {
  const { t, has, date } = useConsole();
  const [rejecting, setRejecting] = useState(false);
  const [viewer, setViewer] = useState<Viewer>(null);
  const [viewState, setViewState] = useState<"idle" | "loading" | "gone">("idle");
  const action = useAction();

  // The file lives only in memory while it is open; closing it frees it.
  useEffect(() => () => { if (viewer) URL.revokeObjectURL(viewer.url); }, [viewer]);

  async function open() {
    setViewState("loading");
    const result = await fetchBlob(`/api/moderation/claims/${item.id}/document`);
    if (!result.ok) return setViewState("gone");
    setViewer({ url: URL.createObjectURL(result.blob), type: result.blob.type });
    setViewState("idle");
  }

  const approve = () => action.run(() => unwrap(api.POST("/api/moderation/claims/{id}/approve", { params: { path: { id: item.id } } })), () => onDone(t("claims.approved")), (c) => c === "wrong_state" && onDone(""));
  const reject = (reason: string) => action.run(() => unwrap(api.POST("/api/moderation/claims/{id}/reject", { params: { path: { id: item.id } }, body: { reason } })), () => onDone(t("claims.rejected")));

  return (
    <Card>
      <article data-testid="claim" className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {item.freeEmail ? <Chip tone="warning">{t("claims.freeEmail")}</Chip> : null}
          <Chip tone={item.domainMatchesPlace ? "positive" : "neutral"}>{item.domainMatchesPlace ? t("claims.domainMatches") : t("claims.domainUnknown")}</Chip>
          <span className="ms-auto text-xs text-muted">{t("common.created")}: {date(item.createdAt)}</span>
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted">{t("claims.place")}</dt><dd dir="ltr" className="text-start">{item.entityId}</dd>
          <dt className="text-muted">{t("claims.email")}</dt><dd dir="ltr" className="text-start">{item.companyEmail}</dd>
          <dt className="text-muted">{t("claims.role")}</dt><dd>{item.role}</dd>
          <dt className="text-muted">{t("claims.documentType")}</dt><dd>{item.documentType && has(`claims.documentTypes.${item.documentType}`) ? t(`claims.documentTypes.${item.documentType}`) : (item.documentType ?? "—")}</dd>
          {item.website ? (<><dt className="text-muted">{t("claims.website")}</dt><dd dir="ltr" className="text-start">{item.website}</dd></>) : null}
          {item.note ? (<><dt className="text-muted">{t("claims.note")}</dt><dd dir="auto">{item.note}</dd></>) : null}
        </dl>

        {viewer ? (
          <div className="space-y-2">
            {viewer.type === "application/pdf"
              ? <iframe title={t("claims.viewFile")} src={viewer.url} className="h-[480px] w-full rounded-2xl border border-border" />
              // eslint-disable-next-line @next/next/no-img-element
              : <img src={viewer.url} alt={t("claims.viewFile")} className="max-h-[480px] rounded-2xl border border-border" />}
            <Button variant="ghost" onClick={() => setViewer(null)}>{t("claims.closeFile")}</Button>
          </div>
        ) : (
          <Button variant="secondary" busy={viewState === "loading"} onClick={() => void open()}><Icon name="eye" className="size-4" />{t("claims.viewFile")}</Button>
        )}
        {viewState === "gone" ? <Banner tone="warning">{t("claims.fileGone")}</Banner> : null}

        {!rejecting ? (
          <>
            {action.error ? <Banner tone="negative">{action.error}</Banner> : null}
            <div className="flex flex-wrap gap-2">
              <Button variant="solid" busy={action.busy} onClick={approve}><Icon name="check" className="size-4" />{t("claims.approve")}</Button>
              <Button variant="danger" onClick={() => { setRejecting(true); action.clearError(); }}>{t("claims.reject")}</Button>
            </div>
          </>
        ) : (
          <ReasonForm title={t("claims.rejectTitle")} help={t("common.reasonHelp")} submitLabel={t("claims.rejectConfirm")} busy={action.busy} error={action.error} onSubmit={reject} onCancel={() => { setRejecting(false); action.clearError(); }} />
        )}
      </article>
    </Card>
  );
}
