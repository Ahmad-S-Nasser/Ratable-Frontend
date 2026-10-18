"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Stars } from "@/components/ui/Stars";
import type { Locale } from "@/i18n/config";
import { fmt, formatDate, formatNumber, formatScore } from "@/i18n/format";
import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/http";
import { DashboardContact, type ContactDict } from "@/components/site/DashboardContact";
import type { BusinessReviewItem, Dashboard, DashboardPlace, OwnClaim } from "@/lib/api/types";
import { entityPath } from "@/lib/urls";
import { pick } from "@/lib/pick";

type Dict = {
  signInNeeded: string; signIn: string; noPlaces: string; claimLink: string; claimsHeading: string; claimStatus: Record<string, string>; placePicker: string; viewPage: string;
  kpis: { reviews: string; verified: string; score: string; replyRate: string; none: string };
  trend: { heading: string; empty: string; reviews: string };
  compare: { heading: string; you: string; category: string; noData: string };
  alerts: { new: string; none: string; markSeen: string };
  waiting: { heading: string; empty: string; sent: string; pending: string; anonymous: string; verified: string; unverified: string; reply: string; placeholder: string; send: string; sending: string; cancel: string; help: string; under: string };
  errors: Record<string, string>;
};

type State =
  | { name: "loading" }
  | { name: "signedOut" }
  | { name: "noPlaces"; claims: OwnClaim[] }
  | { name: "ready"; places: DashboardPlace[] };

const input = "w-full rounded-xl border border-border bg-background px-3 py-2";

/**
 * The free dashboard of a place. Every number is what the server worked out from the same verified reviews as the public score.
 * A reviewer is shown only as the API sent them: an anonymous review has no name here, and there is no id to show.
 */
