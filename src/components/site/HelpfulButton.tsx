"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ThumbsUpIcon } from "@/components/ui/Icons";
import type { Locale } from "@/i18n/config";
import { fmt, formatNumber } from "@/i18n/format";
import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/http";
import type { HelpfulState } from "@/lib/api/types";

type Ctx = { signedIn: boolean | null; voted: Set<string>; counts: Record<string, number>; toggle: (reviewId: string) => Promise<void> };
const HelpfulContext = createContext<Ctx | null>(null);

/** Reads once which of the shown reviews this person marked helpful (their own votes only), and lets the buttons toggle. */
export function HelpfulProvider({ reviewIds, initial, children }: { reviewIds: string[]; initial: Record<string, number>; children: ReactNode }) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [voted, setVoted] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState(initial);
  const key = reviewIds.join(",");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const me = await unwrap(api.GET("/api/me"));
      if (cancelled) return;
      if (!me.ok) return setSignedIn(false);
      const mine = await unwrap<string[]>(api.GET("/api/me/helpful", { params: { query: { reviewIds: key } } }));
      if (cancelled) return;
      setVoted(new Set(mine.ok ? mine.data : []));
      setSignedIn(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  const toggle = useCallback(
    async (reviewId: string) => {
      const was = voted.has(reviewId);
      const result = await unwrap<HelpfulState>(was ? api.DELETE("/api/reviews/{id}/helpful", { params: { path: { id: reviewId } } }) : api.PUT("/api/reviews/{id}/helpful", { params: { path: { id: reviewId } } }));
      if (!result.ok) return;
      setVoted((all) => {
        const next = new Set(all);
        if (result.data.voted) next.add(reviewId);
        else next.delete(reviewId);
        return next;
      });
      setCounts((c) => ({ ...c, [reviewId]: result.data.count }));
    },
    [voted],
  );

  const value = useMemo(() => ({ signedIn, voted, counts, toggle }), [signedIn, voted, counts, toggle]);
  return <HelpfulContext.Provider value={value}>{children}</HelpfulContext.Provider>;
}

type Labels = { button: string; pressed: string; signIn: string; count: string };

/** "Helpful": a person can mark a review once (not their own). The count is public; who marked it never is. */
export function HelpfulButton({ lang, reviewId, signInNext, labels }: { lang: Locale; reviewId: string; signInNext: string; labels: Labels }) {
  const ctx = useContext(HelpfulContext);
  if (!ctx) return null;
  const count = ctx.counts[reviewId] ?? 0;
  const on = ctx.voted.has(reviewId);

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      {ctx.signedIn === false ? (
        <Link href={`/${lang}/sign-in?next=${encodeURIComponent(signInNext)}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 hover:bg-surface-2">
          <ThumbsUpIcon width={18} height={18} />
          {labels.button}
        </Link>
      ) : (
        <button
          type="button"
          aria-pressed={on}
          onClick={() => void ctx.toggle(reviewId)}
          disabled={ctx.signedIn === null}
          className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 transition-colors ${on ? "border-verified bg-tint text-verified" : "border-border hover:bg-surface-2"}`}
        >
          <ThumbsUpIcon width={18} height={18} />
          {on ? labels.pressed : labels.button}
        </button>
      )}
      {count > 0 ? (
        <span className="text-muted" data-testid="helpful-count">
          {fmt(labels.count, { count: formatNumber(lang, count) })}
        </span>
      ) : null}
    </div>
  );
}
