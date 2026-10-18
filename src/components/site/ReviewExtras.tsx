import type { Locale } from "@/i18n/config";
import { fmt, formatDate, formatScore } from "@/i18n/format";
import { getComments, getHistory } from "@/lib/api/server";
import type { PublicComment, PublicReview } from "@/lib/api/types";
import { CommentForm } from "./CommentForm";

type HistoryLabels = { historyShow: string; historyVersion: string; historyReplaced: string };
type CommentLabels = {
  count: string; heading: string; none: string; label: string; placeholder: string; submit: string; anonymous: string; sent: string; signIn: string; reply: string;
  errors: Record<string, string>;
};

/** The earlier public versions of an edited review, dated. Versions that were never public are not listed. */
export async function ReviewHistory({ review, lang, labels, outOf }: { review: PublicReview; lang: Locale; labels: HistoryLabels; outOf: string }) {
  if (review.revisionNumber <= 1) return null;
  const history = await getHistory(review.id);
  if (!history.ok || history.data.earlierVersions.length === 0) return null;
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-medium text-link">{labels.historyShow}</summary>
      <ol className="mt-2 space-y-3 border-s border-border ps-4">
        {history.data.earlierVersions.map((v) => (
          <li key={v.revisionNumber} className="space-y-1">
            <p className="text-xs text-muted">
              {fmt(labels.historyVersion, { n: v.revisionNumber })} · {fmt(labels.historyReplaced, { date: formatDate(lang, v.replacedAt) })}
              {v.overall !== null ? ` · ${formatScore(lang, v.overall)} ${outOf}` : ""}
            </p>
            {v.text ? (
              <p lang={v.language} dir="auto" className="whitespace-pre-line leading-6">
                {v.text}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </details>
  );
}

function CommentView({ comment, lang, anonymousName }: { comment: PublicComment; lang: Locale; anonymousName: string }) {
  const name = comment.anonymous || !comment.author ? anonymousName : comment.author.name;
  return (
    <li className="space-y-1">
      <p className="text-sm">
        <span className="font-semibold">{name}</span> <time className="text-xs text-muted" dateTime={comment.createdAt}>{formatDate(lang, comment.createdAt)}</time>
      </p>
      <p dir="auto" className="whitespace-pre-line text-sm leading-6">
        {comment.text}
      </p>
      {comment.replies.length > 0 ? (
        <ul className="mt-2 space-y-2 border-s border-border ps-4">
          {comment.replies.map((r) => (
            <CommentView key={r.id} comment={r} lang={lang} anonymousName={anonymousName} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** Published comments on a review (names come from the API, so an anonymous commenter is never shown), and the form to add one. */
export async function ReviewComments({
  review, lang, labels, anonymousName, returnPath,
}: { review: PublicReview; lang: Locale; labels: CommentLabels; anonymousName: string; returnPath: string }) {
  const comments = await getComments(review.id);
  const list = comments.ok ? comments.data : [];
  const count = list.reduce((n, c) => n + 1 + c.replies.length, 0);
  return (
    <section aria-label={labels.heading} className="space-y-3 border-t border-border pt-3">
      <p className="text-sm font-medium text-muted" data-testid="comment-count">
        {labels.count.replace("{count}", String(count))}
      </p>
      {list.length > 0 ? (
        <ul className="space-y-3">
          {list.map((c) => (
            <CommentView key={c.id} comment={c} lang={lang} anonymousName={anonymousName} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{labels.none}</p>
      )}
      <CommentForm lang={lang} reviewId={review.id} signInHref={returnPath} dict={labels} />
    </section>
  );
}
