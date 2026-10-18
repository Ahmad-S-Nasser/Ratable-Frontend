"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/http";
import type { CaseDto } from "@/lib/api/types";
import { useConsole } from "./context";
import { Banner, Button, Card, Chip, EmptyState, Icon, PageHeader, ReasonForm, Spinner, useAction, useErrorText } from "./ui";

type Kind = "" | "review" | "comment" | "ownerreply";
const PAGE = 20;

type Page = { kind: Kind; items: CaseDto[]; total: number; error: string | null };

async function fetchPage(kind: Kind, skip: number) {
  return unwrap(api.GET("/api/moderation/cases", { params: { query: { kind: kind || undefined, skip, limit: PAGE } } }));
}

export function ReviewQueue() {
  const { t, number } = useConsole();
  const errorText = useErrorText();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const kind: Kind = ((k) => (k === "review" || k === "comment" || k === "ownerreply" ? k : ""))(params.get("kind"));

  const [page, setPage] = useState<Page | null>(null);
  const [tick, setTick] = useState(0);
  const [moreBusy, setMoreBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // While the page on screen belongs to another filter, the new one is still loading.
  const shown = page && page.kind === kind ? page : null;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await fetchPage(kind, 0);
      if (cancelled) return;
      setPage(result.ok
        ? { kind, items: result.data.items, total: result.data.total, error: null }
        : { kind, items: [], total: 0, error: errorText(result.status === 0 ? "network" : result.error) });
    })();
    return () => {
      cancelled = true;
    };
  }, [kind, tick, errorText]);

  async function loadMore() {
    if (!shown) return;
    setMoreBusy(true);
    const result = await fetchPage(kind, shown.items.length);
    setMoreBusy(false);
    if (result.ok) setPage({ ...shown, items: [...shown.items, ...result.data.items], total: result.data.total });
  }

  const setKind = (next: Kind) => router.replace(next ? `${pathname}?kind=${next}` : pathname);
  const decided = (id: string, message: string) => {
    setPage((p) => (p ? { ...p, items: p.items.filter((c) => c.id !== id), total: Math.max(0, p.total - 1) } : p));
    setNotice(message);
  };
  // After a conflict (someone else decided, or the author edited) the list is reloaded so it shows the truth.
  const refresh = () => setTick((n) => n + 1);
  const items = shown?.items ?? [];
  const total = shown?.total ?? 0;

  return (
    <>
      <PageHeader title={t("queue.heading")} intro={t("queue.intro")} />
      <div className="mb-5 flex flex-wrap items-center gap-2" role="tablist" aria-label={t("queue.heading")}>
        {([["", "queue.filterAll"], ["review", "queue.filterReview"], ["comment", "queue.filterComment"], ["ownerreply", "queue.filterReply"]] as const).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={kind === value}
            onClick={() => setKind(value)}
            className={`min-h-11 rounded-full border px-5 text-sm font-medium ${kind === value ? "border-verified bg-tint text-verified" : "border-border bg-surface"}`}
          >
            {t(label)}
          </button>
        ))}
        <span className="ms-auto text-sm text-muted" data-testid="queue-total">{t("common.total")}: {number(total)}</span>
      </div>

      {notice ? <div className="mb-4"><Banner tone="positive" onClose={() => setNotice(null)}>{notice}</Banner></div> : null}
      {shown?.error ? <div className="mb-4"><Banner tone="negative">{shown.error}</Banner></div> : null}

      <div className="space-y-4">
        {items.map((c) => <CaseCard key={c.id} item={c} onDecided={decided} onConflict={refresh} />)}
      </div>

      {!shown ? <div className="flex justify-center py-10 text-muted"><Spinner /></div> : null}
      {shown && items.length === 0 && !shown.error ? <EmptyState>{t("common.empty")}</EmptyState> : null}
      {shown && items.length < total ? (
        <div className="mt-6 flex justify-center">
          <Button busy={moreBusy} onClick={() => void loadMore()}>{t("common.loadMore")} ({t("queue.more", { n: total - items.length })})</Button>
        </div>
      ) : null}
    </>
  );
}

const FLAGS = ["abuse", "personalData", "spam", "suspectedFake", "identifyingDetails"] as const;

