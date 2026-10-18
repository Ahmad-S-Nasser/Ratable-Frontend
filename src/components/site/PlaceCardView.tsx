import Link from "next/link";
import { ScoreTile } from "@/components/ui/ScoreTile";
import { Stars } from "@/components/ui/Stars";
import { VerdictSticker, isVerdictKind } from "@/components/ui/VerdictSticker";
import type { Locale } from "@/i18n/config";
import { fmt, formatNumber, formatScore } from "@/i18n/format";
import type { PlaceCard } from "@/lib/api/types";
import { entityPath } from "@/lib/urls";
import { pick } from "@/lib/pick";

export type CardLabels = {
  reviewsCount: string;
  unrated: string;
  outOf: string;
  price: string;
  distance: string;
  verdicts: Record<string, string>;
  criteria: Record<string, string>;
};

/**
 * One place in a list. The score and the count come from verified reviews only; a place without a score says so. The verdict sticker sits next to the
 * score. The tags are the criteria verified reviewers rate highest (computed from their scores, never typed by a business). A distance appears only when
 * the visitor chose to share their location.
 */
export function PlaceCardView({ place, lang, categoryId, labels, distanceMeters }: { place: PlaceCard; lang: Locale; categoryId: string; labels: CardLabels; distanceMeters?: number | null }) {
  const name = pick(place.name, lang);
  const distance = distanceMeters ?? place.distanceMeters;
  const verdict = place.verdict && isVerdictKind(place.verdict.kind) ? place.verdict : null;
  return (
    <article className="rounded-card border border-border bg-surface p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="font-heading text-lg font-semibold">
            <Link href={entityPath(lang, categoryId, place)} className="hover:underline">
              {name}
            </Link>
          </h3>
          <p className="text-sm text-muted">
            {[place.city, place.priceBand ? fmt(labels.price, { band: place.priceBand }) : null, distance != null ? fmt(labels.distance, { km: formatNumber(lang, distance / 1000, distance < 10_000 ? 1 : 0) }) : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {place.overall !== null ? <ScoreTile text={formatScore(lang, place.overall)} label={`${formatScore(lang, place.overall)} ${labels.outOf}`} /> : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        {place.overall !== null ? (
          <>
            <Stars value={place.overall} label={`${formatScore(lang, place.overall)} ${labels.outOf}`} />
            <span className="text-muted">{fmt(labels.reviewsCount, { count: formatNumber(lang, place.verifiedReviews) })}</span>
          </>
        ) : (
          <span className="text-muted">{labels.unrated}</span>
        )}
        {verdict ? <VerdictSticker verdict={verdict.kind as "worth"} label={labels.verdicts[verdict.kind]} /> : null}
      </div>
      {place.topCriteria && place.topCriteria.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {place.topCriteria.map((c) => (
            <li key={c} className="rounded-full bg-tint px-3 py-1 text-xs font-medium text-verified">
              {labels.criteria[c] ?? c}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
