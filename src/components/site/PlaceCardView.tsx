import Link from "next/link";
import { ScoreTile } from "@/components/ui/ScoreTile";
import { Stars } from "@/components/ui/Stars";
import type { Locale } from "@/i18n/config";
import { fmt, formatNumber, formatScore } from "@/i18n/format";
import type { PlaceCard } from "@/lib/api/types";
import { entityPath } from "@/lib/urls";

type Labels = { reviewsCount: string; unrated: string; outOf: string };

/** One place in a list. The score and the count come from verified reviews only; a place without a score says so. */
export function PlaceCardView({ place, lang, categoryId, labels }: { place: PlaceCard; lang: Locale; categoryId: string; labels: Labels }) {
  const name = place.name[lang] ?? place.name.ar ?? place.name.en ?? "";
  return (
    <article className="rounded-card border border-border bg-surface p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="font-heading text-lg font-semibold">
            <Link href={entityPath(lang, categoryId, place)} className="hover:underline">
              {name}
            </Link>
          </h3>
          {place.city ? <p className="text-sm text-muted">{place.city}</p> : null}
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
      </div>
    </article>
  );
}