function CaseCard({ item, onDecided, onConflict }: { item: CaseDto; onDecided: (id: string, message: string) => void; onConflict: () => void }) {
  const { t, has, date } = useConsole();
  const [hiding, setHiding] = useState(false);
  const action = useAction();
  const content = item.content;
  const isReview = item.kind === "Review";
  const kindLabel = isReview ? t("queue.kindReview") : item.kind === "OwnerReply" ? t("queue.kindReply") : t("queue.kindComment");

  const publish = () =>
    action.run(
      () => unwrap(api.POST("/api/moderation/cases/{id}/publish", { params: { path: { id: item.id } } })),
      () => onDecided(item.id, t("queue.published")),
      (code) => (code === "wrong_state" || code === "content_changed") && onConflict(),
    );

  const hide = (reason: string) =>
    action.run(
      () => unwrap(api.POST("/api/moderation/cases/{id}/hide", { params: { path: { id: item.id } }, body: { reason } })),
      () => onDecided(item.id, t("queue.hidden")),
      (code) => (code === "wrong_state" || code === "content_changed") && onConflict(),
    );

  return (
    <Card className="space-y-4" >
      <article data-testid="case" data-kind={item.kind} aria-label={kindLabel} className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="verified">{kindLabel}</Chip>
          {item.revision > 1 ? <Chip tone="warning">{t("queue.edited")} · {t("queue.revision", { n: item.revision })}</Chip> : null}
          {content?.isAnonymous ? <Chip>{t("queue.isAnonymous")}</Chip> : null}
          {content?.underReview ? <Chip tone="warning">{t("queue.underReview")}</Chip> : null}
          <span className="ms-auto text-xs text-muted">{t("common.created")}: {date(item.createdAt)}</span>
        </div>

        {content?.previousText ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <TextBlock label={t("queue.previous")} text={content.previousText} muted />
            <TextBlock label={t("queue.current")} text={content.text} />
          </div>
        ) : (
          <TextBlock text={content?.text} empty={t("queue.noText")} />
        )}
        {isReview && content?.overall != null ? <p className="text-sm text-muted">{t("queue.answers")}: <span className="font-medium text-foreground">{content.overall.toFixed(1)} / 5</span></p> : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold">{t("queue.whyHere")}</h3>
            <ul className="space-y-1 text-sm">
              {item.reasons.length === 0 ? <li className="text-muted">—</li> : null}
              {item.reasons.map((r) => <li key={r} className="flex gap-2"><span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-warning-text" />{has(`queue.reasons.${r}`) ? t(`queue.reasons.${r}`) : r}</li>)}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <Chip tone={item.authorPhoneVerified ? "positive" : "neutral"}>{item.authorPhoneVerified ? t("queue.phoneVerified") : t("queue.phoneNotVerified")}</Chip>
              {isReview ? <Chip tone={item.hasVerifiedProof ? "verified" : "neutral"}>{item.hasVerifiedProof ? t("queue.withProof") : t("queue.noProof")}</Chip> : null}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">{t("queue.aiVerdict")}</h3>
            <p className="mb-2 text-xs text-muted">{has(`queue.aiStatus.${item.aiStatus}`) ? t(`queue.aiStatus.${item.aiStatus}`) : item.aiStatus}</p>
            {item.prescreen ? (
              <ul className="space-y-1.5">
                {FLAGS.map((f) => {
                  const flag = item.prescreen![f];
                  const pct = Math.round(flag.confidence * 100);
                  return (
                    <li key={f} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-sm">
                      <span>{t(`queue.flag.${f}`)}</span>
                      <span className={flag.flagged ? "font-medium text-negative" : "text-muted"}>{flag.flagged ? t("queue.flagged") : t("queue.clear")} · {t("queue.confidence", { n: pct })}</span>
                      <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-surface-2"><span className={`block h-full ${flag.flagged ? "bg-negative" : "bg-border"}`} style={{ width: `${Math.max(pct, 2)}%` }} /></span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {item.prescreen?.model ? <p className="mt-2 text-xs text-muted">{t("queue.model")}: {item.prescreen.model}</p> : null}
          </div>
        </div>

        {action.error && !hiding ? <Banner tone="negative">{action.error}</Banner> : null}
        {hiding ? (
          <ReasonForm
            title={t("queue.hideTitle")}
            help={t("common.reasonHelp")}
            submitLabel={t("queue.hideConfirm")}
            busy={action.busy}
            error={action.error}
            onSubmit={hide}
            onCancel={() => { setHiding(false); action.clearError(); }}
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="solid" busy={action.busy} onClick={publish}><Icon name="check" className="size-4" />{t("queue.publish")}</Button>
            <Button variant="danger" onClick={() => setHiding(true)}>{t("queue.hide")}</Button>
          </div>
        )}
      </article>
    </Card>
  );
}

function TextBlock({ label, text, muted, empty }: { label?: string; text?: string | null; muted?: boolean; empty?: string }) {
  return (
    <div className={`rounded-2xl border border-border p-4 ${muted ? "bg-surface-2" : "bg-background"}`}>
      {label ? <div className="mb-1 text-xs font-medium text-muted">{label}</div> : null}
      {text ? <p dir="auto" className="whitespace-pre-wrap text-base leading-relaxed">{text}</p> : <p className="text-muted">{empty}</p>}
    </div>
  );
}
