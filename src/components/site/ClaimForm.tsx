"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Locale } from "@/i18n/config";
import { fmt } from "@/i18n/format";
import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/http";
import type { Me, OwnClaim } from "@/lib/api/types";

type Dict = {
  signInNeeded: string; signIn: string; verifyNeeded: string; verifyLink: string; placeLabel: string; emailLabel: string; emailHelp: string;
  roleLabel: string; roles: Record<string, string>; websiteLabel: string; noteLabel: string; documentTypeLabel: string; documentTypes: Record<string, string>;
  fileLabel: string; fileHelp: string; privacy: string; next: string; submit: string; submitting: string; doneHeading: string; doneText: string; toDashboard: string;
  emailStep: { heading: string; help: string; codeLabel: string; confirm: string; confirming: string; resend: string; resent: string };
  errors: Record<string, string>;
};

type Account = "loading" | "signedOut" | "needsPhone" | "ready";
type Step = "details" | "email" | "document" | "done";

const input = "min-h-11 w-full rounded-xl border border-border bg-background px-3";

/**
 * Claim a place in three steps: your details, a code we email to the company address, then a document. Needs an account with a verified phone (checked first, so nobody
 * fills the form for nothing). The document goes to private storage, is read by one moderator and is deleted after the decision. Owning a page never changes a score.
 */
