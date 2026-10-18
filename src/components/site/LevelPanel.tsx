"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Locale } from "@/i18n/config";
import { fmt, formatDate, formatNumber } from "@/i18n/format";
import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/http";
import type { RewardsView } from "@/lib/api/types";
import { pick } from "@/lib/pick";

type Dict = {
  points: string; rank: string; toNext: string; topRank: string; badges: string; badgeEarned: string; badgeProgress: string; missions: string; missionDone: string;
  streak: string; streakText: string; streakNone: string; recent: string; noEvents: string; howItWorks: string; signInNeeded: string; signIn: string; loading: string;
  reasons: Record<string, string>; rankUp: { heading: string; text: string; close: string };
};

type State = { phase: "loading" } | { phase: "signedOut" } | { phase: "ready"; data: RewardsView };

const name = (t: { ar?: string; en?: string }, lang: Locale) => pick(t, lang);

/** The rank-up moment: shown once, then the rank is marked as seen. */
export function RankUpDialog({ lang, up, dict, onClose }: { lang: Locale; up: NonNullable<RewardsView["rankUp"]>; dict: Dict["rankUp"]; onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="rankup-title" className="fixed inset-0 z-50 grid place-items-center bg-scrim p-4">
      <div className="w-full max-w-sm space-y-4 rounded-card bg-surface p-6 text-center">
        <h2 id="rankup-title" className="font-heading text-2xl font-semibold text-verified">
          {dict.heading}
        </h2>
        <p>{fmt(dict.text, { rank: name(up.to.title, lang) })}</p>
        <Button type="button" variant="primary" onClick={onClose} autoFocus>
          {dict.close}
        </Button>
      </div>
    </div>
  );
}

/** My level and points: the rank and what is left to the next, badges, this week's missions, the weekly streak and the latest entries of the ledger. */
export function LevelPanel({ lang, dict }: { lang: Locale; dict: Dict }) {
  const [state, setState] = useState<State>({ phase: "loading" });
  const [showUp, setShowUp] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await unwrap<RewardsView>(api.GET("/api/me/rewards"));
      if (!cancelled) setState(result.ok ? { phase: "ready", data: result.data } : { phase: "signedOut" });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.phase === "loading") return <p className="text-muted">{dict.loading}</p>;
  if (state.phase === "signedOut")
    return (
      <Card className="space-y-4">
        <p>{dict.signInNeeded}</p>
        <Link href={`/${lang}/sign-in?next=${encodeURIComponent(`/${lang}/me/level`)}`} className={buttonClass("primary")}>
          {dict.signIn}
        </Link>
      </Card>
    );

  const r = state.data;
  const span = r.nextRank ? r.nextRank.minPoints - r.rank.minPoints : 1;
  const share = r.nextRank ? Math.min(100, Math.round(((r.points - r.rank.minPoints) / span) * 100)) : 100;

  async function closeRankUp() {
    setShowUp(false);
    await unwrap(api.POST("/api/me/rewards/seen", { body: { rankId: r.rank.id } }));
  }

  return (
    <div className="space-y-8">
      {r.rankUp && showUp ? <RankUpDialog lang={lang} up={r.rankUp} dict={dict.rankUp} onClose={() => void closeRankUp()} /> : null}

      <Card className="space-y-3">
        <p className="text-sm text-muted">{dict.rank}</p>
        <p className="font-heading text-3xl font-semibold text-verified" data-testid="rank-name">
          {name(r.rank.title, lang)}
        </p>
        <p data-testid="points-total" className="text-lg">
          {fmt(dict.points, { n: formatNumber(lang, r.points) })}
        </p>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={share}
          aria-label={dict.rank}
          className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
        >
          <div className="h-full bg-verified" style={{ width: `${share}%` }} />
        </div>
        <p className="text-sm text-muted">{r.nextRank ? fmt(dict.toNext, { n: formatNumber(lang, r.pointsToNext), rank: name(r.nextRank.title, lang) }) : dict.topRank}</p>
        <Link href={`/${lang}/points`} className="text-sm font-medium text-link underline">
          {dict.howItWorks}
        </Link>
      </Card>

      <section aria-labelledby="streak" className="space-y-2">
        <h2 id="streak" className="font-heading text-xl font-semibold">
          {dict.streak}
        </h2>
        <p data-testid="streak">{r.streakWeeks > 0 ? fmt(dict.streakText, { n: formatNumber(lang, r.streakWeeks) }) : dict.streakNone}</p>
      </section>

      <section aria-labelledby="missions" className="space-y-3">
        <h2 id="missions" className="font-heading text-xl font-semibold">
          {dict.missions}
        </h2>
        <ul className="space-y-2">
          {r.missions.map((m) => (
            <li key={m.id}>
              <Card className="flex items-center justify-between gap-3">
                <span>{name(m.title, lang)}</span>
                <span className={`text-sm font-medium ${m.done ? "text-verified" : "text-muted"}`}>
                  {m.done ? dict.missionDone : fmt(dict.badgeProgress, { have: m.progress, need: m.target })}
                </span>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="badges" className="space-y-3">
        <h2 id="badges" className="font-heading text-xl font-semibold">
          {dict.badges}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {r.badges.map((b) => (
            <li key={b.id}>
              <Card className={`h-full space-y-1 ${b.earned ? "" : "border-dashed"}`}>
                <p className="font-semibold">{name(b.title, lang)}</p>
                <p className="text-sm text-muted">{name(b.description, lang)}</p>
                <p className={`text-xs font-medium ${b.earned ? "text-verified" : "text-muted"}`}>{b.earned ? dict.badgeEarned : fmt(dict.badgeProgress, { have: b.progress, need: b.threshold })}</p>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="recent" className="space-y-3">
        <h2 id="recent" className="font-heading text-xl font-semibold">
          {dict.recent}
        </h2>
        {r.recent.length === 0 ? (
          <p className="text-muted">{dict.noEvents}</p>
        ) : (
          <ul className="space-y-2">
            {r.recent.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 border-b border-border py-2 text-sm">
                <span>
                  {dict.reasons[e.reason] ?? dict.reasons[e.action] ?? e.reason}
                  <span className="block text-xs text-muted">{formatDate(lang, e.createdAt)}</span>
                </span>
                <span className={`font-semibold ${e.points < 0 ? "text-negative" : "text-verified"}`} dir="ltr">
                  {e.points > 0 ? "+" : ""}
                  {formatNumber(lang, e.points)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
