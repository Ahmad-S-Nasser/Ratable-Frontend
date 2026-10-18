"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AfterPosting } from "@/components/site/AfterPosting";
import { MediaManager } from "@/components/site/MediaManager";
import { Switch } from "@/components/ui/Switch";
import { TapRating } from "@/components/ui/TapRating";
import type { Locale } from "@/i18n/config";
import { fmt } from "@/i18n/format";
import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/http";
import type { Category, OwnReview } from "@/lib/api/types";
import { pick } from "@/lib/pick";

type Dict = {
  heading: string; editHeading: string; signInNeeded: string; signIn: string; loading: string; criteria: string; star: string;
  textLabel: string; textHint: string; textPlaceholder: string; anonymous: string; anonymousHint: string; submit: string; save: string;
  saving: string; moderationNote: string; editNote: string; doneHeading: string; doneText: string; back: string; needAnswer: string;
  errors: Record<string, string>;
  media: MediaDict;
  rewards: { afterPosting: React.ComponentProps<typeof AfterPosting>["dict"]; rankUp: { heading: string; text: string; close: string }; how: string; level: string };
  verdict: { worth: string; not_worth: string; hidden_gem: string; formLabel: string; formHint: string; none: string };
};

type MediaDict = ComponentProps<typeof MediaManager>["dict"] & { pick: string; pickHint: string; heading: string };

type Answer = number | string;
type State = "loading" | "signedOut" | "ready" | "saving" | "done";

const MAX_TEXT = 4000;

