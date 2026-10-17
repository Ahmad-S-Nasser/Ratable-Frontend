"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Locale } from "@/i18n/config";
import { fmt, formatDate } from "@/i18n/format";
import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/http";
import type { Category, OwnProof, OwnReview, PublicEntity } from "@/lib/api/types";

type Dict = {
  forPlace: string; type: string; types: Record<string, string>; file: string; declaration: string; retention: string; retentionDelete: string;
  retentionKeep: string; keepConsent: string; submit: string; uploading: string; received: string; receivedText: string; yourProofs: string; none: string;
  status: Record<string, string>; fileStored: string; fileKept: string; deleteFile: string; fileDeleted: string; back: string; notFound: string;
  errors: Record<string, string>; signInNeeded: string; signIn: string; loading: string;
};

type Loaded = { review: OwnReview; entity: PublicEntity; category: Category };
type State = { phase: "loading" } | { phase: "signedOut" } | { phase: "missing" } | { phase: "ready"; data: Loaded };

const field = "min-h-11 w-full rounded-xl border border-border bg-background px-3";

/** Upload a proof of a visit or purchase for one of your own reviews, and choose what happens to the file after the decision. */
export function ProofForm({ lang, reviewId, dict }: { lang: Locale; reviewId: string; dict: Dict }) {
  const [state, setState] = useState<State>({ phase: "loading" });
  const [proofs, setProofs] = useState<OwnProof[]>([]);
  const [proofType, setProofType] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [declaration, setDeclaration] = useState(false);
  const [keep, setKeep] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadProofs = useCallback(async () => {
    const mine = await unwrap<OwnProof[]>(api.GET("/api/me/proofs", { params: { query: { reviewId } } }));
    setProofs(mine.ok ? mine.data : []);
  }, [reviewId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const me = await unwrap(api.GET("/api/me"));
      if (cancelled) return;
      if (!me.ok) return setState({ phase: "signedOut" });
      const mine = await unwrap<OwnReview[]>(api.GET("/api/me/reviews", { params: { query: {} } }));
      const review = mine.ok ? mine.data.find((r) => r.id === reviewId) : undefined;
      const entity = review ? await unwrap<PublicEntity>(api.GET("/api/entities/{id}", { params: { path: { id: review.entityId } } })) : null;
      const category = entity?.ok ? await unwrap<Category>(api.GET("/api/categories/{id}", { params: { path: { id: entity.data.categoryId } } })) : null;
      const list = await unwrap<OwnProof[]>(api.GET("/api/me/proofs", { params: { query: { reviewId } } }));
      if (cancelled) return;
      if (!review || !entity?.ok || !category?.ok) return setState({ phase: "missing" });
      setProofs(list.ok ? list.data : []);
      setProofType(category.data.acceptedProofTypes[0] ?? "");
      setState({ phase: "ready", data: { review, entity: entity.data, category: category.data } });
    })();
    return () => {
      cancelled = true;
    };
  }, [reviewId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    // The upload is a multipart form, which the typed client does not describe, so it is sent directly to the same origin.
    const form = new FormData();
    form.set("file", file);
    form.set("proofType", proofType);
    form.set("declaration", String(declaration));
    form.set("retention", keep ? "keep" : "delete");
    form.set("keepConsent", String(keep && consent));
    let code = "network";
    let ok = false;
    try {
      const response = await fetch(`/api/reviews/${encodeURIComponent(reviewId)}/proof`, { method: "POST", body: form, credentials: "same-origin" });
      ok = response.ok;
      if (!ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        code = body?.error ?? "unknown";
      }
    } catch {
      /* network */
    }
    setBusy(false);
    if (ok) {
      setNotice(dict.received);
      setFile(null);
      await loadProofs();
    } else setError(dict.errors[code] ?? dict.errors.unknown);
  }

  async function deleteFile(id: string) {
    setError(null);
    const result = await unwrap(api.DELETE("/api/me/proofs/{id}/file", { params: { path: { id } } }));
    if (result.ok) {
      setNotice(dict.fileDeleted);
      await loadProofs();
    } else setError(dict.errors[result.error] ?? dict.errors.unknown);
  }

  if (state.phase === "loading") return <p className="text-muted">{dict.loading}</p>;
  if (state.phase === "signedOut")
    return (
      <Card className="space-y-4">
        <p>{dict.signInNeeded}</p>
        <Link href={`/${lang}/sign-in?next=${encodeURIComponent(`/${lang}/me/proof/${reviewId}`)}`} className={buttonClass("primary")}>
          {dict.signIn}
        </Link>
      </Card>
    );
  if (state.phase === "missing")
    return (
      <Card className="space-y-4">
        <p>{dict.notFound}</p>
        <Link href={`/${lang}/me`} className={buttonClass("secondary")}>
          {dict.back}
        </Link>
      </Card>
    );

  const { entity, category, review } = state.data;
  const placeName = entity.name[lang] ?? entity.name.ar ?? "";
  const canUpload = !review.verified && !proofs.some((p) => p.status === "UnderReview");

  return (
    <div className="space-y-6">
      <p className="text-muted">{fmt(dict.forPlace, { name: placeName })}</p>

      {canUpload ? (
        <form onSubmit={submit} className="space-y-5" noValidate>
          <Card className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="proof-type" className="font-medium">
                {dict.type}
              </label>
              <select id="proof-type" value={proofType} onChange={(e) => setProofType(e.target.value)} className={field}>
                {category.acceptedProofTypes.map((t) => (
                  <option key={t} value={t}>
                    {dict.types[t] ?? t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="proof-file" className="font-medium">
                {dict.file}
              </label>
              <input id="proof-file" type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className={field} />
            </div>
            <label className="flex items-start gap-3">
              <input type="checkbox" checked={declaration} onChange={(e) => setDeclaration(e.target.checked)} className="mt-1 size-5 accent-[var(--verified)]" />
              <span>{dict.declaration}</span>
            </label>
          </Card>

          <Card>
            <fieldset className="space-y-3">
              <legend className="font-heading text-lg font-semibold">{dict.retention}</legend>
              <label className="flex items-start gap-3">
                <input type="radio" name="retention" checked={!keep} onChange={() => setKeep(false)} className="mt-1 size-5 accent-[var(--verified)]" />
                <span>{dict.retentionDelete}</span>
              </label>
              <label className="flex items-start gap-3">
                <input type="radio" name="retention" checked={keep} onChange={() => setKeep(true)} className="mt-1 size-5 accent-[var(--verified)]" />
                <span>{dict.retentionKeep}</span>
              </label>
              {keep ? (
                <label className="flex items-start gap-3 ps-8">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-5 accent-[var(--verified)]" />
                  <span className="text-sm text-muted">{dict.keepConsent}</span>
                </label>
              ) : null}
            </fieldset>
          </Card>

          <Button type="submit" variant="primary" disabled={busy || !file || !declaration || (keep && !consent)} className="w-full">
            {busy ? dict.uploading : dict.submit}
          </Button>
        </form>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-xl bg-negative-bg p-3 text-sm text-negative">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="rounded-xl bg-tint p-3 text-sm">
          {notice}
          {notice === dict.received ? ` ${dict.receivedText}` : ""}
        </p>
      ) : null}

      <section aria-labelledby="your-proofs" className="space-y-3">
        <h2 id="your-proofs" className="font-heading text-lg font-semibold">
          {dict.yourProofs}
        </h2>
        {proofs.length === 0 ? (
          <p className="text-muted">{dict.none}</p>
        ) : (
          <ul className="space-y-3">
            {proofs.map((p) => (
              <li key={p.id}>
                <Card className="space-y-2">
                  <p className="font-medium">
                    {dict.types[p.proofType] ?? p.proofType} · {dict.status[p.status] ?? p.status}
                  </p>
                  <p className="text-sm text-muted">{formatDate(lang, p.createdAt)}</p>
                  {p.rejectionReason ? <p className="text-sm text-negative">{p.rejectionReason}</p> : null}
                  {p.fileStored ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-sm text-muted">{p.fileExpiresAt ? fmt(dict.fileStored, { date: formatDate(lang, p.fileExpiresAt) }) : dict.fileKept}</span>
                      {p.status !== "UnderReview" ? (
                        <Button type="button" variant="secondary" onClick={() => void deleteFile(p.id)}>
                          {dict.deleteFile}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Link href={`/${lang}/me`} className={buttonClass("ghost")}>
        {dict.back}
      </Link>
    </div>
  );
}
