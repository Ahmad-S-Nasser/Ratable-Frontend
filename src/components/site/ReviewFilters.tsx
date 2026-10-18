import Link from "next/link";

export type ReviewFilter = { sort: "newest" | "highest" | "lowest"; verified: boolean; media: "all" | "video" | "photos" };

type Labels = {
  filterLabel: string; all: string; verifiedOnly: string; sortLabel: string; newest: string; highest: string; lowest: string;
  withVideo: string; withPhotos: string; mediaLabel: string;
};

const href = (base: string, f: ReviewFilter) => {
  const q = new URLSearchParams();
  if (f.verified) q.set("verified", "1");
  if (f.sort !== "newest") q.set("sort", f.sort);
  if (f.media !== "all") q.set("media", f.media);
  const s = q.toString();
  return s ? `${base}?${s}#reviews` : `${base}#reviews`;
};

const pill = (active: boolean) =>
  `inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium ${
    active ? "border-verified bg-tint text-verified" : "border-border bg-surface hover:bg-surface-2"
  }`;

/** Plain links, so filtering works without JavaScript. Filtered lists canonicalise to the base page (the page's canonical never has the query). */
export function ReviewFilters({ base, current, labels }: { base: string; current: ReviewFilter; labels: Labels }) {
  const sorts: ReviewFilter["sort"][] = ["newest", "highest", "lowest"];
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2">
      <nav aria-label={labels.filterLabel} className="flex flex-wrap gap-2">
        <Link href={href(base, { ...current, verified: false })} aria-current={!current.verified ? "true" : undefined} className={pill(!current.verified)} scroll={false}>
          {labels.all}
        </Link>
        <Link href={href(base, { ...current, verified: true })} aria-current={current.verified ? "true" : undefined} className={pill(current.verified)} scroll={false}>
          {labels.verifiedOnly}
        </Link>
      </nav>
      <nav aria-label={labels.mediaLabel} className="flex flex-wrap gap-2">
        {(["video", "photos"] as const).map((m) => (
          <Link key={m} href={href(base, { ...current, media: current.media === m ? "all" : m })} aria-current={current.media === m ? "true" : undefined} className={pill(current.media === m)} scroll={false}>
            {m === "video" ? labels.withVideo : labels.withPhotos}
          </Link>
        ))}
      </nav>
      <nav aria-label={labels.sortLabel} className="flex flex-wrap gap-2">
        {sorts.map((s) => (
          <Link key={s} href={href(base, { ...current, sort: s })} aria-current={current.sort === s ? "true" : undefined} className={pill(current.sort === s)} scroll={false}>
            {labels[s]}
          </Link>
        ))}
      </nav>
    </div>
  );
}