/** Write a review, or edit your own. Answers are tap or choice answers built from the category's criteria. */
export function ReviewForm({ lang, entityId, entityPath, category, dict }: { lang: Locale; entityId: string; entityPath: string; category: Category; dict: Dict }) {
  const [state, setState] = useState<State>("loading");
  const [existing, setExisting] = useState<OwnReview | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [text, setText] = useState("");
  const [anonymous, setAnonymous] = useState(category.anonymousByDefault);
  const [verdict, setVerdict] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [savedId, setSavedId] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Reads who is signed in and whether they already reviewed this place. State is set after the awaits, never synchronously.
    let cancelled = false;
    void (async () => {
      const me = await unwrap(api.GET("/api/me"));
      if (cancelled) return;
      if (!me.ok) return setState("signedOut");
      const mine = await unwrap<OwnReview[]>(api.GET("/api/me/reviews", { params: { query: { entityId } } }));
      if (cancelled) return;
      const review = mine.ok ? (mine.data[0] ?? null) : null;
      if (review) {
        setExisting(review);
        setAnswers(Object.fromEntries(review.answers.map((a) => [a.criterionId, a.optionValue ?? a.score])));
        setText(review.text ?? "");
        setAnonymous(review.isAnonymous);
        setVerdict(review.verdict ?? "");
      }
      setState("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [entityId]);

  const errorText = (code: string) => dict.errors[code] ?? dict.errors.unknown;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (Object.keys(answers).length === 0) return setError(dict.needAnswer);
    setError(null);
    setState("saving");
    const body = {
      answers: Object.entries(answers).map(([criterionId, value]) => ({ criterionId, value })),
      text: text.trim() || null,
      language: null,
      isAnonymous: anonymous,
      verdict: category.verdictEnabled && verdict ? verdict : null,
    };
    const result = existing
      ? await unwrap<OwnReview>(api.PUT("/api/reviews/{id}", { params: { path: { id: existing.id } }, body }))
      : await unwrap<OwnReview>(api.POST("/api/entities/{entityId}/reviews", { params: { path: { entityId } }, body }));
    if (result.ok) {
      setSavedId(result.data.id);
      return setState("done");
    }
    setError(errorText(result.error));
    setState("ready");
  }

  if (state === "loading") return <p className="text-muted">{dict.loading}</p>;

  if (state === "signedOut")
    return (
      <Card className="space-y-4">
        <p>{dict.signInNeeded}</p>
        <Link href={`/${lang}/sign-in?next=${encodeURIComponent(`${entityPath}/review`)}`} className={buttonClass("primary")}>
          {dict.signIn}
        </Link>
      </Card>
    );

  if (state === "done" && savedId)
    return (
      <div className="space-y-6">
        <Card className="space-y-3">
          <h2 role="status" className="font-heading text-xl font-semibold">
            {dict.doneHeading}
          </h2>
          <p className="text-muted">{dict.doneText}</p>
          <Link href={entityPath} className={buttonClass("secondary")}>
            {dict.back}
          </Link>
        </Card>
        <AfterPosting
          lang={lang}
          hasText={text.trim().length >= 20}
          photos={files.filter((f) => !f.type.startsWith("video/")).length}
          videos={files.filter((f) => f.type.startsWith("video/")).length}
          dict={dict.rewards.afterPosting}
          rankUp={dict.rewards.rankUp}
          how={dict.rewards.how}
          level={dict.rewards.level}
        />
        <section aria-labelledby="media-heading" className="space-y-3">
          <h2 id="media-heading" className="font-heading text-lg font-semibold">
            {dict.media.heading}
          </h2>
          <MediaManager reviewId={savedId} anonymous={anonymous} initialFiles={files} dict={dict.media} />
        </section>
      </div>
    );

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <Card className="space-y-6">
        <h2 className="font-heading text-lg font-semibold">{dict.criteria}</h2>
        {category.criteria.map((c) => {
          const label = pick(c.label, lang, c.id);
          if (c.answerType === "Rating5") {
            return (
              <TapRating
                key={c.id}
                legend={label}
                value={typeof answers[c.id] === "number" ? (answers[c.id] as number) : null}
                onChange={(n) => setAnswers((a) => ({ ...a, [c.id]: n }))}
                starLabel={(n) => fmt(dict.star, { n })}
              />
            );
          }
          return (
            <fieldset key={c.id} className="space-y-2">
              <legend className="font-medium">{label}</legend>
              <div className="flex flex-wrap gap-2">
                {c.options.map((o) => (
                  <label key={o.value} className="cursor-pointer">
                    <input
                      type="radio"
                      name={`criterion-${c.id}`}
                      value={o.value}
                      checked={answers[c.id] === o.value}
                      onChange={() => setAnswers((a) => ({ ...a, [c.id]: o.value }))}
                      className="peer sr-only"
                    />
                    <span className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-sm font-medium peer-checked:border-verified peer-checked:bg-tint peer-checked:text-verified peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-verified">
                      {pick(o.label, lang, o.value)}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}
      </Card>

      <Card className="space-y-2">
        <label htmlFor="review-text" className="font-heading text-lg font-semibold">
          {dict.textLabel}
        </label>
        <p id="review-text-hint" className="text-sm text-muted">
          {dict.textHint}
        </p>
        <textarea
          id="review-text"
          aria-describedby="review-text-hint"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX_TEXT}
          rows={5}
          dir="auto"
          placeholder={dict.textPlaceholder}
          className="w-full rounded-xl border border-border bg-background p-3 leading-7 placeholder:text-muted"
        />
      </Card>

      {category.verdictEnabled ? (
        <Card>
          <fieldset className="space-y-2">
            <legend className="font-heading text-lg font-semibold">{dict.verdict.formLabel}</legend>
            <p className="text-sm text-muted">{dict.verdict.formHint}</p>
            <div className="flex flex-wrap gap-2">
              {(["", "worth", "not_worth", "hidden_gem"] as const).map((v) => (
                <label key={v || "none"} className="cursor-pointer">
                  <input type="radio" name="verdict" value={v} checked={verdict === v} onChange={() => setVerdict(v)} className="peer sr-only" />
                  <span className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-sm font-medium peer-checked:border-verified peer-checked:bg-tint peer-checked:text-verified peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-verified">
                    {v === "" ? dict.verdict.none : dict.verdict[v]}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </Card>
      ) : null}

      <Card className="space-y-2">
        <h2 className="font-heading text-lg font-semibold">{dict.media.heading}</h2>
        <p className="text-sm text-muted">{dict.media.pickHint}</p>
        <input
          ref={picker}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          aria-label={dict.media.pick}
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []); // copied first: clearing the input empties its list
            setFiles((all) => [...all, ...picked]);
            e.target.value = "";
          }}
        />
        <Button type="button" variant="secondary" onClick={() => picker.current?.click()}>
          {dict.media.pick}
        </Button>
        {files.length > 0 ? (
          <ul className="text-sm text-muted">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`}>{f.type.startsWith("video/") ? "▶ " : "▣ "}{f.name}</li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card>
        <Switch checked={anonymous} onChange={setAnonymous} label={dict.anonymous} hint={dict.anonymousHint} />
      </Card>

      {error ? (
        <p role="alert" className="rounded-xl bg-negative-bg p-3 text-sm text-negative">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="primary" disabled={state === "saving"} className="w-full">
        {state === "saving" ? dict.saving : existing ? dict.save : dict.submit}
      </Button>
      <p className="text-center text-sm text-muted">{existing ? dict.editNote : dict.moderationNote}</p>
    </form>
  );
}
