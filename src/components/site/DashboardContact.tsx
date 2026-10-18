"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Locale } from "@/i18n/config";
import { fmt, formatDate, formatNumber } from "@/i18n/format";
import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/http";
import type { BusinessStats, ContactDto, Nudge, ProviderRequests, StatsResponse, NudgesResponse } from "@/lib/api/types";

export type ContactDict = {
  heading: string;
  requests: {
    heading: string; locked: string; empty: string; reply: string; placeholder: string; send: string; sending: string; cancel: string; sharedWhatsApp: string; reader: string;
    status: Record<string, string>; closes: string; errors: Record<string, string>;
  };
  stats: { heading: string; views7: string; taps: string; requests: string; open: string; trend: string };
  editor: { heading: string; intro: string; phone: string; whatsapp: string; links: string; save: string; saving: string; saved: string; errors: Record<string, string> };
  nudges: { dismiss: string; plans: string; top3: string; views: string; waiting: string; closed: string };
};

const input = "w-full rounded-xl border border-border bg-background px-3 py-2";

/**
 * The contact part of the dashboard for a place in a category that gates contact. With the plan: brief stats and the requests to read and answer. Without it: only upgrade
 * messages built from the same counts, and how many requests exist. The messages state facts and never promise a better rank for paying.
 */
export function DashboardContact({ lang, dict, placeId, planShowsContact }: { lang: Locale; dict: ContactDict; placeId: string; planShowsContact: boolean }) {
  return (
    <section aria-labelledby="dash-contact" className="space-y-4" data-testid="dashboard-contact">
      <h2 id="dash-contact" className="font-heading text-xl font-semibold">
        {dict.heading}
      </h2>
      {planShowsContact ? <Stats lang={lang} dict={dict} placeId={placeId} /> : <Nudges lang={lang} dict={dict} placeId={placeId} />}
      <Requests lang={lang} dict={dict} placeId={placeId} />
      <Editor dict={dict} placeId={placeId} />
    </section>
  );
}

