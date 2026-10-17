import { Stars } from "@/components/ui/Stars";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import type { Locale } from "@/i18n/config";
import { fmt, formatDate, formatScore } from "@/i18n/format";
import type { PublicReview } from "@/lib/api/types";

type Labels = { verified: string; unverifiedNote: string; anonymousName: string; edited: string; outOf: string };

/**
 * One public review. The author is whatever the API sent (null for anonymous reviews): this component never has an id to show,
 * and an anonymous review gets the same neutral avatar and name for everyone (rule 1).
 */
export function ReviewCardView({ review, lang, labels }: { review: PublicReview; lang: Locale; labels: Labels }) {
  const name = review.anonymous || !review.author ? labels.anonymousName : review.author.name;
  const initial = review.anonymous || !review.author ? "?" : Array.from(review.author.name)[0];
  return (
    <article className="space-y-3 rounded-card border border-border bg-surface p-5">
      <header className="flex items-center gap-3">
        <span aria-hidden="true" className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 font-semibold text-muted">
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{name}</p>
          <p className="text-xs text-muted">
            <time dateTime={review.createdAt}>{formatDate(lang, review.createdAt)}</time>
            {review.editedOn ? <> · {fmt(labels.edited, { date: formatDate(lang, review.editedOn) })}</> : null}
          </p>
        </div>
        {review.verified ? <VerifiedBadge label={labels.verified} /> : <span className="text-xs text-muted">{labels.unverifiedNote}</span>}
      </header>
      {review.overall !== null ? (
        <div className="flex items-center gap-2 text-sm">
          <Stars value={review.overall} label={`${formatScore(lang, review.overall)} ${labels.outOf}`} />
          <span className="font-semibold">{formatScore(lang, review.overall)}</span>
        </div>
      ) : null}
      {review.text ? (
        <p lang={review.language} dir="auto" className="whitespace-pre-line leading-7">
          {review.text}
        </p>
      ) : null}
    </article>
  );
}