export function ClaimForm({ lang, place, dict }: { lang: Locale; place: { id: string; name: string }; dict: Dict }) {
  const [account, setAccount] = useState<Account>("loading");
  const [step, setStep] = useState<Step>("details");
  const [claimId, setClaimId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("owner");
  const [website, setWebsite] = useState("");
  const [note, setNote] = useState("");
  const [code, setCode] = useState("");
  const [docType, setDocType] = useState("commercial_register");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const me = await unwrap<Me>(api.GET("/api/me"));
      if (cancelled) return;
      setAccount(!me.ok ? "signedOut" : me.data.phoneVerified ? "ready" : "needsPhone");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fail = (c: string) => setError(dict.errors[c] ?? dict.errors.unknown);
  const next = encodeURIComponent(`/${lang}/business/claim?place=${place.id}`);

  async function createClaim(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const created = await unwrap<OwnClaim>(api.POST("/api/entities/{entityId}/claims", { params: { path: { entityId: place.id } }, body: { companyEmail: email.trim(), role, website: website.trim() || null, note: note.trim() || null } }));
    setBusy(false);
    if (!created.ok) return fail(created.error);
    setClaimId(created.data.id);
    setStep("email");
  }

  async function confirmEmail(event: React.FormEvent) {
    event.preventDefault();
    if (!claimId) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const result = await unwrap<OwnClaim>(api.POST("/api/me/claims/{id}/email/confirm", { params: { path: { id: claimId } }, body: { code: code.trim() } }));
    setBusy(false);
    if (result.ok) setStep("document");
    else fail(result.error);
  }

  async function resend() {
    if (!claimId) return;
    setBusy(true);
    setError(null);
    const result = await unwrap<OwnClaim>(api.POST("/api/me/claims/{id}/email/resend", { params: { path: { id: claimId } } }));
    setBusy(false);
    if (result.ok) setInfo(dict.emailStep.resent);
    else fail(result.error);
  }

  async function sendDocument(event: React.FormEvent) {
    event.preventDefault();
    if (!claimId || !file) return;
    setBusy(true);
    setError(null);
    // The file is not part of the JSON schema (raw bytes), so it is sent with fetch.
    let status = 0;
    let errorCode = "unknown";
    try {
      const response = await fetch(`/api/me/claims/${claimId}/document?type=${encodeURIComponent(docType)}`, { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/octet-stream" }, body: file });
      status = response.status;
      if (!response.ok) errorCode = ((await response.json().catch(() => null)) as { error?: string } | null)?.error ?? "unknown";
    } catch {
      errorCode = "network";
    }
    setBusy(false);
    if (status === 200) setStep("done");
    else fail(errorCode);
  }

  if (account === "loading") return <p className="text-muted">…</p>;

  if (account === "signedOut")
    return (
      <Card className="space-y-4">
        <p>{dict.signInNeeded}</p>
        <Link href={`/${lang}/business/sign-in?next=${next}`} className={buttonClass("primary")}>
          {dict.signIn}
        </Link>
      </Card>
    );

  if (account === "needsPhone")
    return (
      <Card className="space-y-4" data-testid="claim-needs-phone">
        <p>{dict.verifyNeeded}</p>
        <Link href={`/${lang}/me/verify`} className={buttonClass("primary")}>
          {dict.verifyLink}
        </Link>
      </Card>
    );

  if (step === "done")
    return (
      <Card className="space-y-4" data-testid="claim-done">
        <h2 role="status" className="font-heading text-xl font-semibold">
          {dict.doneHeading}
        </h2>
        <p className="leading-7 text-muted">{dict.doneText}</p>
        <Link href={`/${lang}/business/dashboard`} className={buttonClass("primary")}>
          {dict.toDashboard}
        </Link>
      </Card>
    );

  const placeCard = (
    <Card className="space-y-1">
      <p className="text-sm text-muted">{dict.placeLabel}</p>
      <p className="font-heading text-lg font-semibold" dir="auto">
        {place.name}
      </p>
    </Card>
  );
  const errorLine = error ? (
    <p role="alert" className="text-sm text-negative">
      {error}
    </p>
  ) : null;

  if (step === "email")
    return (
      <form onSubmit={confirmEmail} className="space-y-5" noValidate data-testid="claim-email-step">
        {placeCard}
        <h2 className="font-heading text-xl font-semibold">{dict.emailStep.heading}</h2>
        <p className="text-muted">{fmt(dict.emailStep.help, { email })}</p>
        <div className="space-y-1">
          <label htmlFor="claim-code" className="font-medium">
            {dict.emailStep.codeLabel}
          </label>
          <input id="claim-code" inputMode="numeric" autoComplete="one-time-code" dir="ltr" maxLength={8} value={code} onChange={(e) => setCode(e.target.value)} className={input} />
        </div>
        {info ? <p role="status" className="text-sm text-muted">{info}</p> : null}
        {errorLine}
        <Button type="submit" variant="primary" className="w-full" disabled={busy || code.replace(/\D/g, "").length !== 6}>
          {busy ? dict.emailStep.confirming : dict.emailStep.confirm}
        </Button>
        <Button type="button" variant="ghost" className="w-full" disabled={busy} onClick={() => void resend()}>
          {dict.emailStep.resend}
        </Button>
      </form>
    );

  if (step === "document")
    return (
      <form onSubmit={sendDocument} className="space-y-5" noValidate data-testid="claim-document-step">
        {placeCard}
        <div className="space-y-1">
          <label htmlFor="claim-doc-type" className="font-medium">
            {dict.documentTypeLabel}
          </label>
          <select id="claim-doc-type" value={docType} onChange={(e) => setDocType(e.target.value)} className={input}>
            {Object.entries(dict.documentTypes).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="claim-file" className="font-medium">
            {dict.fileLabel}
          </label>
          <input id="claim-file" type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm" aria-describedby="claim-file-help" />
          <p id="claim-file-help" className="text-sm text-muted">
            {dict.fileHelp}
          </p>
        </div>
        <p className="text-sm text-muted">{dict.privacy}</p>
        {errorLine}
        <Button type="submit" variant="primary" className="w-full" disabled={busy || !file}>
          {busy ? dict.submitting : dict.submit}
        </Button>
      </form>
    );

  return (
    <form onSubmit={createClaim} className="space-y-5" noValidate>
      {placeCard}
      <div className="space-y-1">
        <label htmlFor="claim-email" className="font-medium">
          {dict.emailLabel}
        </label>
        <input id="claim-email" type="email" inputMode="email" autoComplete="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} className={input} aria-describedby="claim-email-help" />
        <p id="claim-email-help" className="text-sm text-muted">
          {dict.emailHelp}
        </p>
      </div>
      <div className="space-y-1">
        <label htmlFor="claim-role" className="font-medium">
          {dict.roleLabel}
        </label>
        <select id="claim-role" value={role} onChange={(e) => setRole(e.target.value)} className={input}>
          {Object.entries(dict.roles).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor="claim-website" className="font-medium">
          {dict.websiteLabel}
        </label>
        <input id="claim-website" type="url" inputMode="url" dir="ltr" value={website} onChange={(e) => setWebsite(e.target.value)} className={input} />
      </div>
      <div className="space-y-1">
        <label htmlFor="claim-note" className="font-medium">
          {dict.noteLabel}
        </label>
        <textarea id="claim-note" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} className={`${input} py-2`} />
      </div>
      {errorLine}
      <Button type="submit" variant="primary" className="w-full" disabled={busy || email.trim().length < 5}>
        {busy ? dict.submitting : dict.next}
      </Button>
    </form>
  );
}
