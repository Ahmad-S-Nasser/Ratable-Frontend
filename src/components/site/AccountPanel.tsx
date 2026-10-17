"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import type { Locale } from "@/i18n/config";
import { fmt, formatDate } from "@/i18n/format";
import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/http";
import type { Me, OwnReview, PublicEntity } from "@/lib/api/types";
import { entityPath } from "@/lib/urls";

type Dict = {
  loading: string; signInNeeded: string; signIn: string; profile: string; displayName: string; displayNameHelp: string; save: string; saved: string;
  phoneVerified: string; phoneNotVerified: string; signOut: string; myReviews: string; noReviews: string; statusPendingModeration: string;
  statusPublished: string; statusHidden: string; statusDeleted: string; verified: string; unverified: string; editReview: string; addProof: string;
  reason: string; errors: Record<string, string>;
};

type Row = { review: OwnReview; entity: PublicEntity | null };
type State = { phase: "loading" } | { phase: "signedOut" } | { phase: "ready"; me: Me; rows: Row[] };

const statusKey = (s: string) => `status${s}` as keyof Dict;

/** The signed-in person's account: display name, phone state, and their reviews with what each one needs next. */
export function AccountPanel({ lang, dict }: { lang: Locale; dict: Dict }) {
  const [state, setState] = useState<State>({ phase: "loading" });
  const [name, setName] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const me = await unwrap<Me>(api.GET("/api/me"));
      if (cancelled) return;
      if (!me.ok) return setState({ phase: "signedOut" });
      const mine = await unwrap<OwnReview[]>(api.GET("/api/me/reviews", { params: { query: {} } }));
      const reviews = mine.ok ? mine.data : [];
      const rows: Row[] = await Promise.all(
        reviews.map(async (review) => {
          const entity = await unwrap<PublicEntity>(api.GET("/api/entities/{id}", { params: { path: { id: review.entityId } } }));
          return { review, entity: entity.ok ? entity.data : null };
        }),
      );
      if (cancelled) return;
      setName(me.data.profile.displayName ?? "");
      setState({ phase: "ready", me: me.data, rows });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    if (state.phase !== "ready") return;
    setMessage(null);
    const result = await unwrap<Me>(api.PUT("/api/me/profile", { body: { displayName: name.trim() || null, avatarUrl: state.me.profile.avatarUrl } }));
    if (result.ok) {
      setState({ ...state, me: result.data });
      setMessage({ tone: "ok", text: dict.saved });
    } else setMessage({ tone: "error", text: dict.errors[result.error] ?? dict.errors.unknown });
  }

  async function signOut() {
    await unwrap(api.POST("/api/auth/logout"));
    window.location.reload(); // a full load: the header and this page both show the signed-out state
  }

  if (state.phase === "loading") return <p className="text-muted">{dict.loading}</p>;
  if (state.phase === "signedOut")
    return (
      <Card className="space-y-4">
        <p>{dict.signInNeeded}</p>
        <Link href={`/${lang}/sign-in?next=${encodeURIComponent(`/${lang}/me`)}`} className={buttonClass("primary")}>
          {dict.signIn}
        </Link>
      </Card>
    );

  const { me, rows } = state;
  return (
    <div className="space-y-8">
      <Card className="space-y-4">
        <h2 className="font-heading text-lg font-semibold">{dict.profile}</h2>
        <form onSubmit={saveProfile} className="space-y-3">
          <label htmlFor="display-name" className="font-medium">
            {dict.displayName}
          </label>
          <input
            id="display-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            aria-describedby="display-name-help"
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3"
          />
          <p id="display-name-help" className="text-sm text-muted">
            {dict.displayNameHelp}
          </p>
          {message ? (
            <p role={message.tone === "error" ? "alert" : "status"} className={`text-sm ${message.tone === "error" ? "text-negative" : "text-muted"}`}>
              {message.text}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="secondary">
              {dict.save}
            </Button>
            {me.phoneVerified ? <VerifiedBadge label={dict.phoneVerified} /> : <span className="text-sm text-muted">{dict.phoneNotVerified}</span>}
          </div>
        </form>
        <Button type="button" variant="ghost" onClick={() => void signOut()}>
          {dict.signOut}
        </Button>
      </Card>

      <section aria-labelledby="my-reviews" className="space-y-4">
        <h2 id="my-reviews" className="font-heading text-xl font-semibold">
          {dict.myReviews}
        </h2>
        {rows.length === 0 ? (
          <p className="text-muted">{dict.noReviews}</p>
        ) : (
          <ul className="space-y-4">
            {rows.map(({ review, entity }) => {
              const placeName = entity ? (entity.name[lang] ?? entity.name.ar ?? "") : "";
              const path = entity ? entityPath(lang, entity.categoryId, entity) : null;
              return (
                <li key={review.id}>
                  <Card className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-heading text-lg font-semibold">{path ? <Link href={path} className="hover:underline">{placeName}</Link> : review.entityId}</h3>
                      {review.verified ? <VerifiedBadge label={dict.verified} /> : <span className="text-sm text-muted">{dict.unverified}</span>}
                    </div>
                    <p className="text-sm text-muted">
                      {dict[statusKey(review.status)] as string} · {formatDate(lang, review.updatedAt)}
                    </p>
                    {review.moderationReason ? <p className="text-sm text-negative">{fmt(dict.reason, { reason: review.moderationReason })}</p> : null}
                    {review.text ? (
                      <p dir="auto" className="line-clamp-3 whitespace-pre-line leading-7">
                        {review.text}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      {path && review.status !== "Deleted" ? (
                        <Link href={`${path}/review`} className={buttonClass("secondary")}>
                          {dict.editReview}
                        </Link>
                      ) : null}
                      {!review.verified && review.status !== "Deleted" ? (
                        <Link href={`/${lang}/me/proof/${review.id}`} className={buttonClass("primary")}>
                          {dict.addProof}
                        </Link>
                      ) : null}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
