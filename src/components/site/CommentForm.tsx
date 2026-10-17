"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import type { Locale } from "@/i18n/config";
import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/http";
import type { OwnComment } from "@/lib/api/types";

type Dict = {
  label: string; placeholder: string; submit: string; anonymous: string; sent: string; signIn: string; reply: string;
  errors: Record<string, string>;
};

type State = "loading" | "signedOut" | "ready" | "sending" | "sent";

/** Adds a comment (or a reply) to a review. Comments are checked before they appear, so the form only says it was received. */
export function CommentForm({ lang, reviewId, parentId, signInHref, dict }: { lang: Locale; reviewId: string; parentId?: string; signInHref: string; dict: Dict }) {
  const [state, setState] = useState<State>("loading");
  const [text, setText] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const me = await unwrap(api.GET("/api/me"));
      if (!cancelled) setState(me.ok ? "ready" : "signedOut");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    setError(null);
    setState("sending");
    const result = await unwrap<OwnComment>(
      api.POST("/api/reviews/{reviewId}/comments", {
        params: { path: { reviewId } },
        body: { text: text.trim(), parentId: parentId ?? null, isAnonymous: anonymous },
      }),
    );
    if (result.ok) {
      setText("");
      return setState("sent");
    }
    setError(dict.errors[result.error] ?? dict.errors.unknown);
    setState("ready");
  }

  if (state === "loading") return null;
  if (state === "signedOut")
    return (
      <Link href={`/${lang}/sign-in?next=${encodeURIComponent(signInHref)}`} className="text-sm font-medium text-link underline">
        {dict.signIn}
      </Link>
    );
  if (state === "sent")
    return (
      <p role="status" className="text-sm text-muted">
        {dict.sent}
      </p>
    );

  const id = `comment-${reviewId}-${parentId ?? "root"}`;
  return (
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor={id} className="text-sm font-medium">
        {parentId ? dict.reply : dict.label}
      </label>
      <textarea
        id={id}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        maxLength={1000}
        dir="auto"
        placeholder={dict.placeholder}
        className="w-full rounded-xl border border-border bg-background p-3 text-sm leading-6 placeholder:text-muted"
      />
      <Switch checked={anonymous} onChange={setAnonymous} label={dict.anonymous} />
      {error ? (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="secondary" disabled={state === "sending" || !text.trim()} className={buttonClass("secondary")}>
        {dict.submit}
      </Button>
    </form>
  );
}
