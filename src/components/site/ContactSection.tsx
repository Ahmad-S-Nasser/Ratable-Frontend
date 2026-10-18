"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Locale } from "@/i18n/config";
import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/http";
import type { Me, PublicContact } from "@/lib/api/types";

/** Counts one view of the page for the owner's stats. It sends nothing about the visitor and runs once per page load. */
export function ViewBeacon({ entityId }: { entityId: string }) {
  useEffect(() => {
    void fetch(`/api/entities/${entityId}/views`, { method: "POST", credentials: "same-origin", keepalive: true }).catch(() => undefined);
  }, [entityId]);
  return null;
}

type ShowDict = { heading: string; show: string; showing: string; phone: string; whatsapp: string; links: string; none: string; rateLimited: string };

const digits = (value: string) => value.replace(/[^\d]/g, "");

/** The contact details, once shown. Links carry rel="nofollow ugc" because the owner typed them. */
export function ContactList({ contact, dict }: { contact: PublicContact; dict: ShowDict }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm" data-testid="contact-list">
      {contact.phone ? (
        <>
          <dt className="text-muted">{dict.phone}</dt>
          <dd dir="ltr" className="text-start">
            <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className="font-medium text-link underline">
              {contact.phone}
            </a>
          </dd>
        </>
      ) : null}
      {contact.whatsApp ? (
        <>
          <dt className="text-muted">{dict.whatsapp}</dt>
          <dd dir="ltr" className="text-start">
            <a href={`https://wa.me/${digits(contact.whatsApp)}`} target="_blank" rel="nofollow ugc noopener noreferrer" className="font-medium text-link underline">
              {contact.whatsApp}
            </a>
          </dd>
        </>
      ) : null}
      {contact.links.length > 0 ? (
        <>
          <dt className="text-muted">{dict.links}</dt>
          <dd className="space-y-1" dir="ltr">
            {contact.links.map((l) => (
              <a key={l} href={l} target="_blank" rel="nofollow ugc noopener noreferrer" className="block break-all font-medium text-link underline">
                {l}
              </a>
            ))}
          </dd>
        </>
      ) : null}
    </dl>
  );
}

/** Show contact: a separate call that the server logs and rate-limits. The details are not in the page until this succeeds. */
export function ShowContact({ entityId, dict }: { entityId: string; dict: ShowDict }) {
  const [contact, setContact] = useState<PublicContact | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reveal() {
    setBusy(true);
    setError(null);
    const result = await unwrap<PublicContact>(api.POST("/api/entities/{id}/contact/reveal", { params: { path: { id: entityId } } }));
    setBusy(false);
    if (result.ok) setContact(result.data);
    else setError(result.status === 429 ? dict.rateLimited : dict.none);
  }

  if (contact) return <ContactList contact={contact} dict={dict} />;
  return (
    <div className="space-y-2">
      <Button type="button" variant="secondary" disabled={busy} onClick={() => void reveal()} data-testid="show-contact">
        {busy ? dict.showing : dict.show}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type RequestDict = {
  heading: string; signInNeeded: string; signIn: string; whatLabel: string; whatHelp: string; whenLabel: string; whenPlaceholder: string; reachLabel: string;
  viaRatable: string; shareWhatsApp: string; shareNote: string; submit: string; sending: string; sentHeading: string; sentText: string; seeRequests: string;
  errors: Record<string, string>;
};

const input = "w-full rounded-xl border border-border bg-background px-3 py-2";

/** Request contact: what you need, when, and how you want to be reached. Your number goes only to this provider, and only if you choose to share it. */
export function RequestContactForm({ lang, entityId, returnPath, dict }: { lang: Locale; entityId: string; returnPath: string; dict: RequestDict }) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [what, setWhat] = useState("");
  const [when, setWhen] = useState("");
  const [share, setShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const me = await unwrap<Me>(api.GET("/api/me"));
      if (!cancelled) setSignedIn(me.ok);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await unwrap(api.POST("/api/entities/{entityId}/contact-requests", { params: { path: { entityId } }, body: { what: what.trim(), when: when.trim() || null, shareWhatsApp: share } }));
    setBusy(false);
    if (result.ok) setSent(true);
    else setError(dict.errors[result.error] ?? dict.errors.unknown);
  }

  if (signedIn === null) return null;
  if (!signedIn)
    return (
      <div className="space-y-3">
        <p>{dict.signInNeeded}</p>
        <Link href={`/${lang}/sign-in?next=${encodeURIComponent(returnPath)}`} className={buttonClass("secondary")}>
          {dict.signIn}
        </Link>
      </div>
    );

  if (sent)
    return (
      <div className="space-y-3" data-testid="request-sent">
        <h3 role="status" className="font-heading text-lg font-semibold">
          {dict.sentHeading}
        </h3>
        <p className="leading-7 text-muted">{dict.sentText}</p>
        <Link href={`/${lang}/me/requests`} className={buttonClass("secondary")}>
          {dict.seeRequests}
        </Link>
      </div>
    );

  return (
    <form onSubmit={submit} className="space-y-4" noValidate data-testid="request-form">
      <h3 className="font-heading text-lg font-semibold">{dict.heading}</h3>
      <div className="space-y-1">
        <label htmlFor="req-what" className="font-medium">
          {dict.whatLabel}
        </label>
        <textarea id="req-what" rows={3} maxLength={300} value={what} onChange={(e) => setWhat(e.target.value)} className={input} aria-describedby="req-what-help" />
        <p id="req-what-help" className="text-sm text-muted">
          {dict.whatHelp}
        </p>
      </div>
      <div className="space-y-1">
        <label htmlFor="req-when" className="font-medium">
          {dict.whenLabel}
        </label>
        <input id="req-when" maxLength={100} value={when} onChange={(e) => setWhen(e.target.value)} placeholder={dict.whenPlaceholder} className={`${input} min-h-11`} />
      </div>
      <fieldset className="space-y-2">
        <legend className="font-medium">{dict.reachLabel}</legend>
        <label className="flex items-start gap-2">
          <input type="radio" name="reach" checked={!share} onChange={() => setShare(false)} className="mt-1" />
          <span>{dict.viaRatable}</span>
        </label>
        <label className="flex items-start gap-2">
          <input type="radio" name="reach" checked={share} onChange={() => setShare(true)} className="mt-1" />
          <span>{dict.shareWhatsApp}</span>
        </label>
        <p className="text-sm text-muted">{dict.shareNote}</p>
      </fieldset>
      {error ? (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" disabled={busy || what.trim().length < 3}>
        {busy ? dict.sending : dict.submit}
      </Button>
    </form>
  );
}

export function LockedContact({ children, heading, text }: { children: React.ReactNode; heading: string; text: string }) {
  return (
    <Card className="space-y-4" data-testid="contact-locked">
      <h3 className="font-heading text-lg font-semibold">{heading}</h3>
      <p className="leading-7 text-muted">{text}</p>
      {children}
    </Card>
  );
}
