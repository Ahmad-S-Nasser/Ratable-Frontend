"use client";

import Link from "next/link";
import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/http";
import type { Overview as OverviewData, SpendResponse } from "@/lib/api/types";
import { useConsole } from "./context";
import { Card, Icon, LoadState, PageHeader, useLoad } from "./ui";

const ROUTES: Record<string, string> = {
  reviews: "/reviews?kind=review",
  comments: "/reviews?kind=comment",
  entities: "/entities",
  proofs: "/proofs",
  media: "/media",
  reports: "/reports",
  disputes: "/disputes",
  claims: "/claims",
  replies: "/reviews?kind=ownerreply",
};
const ORDER = ["reviews", "comments", "entities", "proofs", "media", "reports", "disputes", "claims", "replies"];

export function Overview() {
  const { t, date, number, href, isAdmin } = useConsole();
  const [state, reload] = useLoad("overview", () => unwrap<OverviewData>(api.GET("/api/moderation/overview")));
  const [spend] = useLoad(`spend:${isAdmin}`, () => (isAdmin ? unwrap<SpendResponse>(api.GET("/api/admin/ai/spend")) : Promise.resolve({ ok: false as const, status: 403, error: "forbidden" })));

  return (
    <>
      <PageHeader title={t("overview.heading")} intro={t("overview.intro")} />
      <LoadState state={state} reload={reload}>
        {(overview) => {
          const counts = new Map(overview.queues.map((q) => [q.name, q.count]));
          const total = overview.queues.reduce((sum, q) => sum + q.count, 0);
          return (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {ORDER.map((name) => {
                  const count = counts.get(name) ?? 0;
                  return (
                    <Link key={name} href={href(ROUTES[name])} className="group block rounded-card border border-border bg-surface p-5 transition hover:border-foreground" data-testid={`queue-${name}`}>
                      <div className="text-sm text-muted">{t(`overview.queues.${name}`)}</div>
                      <div className="mt-2 flex items-end justify-between">
                        <span className="font-heading text-4xl font-semibold tabular-nums" aria-label={`${count}`}>{number(count)}</span>
                        <span className="inline-flex items-center gap-1 text-sm text-link">
                          {t("overview.goTo")}
                          <Icon name="chevron" className="size-4 rtl:-scale-x-100" />
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <h2 className="font-heading text-lg font-semibold">{t("overview.oldest")}</h2>
                  <p className="mt-2 text-2xl">{overview.oldestOpenCaseAt ? date(overview.oldestOpenCaseAt) : t("overview.nothingWaiting")}</p>
                  <p className="mt-1 text-sm text-muted">{total === 0 ? t("overview.nothingWaiting") : t("overview.target")}</p>
                </Card>
                <Card>
                  <h2 className="font-heading text-lg font-semibold">{t("overview.last30")}</h2>
                  <dl className="mt-3 grid grid-cols-2 gap-4">
                    <div>
                      <dt className="text-sm text-muted">{t("overview.autoDecided")}</dt>
                      <dd className="text-3xl font-semibold tabular-nums">{number(overview.decidedAutomatically30Days)}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted">{t("overview.humanDecided")}</dt>
                      <dd className="text-3xl font-semibold tabular-nums">{number(overview.decidedByPeople30Days)}</dd>
                    </div>
                  </dl>
                </Card>
              </div>

              {spend.status === "ready" ? (
                <Card>
                  <h2 className="font-heading text-lg font-semibold">{t("overview.aiToday")}</h2>
                  <p className="mt-2 text-2xl tabular-nums">
                    ${spend.data.today.costUsd.toFixed(2)} <span className="text-base text-muted">{t("overview.aiCap")} ${spend.data.dailyCapUsd.toFixed(2)}</span>
                  </p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label={t("overview.aiToday")} aria-valuemin={0} aria-valuemax={100}
                    aria-valuenow={Math.min(100, Math.round((spend.data.today.costUsd / Math.max(spend.data.dailyCapUsd, 0.01)) * 100))}>
                    <div className="h-full bg-verified" style={{ width: `${Math.min(100, (spend.data.today.costUsd / Math.max(spend.data.dailyCapUsd, 0.01)) * 100)}%` }} />
                  </div>
                </Card>
              ) : null}
            </div>
          );
        }}
      </LoadState>
    </>
  );
}
