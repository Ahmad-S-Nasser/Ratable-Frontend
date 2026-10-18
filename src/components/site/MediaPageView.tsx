"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MediaManager } from "@/components/site/MediaManager";
import { buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Locale } from "@/i18n/config";
import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/http";
import type { OwnReview } from "@/lib/api/types";

type Props = {
  lang: Locale;
  reviewId: string;
  dict: React.ComponentProps<typeof MediaManager>["dict"] & { back: string };
  texts: { loading: string; signInNeeded: string; signIn: string; notFound: string };
};

/** Add photos or video to one of your own reviews after the fact. */
export function MediaPageView({ lang, reviewId, dict, texts }: Props) {
  const [state, setState] = useState<"loading" | "signedOut" | "missing" | { anonymous: boolean }>("loading");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const me = await unwrap(api.GET("/api/me"));
      if (cancelled) return;
      if (!me.ok) return setState("signedOut");
      const mine = await unwrap<OwnReview[]>(api.GET("/api/me/reviews", { params: { query: {} } }));
      const review = mine.ok ? mine.data.find((r) => r.id === reviewId) : undefined;
      if (!cancelled) setState(review ? { anonymous: review.isAnonymous } : "missing");
    })();
    return () => {
      cancelled = true;
    };
  }, [reviewId]);

  if (state === "loading") return <p className="text-muted">{texts.loading}</p>;
  if (state === "signedOut")
    return (
      <Card className="space-y-4">
        <p>{texts.signInNeeded}</p>
        <Link href={`/${lang}/sign-in?next=${encodeURIComponent(`/${lang}/me/media/${reviewId}`)}`} className={buttonClass("primary")}>
          {texts.signIn}
        </Link>
      </Card>
    );
  if (state === "missing") return <p className="text-muted">{texts.notFound}</p>;
  return (
    <div className="space-y-4">
      <MediaManager reviewId={reviewId} anonymous={state.anonymous} dict={dict} />
      <Link href={`/${lang}/me`} className={buttonClass("ghost")}>
        {dict.back}
      </Link>
    </div>
  );
}