export function BusinessDashboard({ lang, dict, contactDict }: { lang: Locale; dict: Dict; contactDict: ContactDict }) {
  const [state, setState] = useState<State>({ name: "loading" });
  const [placeId, setPlaceId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const places = await unwrap<DashboardPlace[]>(api.GET("/api/business/places"));
      if (cancelled) return;
      if (places.ok && places.data.length > 0) {
        setState({ name: "ready", places: places.data });
        setPlaceId(places.data[0].entityId);
        return;
      }
      // Not a business yet (403) or not signed in (401): the claims say where the account stands.
      const claims = await unwrap<OwnClaim[]>(api.GET("/api/me/claims"));
      if (cancelled) return;
      if (!claims.ok) return setState({ name: "signedOut" });
      setState({ name: "noPlaces", claims: claims.data });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.name === "loading") return <p className="text-muted">…</p>;

  if (state.name === "signedOut")
    return (
      <Card className="space-y-4">
        <p>{dict.signInNeeded}</p>
        <Link href={`/${lang}/business/sign-in?next=${encodeURIComponent(`/${lang}/business/dashboard`)}`} className={buttonClass("primary")}>
          {dict.signIn}
        </Link>
      </Card>
    );

  if (state.name === "noPlaces")
    return (
      <Card className="space-y-4" data-testid="dashboard-empty">
        <p>{dict.noPlaces}</p>
        {state.claims.length > 0 ? (
          <div className="space-y-2">
            <h2 className="font-heading text-lg font-semibold">{dict.claimsHeading}</h2>
            <ul className="space-y-1 text-sm">
              {state.claims.map((c) => (
                <li key={c.id} data-testid="claim-row">
                  {dict.claimStatus[c.status] ?? c.status}
                  {c.decisionReason ? <span className="text-muted"> — {c.decisionReason}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <Link href={`/${lang}/business/claim`} className={buttonClass("primary")}>
          {dict.claimLink}
        </Link>
      </Card>
    );

  return (
    <div className="space-y-6">
      {state.places.length > 1 ? (
        <div className="max-w-sm space-y-1">
          <label htmlFor="dash-place" className="font-medium">
            {dict.placePicker}
          </label>
          <select id="dash-place" value={placeId ?? ""} onChange={(e) => setPlaceId(e.target.value)} className={`${input} min-h-11`}>
            {state.places.map((p) => (
              <option key={p.entityId} value={p.entityId}>
                {pick(p.name, lang)}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {placeId ? <PlaceDashboard key={placeId} lang={lang} dict={dict} contactDict={contactDict} placeId={placeId} /> : null}
    </div>
  );
}

function PlaceDashboard({ lang, dict, contactDict, placeId }: { lang: Locale; dict: Dict; contactDict: ContactDict; placeId: string }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await unwrap<Dashboard>(api.GET("/api/business/places/{entityId}/dashboard", { params: { path: { entityId: placeId } } }));
      if (cancelled) return;
      if (result.ok) {
        setData(result.data);
        setError(null);
      } else setError(dict.errors[result.error] ?? dict.errors.unknown);
    })();
    return () => {
      cancelled = true;
    };
  }, [placeId, version, dict.errors]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  async function markSeen() {
    await unwrap(api.POST("/api/business/places/{entityId}/seen", { params: { path: { entityId: placeId } } }));
    reload();
  }

  if (error) return <p role="alert" className="text-negative">{error}</p>;
  if (!data) return <p className="text-muted">…</p>;

  const k = data.kpis;
  const none = dict.kpis.none;
  const tiles: [string, string, string][] = [
    ["reviews", dict.kpis.reviews, formatNumber(lang, k.reviews)],
    ["verified", dict.kpis.verified, formatNumber(lang, k.verifiedReviews)],
    ["score", dict.kpis.score, k.score === null ? none : formatScore(lang, k.score)],
    ["replyRate", dict.kpis.replyRate, k.replyRatePercent === null ? none : `${formatNumber(lang, k.replyRatePercent)}%`],
  ];

  return (
    <div className="space-y-6" data-testid="dashboard">
      <p className="flex flex-wrap items-center gap-3 text-sm">
        <span data-testid="alerts" className={data.newReviews > 0 ? "font-semibold" : "text-muted"}>
          {data.newReviews > 0 ? fmt(dict.alerts.new, { n: formatNumber(lang, data.newReviews) }) : dict.alerts.none}
        </span>
        {data.newReviews > 0 ? (
          <button type="button" onClick={() => void markSeen()} className="font-medium text-link underline">
            {dict.alerts.markSeen}
          </button>
        ) : null}
        {sent ? <span role="status" data-testid="reply-sent" className="font-medium">{dict.waiting.sent}</span> : null}
        <Link href={entityPath(lang, data.place.categoryId, { id: data.place.entityId, slugs: data.place.slugs })} className="ms-auto font-medium text-link underline">
          {dict.viewPage}
        </Link>
      </p>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(([id, label, value]) => (
          <li key={id}>
            <Card className="space-y-1" data-testid={`kpi-${id}`}>
              <p className="text-sm text-muted">{label}</p>
              <p className="font-heading text-3xl font-bold">{value}</p>
            </Card>
          </li>
        ))}
      </ul>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="font-heading text-lg font-semibold">{dict.trend.heading}</h2>
          <Trend lang={lang} points={data.trend} empty={dict.trend.empty} count={dict.trend.reviews} />
        </Card>
        <Card className="space-y-3">
          <h2 className="font-heading text-lg font-semibold">{dict.compare.heading}</h2>
          {k.score === null || data.categoryAverage === null ? (
            <p className="text-muted">{dict.compare.noData}</p>
          ) : (
            <div className="space-y-3 text-sm" data-testid="compare">
              <Bar label={dict.compare.you} value={k.score} text={formatScore(lang, k.score)} strong />
              <Bar label={dict.compare.category} value={data.categoryAverage} text={formatScore(lang, data.categoryAverage)} />
            </div>
          )}
        </Card>
      </div>

      {data.contactGated ? <DashboardContact lang={lang} dict={contactDict} placeId={placeId} planShowsContact={data.planShowsContact} /> : null}

      {data.repliesInModeration > 0 ? <p className="text-sm text-muted" data-testid="replies-pending">{fmt(dict.waiting.pending, { n: formatNumber(lang, data.repliesInModeration) })}</p> : null}

      <section aria-labelledby="waiting" className="space-y-3">
        <h2 id="waiting" className="font-heading text-xl font-semibold">
          {dict.waiting.heading} ({formatNumber(lang, data.awaitingReply.length)})
        </h2>
        {data.awaitingReply.length === 0 ? (
          <p className="text-muted">{dict.waiting.empty}</p>
        ) : (
          <ul className="space-y-3">
            {data.awaitingReply.map((r) => (
              <li key={r.id}>
                <WaitingReview lang={lang} dict={dict} review={r} onReplied={() => { setSent(true); reload(); }} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Bar({ label, value, text, strong }: { label: string; value: number; text: string; strong?: boolean }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <span className={strong ? "font-semibold" : "text-muted"}>{label}</span>
        <span className="font-semibold">{text}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
        <div className={`h-full rounded-full ${strong ? "bg-verified" : "bg-muted"}`} style={{ width: `${Math.max(0, Math.min(100, (value / 5) * 100))}%` }} />
      </div>
    </div>
  );
}

/** Monthly scores as a line. Months with no verified review are gaps, not zeros. */
function Trend({ lang, points, empty, count }: { lang: Locale; points: { month: string; score: number | null; reviews: number }[]; empty: string; count: string }) {
  const scored = points.filter((p) => p.score !== null);
  if (scored.length === 0) return <p className="text-muted">{empty}</p>;
  const w = 320;
  const h = 120;
  const x = (i: number) => (points.length === 1 ? w / 2 : 12 + (i * (w - 24)) / (points.length - 1));
  const y = (s: number) => h - 12 - ((s - 1) / 4) * (h - 24);
  const line = points.flatMap((p, i) => (p.score === null ? [] : [`${x(i)},${y(p.score)}`])).join(" ");
  const month = (m: string) => new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en", { month: "short", timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`));
  return (
    <div className="space-y-2" data-testid="trend">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={points.map((p) => `${month(p.month)} ${p.score === null ? "–" : formatScore(lang, p.score)}`).join(", ")} className="w-full text-verified">
        <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (p.score === null ? null : <circle key={p.month} cx={x(i)} cy={y(p.score)} r="3.5" fill="currentColor" />))}
      </svg>
      <ol className="flex justify-between text-xs text-muted">
        {points.map((p) => (
          <li key={p.month} className="text-center">
            <span className="block">{month(p.month)}</span>
            <span className="block font-semibold text-foreground">{p.score === null ? "–" : formatScore(lang, p.score)}</span>
            {p.reviews > 0 ? <span className="block">{fmt(count, { n: formatNumber(lang, p.reviews) })}</span> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

function WaitingReview({ lang, dict, review, onReplied }: { lang: Locale; dict: Dict; review: BusinessReviewItem; onReplied: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = dict.waiting;
  const name = review.anonymous || !review.author ? t.anonymous : review.author.name;

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await unwrap(api.POST("/api/reviews/{reviewId}/owner-reply", { params: { path: { reviewId: review.id } }, body: { text } }));
    setBusy(false);
    if (result.ok) onReplied();
    else setError(dict.errors[result.error] ?? dict.errors.unknown);
  }

  return (
    <Card className="space-y-3">
      <article data-testid="waiting-review" className="space-y-3">
        <header className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold" data-testid="waiting-author">{name}</span>
          <time dateTime={review.createdAt} className="text-muted">{formatDate(lang, review.createdAt)}</time>
          <span className="text-muted">{review.verified ? t.verified : t.unverified}</span>
          {review.underReview ? <span className="text-muted">· {t.under}</span> : null}
          {review.overall !== null ? <Stars value={review.overall} label={formatScore(lang, review.overall)} /> : null}
        </header>
        {review.text ? <p lang={review.language} dir="auto" className="whitespace-pre-line leading-7">{review.text}</p> : null}
        {open ? (
          <form onSubmit={send} className="space-y-2">
            <label htmlFor={`reply-${review.id}`} className="sr-only">{t.reply}</label>
            <textarea id={`reply-${review.id}`} rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder={t.placeholder} className={input} aria-describedby={`reply-help-${review.id}`} />
            <p id={`reply-help-${review.id}`} className="text-sm text-muted">{t.help}</p>
            {error ? <p role="alert" className="text-sm text-negative">{error}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="primary" disabled={busy || text.trim().length < 2}>{busy ? t.sending : t.send}</Button>
              <Button type="button" variant="ghost" onClick={() => { setOpen(false); setError(null); }}>{t.cancel}</Button>
            </div>
          </form>
        ) : (
          <Button type="button" variant="secondary" onClick={() => setOpen(true)}>{t.reply}</Button>
        )}
      </article>
    </Card>
  );
}
