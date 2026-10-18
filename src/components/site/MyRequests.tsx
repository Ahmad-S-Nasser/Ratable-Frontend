"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Locale } from "@/i18n/config";
import { fmt, formatDate, formatScore } from "@/i18n/format";
import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/http";
import type { ReaderRequestView } from "@/lib/api/types";
import { pick } from "@/lib/pick";
import { entityPath } from "@/lib/urls";

type Dict = {
  description: string; empty: string; signInNeeded: string; signIn: string; status: Record<string, string>; closes: string; sharedWhatsApp: string; viaRatable: string;
  reply: string; alternativesHeading: string; alternativesText: string; score: string; viewProvider: string;
};

type State = { name: "loading" } | { name: "signedOut" } | { name: "ready"; items: ReaderRequestView[] };

/** The requests a reader sent: the provider's answer, or, once a request closed unanswered, other providers nearby (best verified score first, then distance). */
export function MyRequests({ lang, dict }: { lang: Locale; dict: Dict }) {
  const [state, setState] = useState<State>({ name: "loading" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await unwrap<ReaderRequestView[]>(api.GET("/api/me/contact-requests"));
      if (!cancelled) setState(result.ok ? { name: "ready", items: result.data } : { name: "signedOut" });
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
        <Link href={`/${lang}/sign-in?next=${encodeURIComponent(`/${lang}/me/requests`)}`} className={buttonClass("primary")}>
          {dict.signIn}
        </Link>
      </Card>
    );
  if (state.items.length === 0) return <p className="text-muted">{dict.empty}</p>;

  return (
    <ul className="space-y-4">
      {state.items.map((r) => (
        <li key={r.id}>
          <Card className="space-y-3">
            <article data-testid="my-request" className="space-y-3">
              <header className="flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full border border-border bg-surface-2 px-3 py-1 font-medium" data-testid="request-status">
                  {dict.status[r.status] ?? r.status}
                </span>
                <span className="text-muted">{r.shareWhatsApp ? dict.sharedWhatsApp : dict.viaRatable}</span>
                {r.status === "Open" ? <span className="ms-auto text-muted">{fmt(dict.closes, { date: formatDate(lang, r.expiresAt) })}</span> : null}
              </header>
              <p dir="auto" className="leading-7">{r.what}</p>
              {r.when ? <p dir="auto" className="text-sm text-muted">{r.when}</p> : null}
              {r.replyText ? (
                <div className="rounded-2xl border border-border bg-surface-2 p-4">
                  <p className="mb-1 text-sm font-semibold">{dict.reply}</p>
                  <p dir="auto" className="whitespace-pre-line leading-7">{r.replyText}</p>
                </div>
              ) : null}
              {r.alternatives.length > 0 ? (
                <div className="space-y-2" data-testid="alternatives">
                  <h2 className="font-heading text-lg font-semibold">{dict.alternativesHeading}</h2>
                  <p className="text-sm text-muted">{dict.alternativesText}</p>
                  <ul className="space-y-2">
                    {r.alternatives.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3">
                        <span dir="auto" className="font-medium">
                          {pick(a.name, lang)}
                          {a.score !== null ? <span className="ms-2 text-sm text-muted">{fmt(dict.score, { score: formatScore(lang, a.score) })}</span> : null}
                        </span>
                        <Link href={entityPath(lang, a.categoryId, { id: a.id, slugs: a.slugs })} className={buttonClass("secondary")}>
                          {dict.viewProvider}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </article>
          </Card>
        </li>
      ))}
    </ul>
  );
}
