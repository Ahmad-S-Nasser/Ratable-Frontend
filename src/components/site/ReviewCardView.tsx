import { ShieldCheckIcon } from "@/components/ui/Icons";
import { Stars } from "@/components/ui/Stars";
import { VideoPlayer } from "@/components/site/VideoPlayer";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import type { Locale } from "@/i18n/config";
import { fmt, formatDate, formatScore } from "@/i18n/format";
import type { PublicReview } from "@/lib/api/types";
import { pick } from "@/lib/pick";

type MediaLabels = { play: string; pause: string; mute: string; unmute: string; videoLabel: string; captions: string };
type Labels = { verified: string; unverifiedNote: string; anonymousName: string; edited: string; outOf: string; accountVerified: string };

/**
 * One public review. The author is whatever the API sent (null for anonymous reviews): this component never has an id to show,
 * and an anonymous review gets the same neutral avatar and name for everyone (rule 1).
 */
export function ReviewCardView({ review, lang, labels, media }: { review: PublicReview; lang: Locale; labels: Labels; media: MediaLabels }) {
  const videos = review.media.filter((m) => m.kind === "Video" && m.playlistUrl);
  const photos = review.media.filter((m) => m.kind === "Photo" && m.imageUrl);
  const name = review.anonymous || !review.author ? labels.anonymousName : review.author.name;
  const initial = review.anonymous || !review.author ? "?" : Array.from(review.author.name)[0];
  return (
    <article id={`r-${review.id}`} className="space-y-3 rounded-card border border-border bg-surface p-5">
      <header className="flex items-center gap-3">
        <span aria-hidden="true" className={`inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 font-semibold text-muted ${review.verified ? "ring-2 ring-verified ring-offset-2 ring-offset-surface" : ""}`}>
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate font-semibold">
            <span className="truncate">{name}</span>
            {review.author?.accountVerified && !review.anonymous ? (
              <span title={labels.accountVerified} role="img" aria-label={labels.accountVerified} data-testid="account-verified" className="inline-flex shrink-0 text-verified">
                <ShieldCheckIcon width={16} height={16} />
              </span>
            ) : null}
          </p>
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
      {videos.map((v) => (
        <div key={v.id} className="max-w-xs space-y-2">
          <VideoPlayer
            playlistUrl={v.playlistUrl as string}
            posterUrl={v.posterUrl}
            width={v.width}
            height={v.height}
            labels={{ play: media.play, pause: media.pause, mute: media.mute, unmute: media.unmute, label: fmt(media.videoLabel, { duration: Math.round(v.durationSeconds ?? 0) }) }}
          />
          {pick(v.captions, lang) ? (
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-link">{media.captions}</summary>
              <p lang={lang} dir="auto" className="mt-1 leading-6 text-muted">
                {pick(v.captions, lang)}
              </p>
            </details>
          ) : null}
        </div>
      ))}
      {photos.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {photos.map((p) => (
            <li key={p.id}>
              {/* eslint-disable-next-line @next/next/no-img-element -- streamed from the API, which sets the cache headers */}
              <img src={p.imageUrl as string} alt="" width={96} height={96} loading="lazy" decoding="async" className="size-24 rounded-xl border border-border object-cover" />
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