function Stats({ lang, dict, placeId }: { lang: Locale; dict: ContactDict; placeId: string }) {
  const [stats, setStats] = useState<BusinessStats | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await unwrap<StatsResponse>(api.GET("/api/business/places/{entityId}/stats", { params: { path: { entityId: placeId } } }));
      if (!cancelled && result.ok) setStats(result.data.stats);
    })();
    return () => {
      cancelled = true;
    };
  }, [placeId]);
  if (!stats) return null;
  const tiles: [string, string, number][] = [
    ["views7", dict.stats.views7, stats.viewsLast7Days],
    ["taps", dict.stats.taps, stats.contactTapsLast30Days],
    ["requests", dict.stats.requests, stats.requestsLast30Days],
    ["open", dict.stats.open, stats.openRequests],
  ];
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted">{dict.stats.heading}</h3>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(([id, label, value]) => (
          <li key={id}>
            <Card className="space-y-1" data-testid={`stat-${id}`}>
              <p className="text-sm text-muted">{label}</p>
              <p className="font-heading text-3xl font-bold">{formatNumber(lang, value)}</p>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Nudges({ lang, dict, placeId }: { lang: Locale; dict: ContactDict; placeId: string }) {
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await unwrap<NudgesResponse>(api.GET("/api/business/places/{entityId}/nudges", { params: { path: { entityId: placeId } } }));
      if (!cancelled && result.ok) setNudges(result.data.nudges);
    })();
    return () => {
      cancelled = true;
    };
  }, [placeId, version]);

  async function dismiss(trigger: string) {
    await unwrap(api.POST("/api/business/places/{entityId}/nudges/{trigger}/dismiss", { params: { path: { entityId: placeId, trigger } } }));
    setVersion((v) => v + 1);
  }

  const copy = dict.nudges as unknown as Record<string, string>;
  const words = (n: Nudge) => fmt(copy[n.trigger] ?? "", { n: formatNumber(lang, n.count), rank: formatNumber(lang, n.rank ?? n.count), area: n.area ?? "" });
  if (nudges.length === 0) return null;
  return (
    <ul className="grid gap-4 lg:grid-cols-3" data-testid="nudges">
      {nudges.map((n) => (
        <li key={n.trigger}>
          <Card className="flex h-full flex-col gap-3" data-testid={`nudge-${n.trigger}`}>
            <p className="font-heading text-3xl font-bold">{formatNumber(lang, n.count)}</p>
            <p className="flex-1 leading-7">{words(n)}</p>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Link href={`/${lang}/business/pricing`} className="font-medium text-link underline">
                {dict.nudges.plans}
              </Link>
              <button type="button" onClick={() => void dismiss(n.trigger)} className="ms-auto font-medium text-muted underline">
                {dict.nudges.dismiss}
              </button>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}

function Requests({ lang, dict, placeId }: { lang: Locale; dict: ContactDict; placeId: string }) {
  const [data, setData] = useState<ProviderRequests | null>(null);
  const [version, setVersion] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = dict.requests;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await unwrap<ProviderRequests>(api.GET("/api/business/places/{entityId}/contact-requests", { params: { path: { entityId: placeId } } }));
      if (!cancelled && result.ok) setData(result.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [placeId, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  async function send(event: React.FormEvent, requestId: string) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await unwrap(api.POST("/api/business/places/{entityId}/contact-requests/{requestId}/reply", { params: { path: { entityId: placeId, requestId } }, body: { text } }));
    setBusy(false);
    if (result.ok) {
      setOpenId(null);
      setText("");
      reload();
    } else setError(t.errors[result.error] ?? t.errors.unknown);
  }

  if (!data) return null;
  return (
    <Card className="space-y-3">
      <h3 className="font-heading text-lg font-semibold">
        {t.heading} ({formatNumber(lang, data.total)})
      </h3>
      {data.locked ? (
        <p className="leading-7 text-muted" data-testid="requests-locked">
          {fmt(t.locked, { n: formatNumber(lang, data.total) })}
        </p>
      ) : data.items.length === 0 ? (
        <p className="text-muted">{t.empty}</p>
      ) : (
        <ul className="space-y-3">
          {data.items.map((r) => (
            <li key={r.id} className="space-y-2 rounded-xl border border-border p-4" data-testid="provider-request">
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">{r.readerName ?? t.reader}</span>
                <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs font-medium">{t.status[r.status] ?? r.status}</span>
                <time dateTime={r.createdAt} className="text-muted">{formatDate(lang, r.createdAt)}</time>
                {r.status === "Open" ? <span className="ms-auto text-muted">{fmt(t.closes, { date: formatDate(lang, r.expiresAt) })}</span> : null}
              </p>
              <p dir="auto" className="leading-7">{r.what}</p>
              {r.when ? <p dir="auto" className="text-sm text-muted">{r.when}</p> : null}
              {r.whatsApp ? (
                <p className="text-sm">
                  <span className="text-muted">{t.sharedWhatsApp}: </span>
                  <a dir="ltr" href={`https://wa.me/${r.whatsApp.replace(/[^\d]/g, "")}`} target="_blank" rel="nofollow noopener noreferrer" className="font-medium text-link underline">
                    {r.whatsApp}
                  </a>
                </p>
              ) : null}
              {r.replyText ? <p dir="auto" className="rounded-xl bg-surface-2 p-3 leading-7">{r.replyText}</p> : null}
              {r.status === "Open" ? (
                openId === r.id ? (
                  <form onSubmit={(e) => void send(e, r.id)} className="space-y-2">
                    <label htmlFor={`reply-${r.id}`} className="sr-only">{t.reply}</label>
                    <textarea id={`reply-${r.id}`} rows={3} maxLength={900} value={text} onChange={(e) => setText(e.target.value)} placeholder={t.placeholder} className={input} />
                    {error ? <p role="alert" className="text-sm text-negative">{error}</p> : null}
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" variant="primary" disabled={busy || text.trim().length < 2}>{busy ? t.sending : t.send}</Button>
                      <Button type="button" variant="ghost" onClick={() => { setOpenId(null); setError(null); }}>{t.cancel}</Button>
                    </div>
                  </form>
                ) : (
                  <Button type="button" variant="secondary" onClick={() => { setOpenId(r.id); setText(""); }}>{t.reply}</Button>
                )
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Editor({ dict, placeId }: { dict: ContactDict; placeId: string }) {
  const t = dict.editor;
  const [phone, setPhone] = useState("");
  const [whatsApp, setWhatsApp] = useState("");
  const [links, setLinks] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await unwrap<ContactDto>(api.GET("/api/business/places/{entityId}/contact", { params: { path: { entityId: placeId } } }));
      if (cancelled || !result.ok) return;
      setPhone(result.data.phone ?? "");
      setWhatsApp(result.data.whatsApp ?? "");
      setLinks(result.data.links.join("\n"));
    })();
    return () => {
      cancelled = true;
    };
  }, [placeId]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const body = { phone: phone.trim() || null, whatsApp: whatsApp.trim() || null, links: links.split("\n").map((l) => l.trim()).filter(Boolean) };
    const result = await unwrap<ContactDto>(api.PUT("/api/business/places/{entityId}/contact", { params: { path: { entityId: placeId } }, body }));
    setBusy(false);
    setMessage(result.ok ? { tone: "ok", text: t.saved } : { tone: "error", text: t.errors[result.error] ?? t.errors.unknown });
  }

  return (
    <Card className="space-y-3">
      <h3 className="font-heading text-lg font-semibold">{t.heading}</h3>
      <p className="text-sm text-muted">{t.intro}</p>
      <form onSubmit={save} className="space-y-3" noValidate>
        <div className="space-y-1">
          <label htmlFor="ct-phone" className="font-medium">{t.phone}</label>
          <input id="ct-phone" type="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} className={`${input} min-h-11`} />
        </div>
        <div className="space-y-1">
          <label htmlFor="ct-wa" className="font-medium">{t.whatsapp}</label>
          <input id="ct-wa" type="tel" dir="ltr" value={whatsApp} onChange={(e) => setWhatsApp(e.target.value)} className={`${input} min-h-11`} />
        </div>
        <div className="space-y-1">
          <label htmlFor="ct-links" className="font-medium">{t.links}</label>
          <textarea id="ct-links" rows={3} dir="ltr" value={links} onChange={(e) => setLinks(e.target.value)} className={input} />
        </div>
        {message ? (
          <p role={message.tone === "ok" ? "status" : "alert"} className={`text-sm ${message.tone === "ok" ? "text-muted" : "text-negative"}`}>{message.text}</p>
        ) : null}
        <Button type="submit" variant="secondary" disabled={busy}>{busy ? t.saving : t.save}</Button>
      </form>
    </Card>
  );
}
