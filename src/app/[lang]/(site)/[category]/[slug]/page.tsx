import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { JsonLdScript } from "@/components/site/JsonLdScript";
import { HelpfulButton, HelpfulProvider } from "@/components/site/HelpfulButton";
import { EntityContactBlock } from "@/components/site/EntityContactBlock";
import { ReviewCardView } from "@/components/site/ReviewCardView";
import { ReviewComments, ReviewHistory } from "@/components/site/ReviewExtras";
import { ReviewFilters, type ReviewFilter } from "@/components/site/ReviewFilters";
import { buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ScoreTile } from "@/components/ui/ScoreTile";
import { PhotoIcon } from "@/components/ui/Icons";
import { Stars } from "@/components/ui/Stars";
import { VerdictSticker, isVerdictKind } from "@/components/ui/VerdictSticker";
import { isLocale, type Locale } from "@/i18n/config";
import { fmt, formatDate, formatNumber, formatScore } from "@/i18n/format";
import { getDictionary } from "@/i18n/get-dictionary";
import { getCategory, getEntity, getPlaces, getReviews, getScore } from "@/lib/api/server";
import type { Category, PublicEntity, ScoreResponse } from "@/lib/api/types";
import { absoluteUrl } from "@/lib/site";
import { breadcrumbJsonLd, entityJsonLd, faqJsonLd, videoJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";
import { strengthsAndWeaknesses } from "@/lib/summary";
import { entityIdFromParam, entityPath } from "@/lib/urls";
import { pick } from "@/lib/pick";

type Dict = Awaited<ReturnType<typeof getDictionary>>;

const criterionName = (category: Category, id: string, lang: Locale) => {
  const c = category.criteria.find((x) => x.id === id);
  return pick(c?.label, lang, id);
};

/** The short factual summary every entity page opens with (answer-first): score, verified count, strengths, weaknesses, date, source. */
function buildSummary(lang: Locale, dict: Dict, name: string, entity: PublicEntity, score: ScoreResponse | null, category: Category) {
  const e = dict.entity;
  const parts: string[] = [];
  if (score && score.overall !== null) {
    parts.push(fmt(e.summaryRated, { name, score: formatScore(lang, score.overall), count: formatNumber(lang, score.verifiedReviews) }));
    const { strengths, weaknesses } = strengthsAndWeaknesses(score);
    const list = (items: { id: string }[]) => items.map((i) => criterionName(category, i.id, lang)).join(lang === "ar" ? "، " : ", ");
    if (strengths.length) parts.push(fmt(e.strengths, { list: list(strengths) }));
    if (weaknesses.length) parts.push(fmt(e.weaknesses, { list: list(weaknesses) }));
    if (!strengths.length && !weaknesses.length) parts.push(e.noneYet);
  } else {
    parts.push(fmt(e.summaryUnrated, { name }));
  }
  parts.push(fmt(e.updated, { date: formatDate(lang, entity.updatedAt) }));
  return parts.join(" ");
}

/** Loads what the page needs and sends an old or wrong address to the current one (301). */
function readFilter(search: Record<string, string | string[] | undefined>): ReviewFilter {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const sort = one(search.sort);
  const media = one(search.media);
  return { sort: sort === "highest" || sort === "lowest" ? sort : "newest", verified: one(search.verified) === "1", media: media === "video" || media === "photos" ? media : "all" };
}

async function load(lang: Locale, categoryId: string, param: string, filter: ReviewFilter) {
  const id = entityIdFromParam(param);
  if (!id) notFound();
  const [entity, category] = await Promise.all([getEntity(id), getCategory(categoryId)]);
  if (!entity.ok || !category.ok) notFound();
  // The category and the slug in the address must be the current ones; otherwise there is one canonical address (a merged place lands here too).
  const current = entityPath(lang, entity.data.categoryId, entity.data);
  if (decodeURIComponent(`/${lang}/${categoryId}/${param}`) !== decodeURIComponent(current)) permanentRedirect(encodeURI(current)); // a header cannot hold Arabic letters as they are
  const [score, reviews] = await Promise.all([getScore(id), getReviews(id, { sort: filter.sort, verified: filter.verified })]);
  const filtered =
    reviews.ok && filter.media !== "all"
      ? reviews.data.filter((r) => r.media.some((m) => (filter.media === "video" ? m.kind === "Video" : m.kind === "Photo")))
      : reviews.ok
        ? reviews.data
        : null;
  return { entity: entity.data, category: category.data, score: score.ok ? score.data : null, reviews: filtered };
}

export async function generateMetadata({ params }: PageProps<"/[lang]/[category]/[slug]">): Promise<Metadata> {
  const { lang, category: categoryId, slug } = await params;
  if (!isLocale(lang)) return {};
  const id = entityIdFromParam(slug);
  if (!id) return {};
  const [entity, category, dict] = await Promise.all([getEntity(id), getCategory(categoryId), getDictionary(lang)]);
  if (!entity.ok || !category.ok) return {};
  const [score] = await Promise.all([getScore(id)]);
  const name = pick(entity.data.name, lang);
  const summary = buildSummary(lang, dict, name, entity.data, score.ok ? score.data : null, category.data);
  const path = entityPath(lang, entity.data.categoryId, entity.data).slice(lang.length + 1);
  return buildMetadata({
    lang,
    path,
    alternatePaths: { ar: entityPath("ar", entity.data.categoryId, entity.data).slice(3), en: entityPath("en", entity.data.categoryId, entity.data).slice(3) },
    title: fmt(dict.entity.pageTitle, { name }),
    description: fmt(dict.entity.pageDescription, { name, category: pick(category.data.name, lang), summary }),
    // A place nobody has verified yet is a thin page: it can be read and linked but is not offered to search.
    noindex: !score.ok || score.data.verifiedReviews === 0,
  });
}

export default async function EntityPage({ params, searchParams }: PageProps<"/[lang]/[category]/[slug]">) {
  const { lang, category: categoryId, slug } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const filter = readFilter(await searchParams);
  const { entity, category, score, reviews } = await load(lang, categoryId, slug, filter);
  const others = await getPlaces(entity.categoryId, lang, 20, 0);
  const x = { ...dict.entityExtra, ...dict.videos, mediaLabel: dict.videos.filterLabel };
  const mediaLabels = { play: dict.feed.play, pause: dict.feed.pause, mute: dict.feed.mute, unmute: dict.feed.unmute, videoLabel: dict.videos.videoLabel, captions: dict.videos.captions };
  const allMedia = (reviews ?? []).flatMap((r) => r.media.map((m) => ({ ...m, reviewId: r.id, createdAt: r.createdAt })));
  const videos = allMedia.filter((m) => m.kind === "Video" && m.playlistUrl);
  const photoCount = allMedia.filter((m) => m.kind === "Photo").length;
  const basePath = entityPath(lang, entity.categoryId, entity);
  const e = dict.entity;
  const name = pick(entity.name, lang);
  const categoryName = pick(category.name, lang, categoryId);
  const summary = buildSummary(lang, dict, name, entity, score, category);
  const hasScore = score !== null && score.overall !== null;
  const url = absoluteUrl(entityPath(lang, entity.categoryId, entity));
  const min = score?.minAnswersForCriterion ?? 5;

  const faq = [
    {
      question: fmt(e.faqOverallQuestion, { name }),
      answer: summary,
    },
    ...category.criteria.map((c) => {
      const s = score?.criteria.find((x) => x.criterionId === c.id);
      const label = pick(c.label, lang, c.id);
      return {
        question: fmt(e.faqQuestion, { criterion: label, name }),
        answer:
          s && s.score !== null
            ? fmt(e.faqRated, { criterion: label, score: formatScore(lang, s.score), count: formatNumber(lang, s.answers) })
            : fmt(e.faqPending, { criterion: label, count: formatNumber(lang, s?.answers ?? 0), min: formatNumber(lang, min) }),
      };
    }),
  ];

  return (
    <div className="mx-auto max-w-[1120px] space-y-10 px-4 py-10">
      <JsonLdScript
        data={[
          breadcrumbJsonLd([
            { name: dict.site.home, path: `/${lang}` },
            { name: categoryName, path: `/${lang}/${categoryId}` },
            { name, path: entityPath(lang, entity.categoryId, entity) },
          ]),
          entityJsonLd({
            lang,
            url,
            schemaType: category.schemaOrgType,
            name,
            description: summary,
            address: entity.address,
            city: entity.city,
            country: entity.country,
            sameAs: entity.sameAs,
            rating: hasScore ? { value: score.overall as number, count: score.verifiedReviews } : null,
            reviews: (reviews ?? []).map((r) => ({
              author: r.anonymous ? null : (r.author?.name ?? null),
              rating: r.overall,
              text: r.text,
              date: r.createdAt,
              language: r.language,
            })),
          }),
          faqJsonLd(faq),
          ...videos.map((v) =>
            videoJsonLd({
              name: fmt(dict.feed.videoOf, { name }),
              uploadDate: v.createdAt,
              durationSeconds: v.durationSeconds,
              thumbnailUrl: v.posterUrl,
              playlistUrl: v.playlistUrl,
              transcript: pick(v.captions, lang) || null,
              lang,
            }),
          ),
        ]}
      />

      <nav aria-label={e.breadcrumb} className="text-sm text-muted">
        <Link href={`/${lang}`} className="hover:underline">
          {dict.site.home}
        </Link>
        <span aria-hidden="true"> / </span>
        <Link href={`/${lang}/${categoryId}`} className="hover:underline">
          {categoryName}
        </Link>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0 space-y-2">
          <h1 className="font-heading text-[length:var(--text-h1)] font-semibold">{name}</h1>
          <p className="text-muted">{[categoryName, entity.city].filter(Boolean).join(" · ")}</p>
          {hasScore ? (
            <div className="flex flex-wrap items-center gap-2">
              <Stars value={score.overall as number} label={`${formatScore(lang, score.overall as number)} ${e.outOf}`} />
              <span className="text-sm text-muted">{fmt(e.verifiedReviews, { count: formatNumber(lang, score.verifiedReviews) })}</span>
            </div>
          ) : null}
          {photoCount > 0 ? (
            <p className="inline-flex items-center gap-1 text-sm text-muted">
              <PhotoIcon width={16} height={16} /> {fmt(dict.videos.photoCount, { count: formatNumber(lang, photoCount) })}
            </p>
          ) : null}
        </div>
        {hasScore ? (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            {score.verdict && isVerdictKind(score.verdict.kind) ? (
              <span className="inline-flex flex-col items-start gap-1">
                <VerdictSticker verdict={score.verdict.kind} label={dict.verdict[score.verdict.kind]} />
                <span className="text-xs">{fmt(dict.verdict.share, { pct: formatNumber(lang, score.verdict.sharePercent), votes: formatNumber(lang, score.verdict.votes) })}</span>
              </span>
            ) : null}
            <ScoreTile text={formatScore(lang, score.overall as number)} label={`${formatScore(lang, score.overall as number)} ${e.outOf}`} />
            <span>{e.outOf}</span>
          </div>
        ) : null}
      </header>

      <section aria-labelledby="summary" className="space-y-2 rounded-card bg-tint p-5">
        <h2 id="summary" className="font-heading text-lg font-semibold">
          {e.summaryHeading}
        </h2>
        <p className="leading-7">{summary}</p>
        <p className="text-sm text-muted">
          {e.source}{" "}
          <Link href={`/${lang}/methodology`} className="font-medium text-link underline">
            {dict.guide.seeMethod}
          </Link>
        </p>
        <Link href={`${entityPath(lang, entity.categoryId, entity)}/review`} className={buttonClass("primary")}>
          {e.writeReview}
        </Link>
        <p className="text-sm text-muted">
          {dict.business.claimEntry.prompt}{" "}
          <Link href={`/${lang}/business/claim?place=${entity.id}`} className="font-medium text-link underline">
            {dict.business.claimEntry.link}
          </Link>
        </p>
      </section>

      <EntityContactBlock entity={entity} lang={lang} dict={dict.contact} returnPath={basePath} />

      <section aria-labelledby="criteria" className="space-y-3">
        <h2 id="criteria" className="font-heading text-xl font-semibold">
          {e.criteria}
        </h2>
        <table className="w-full text-sm">
          <caption className="sr-only">{e.criteria}</caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">{e.criteria}</th>
              <th scope="col">{e.outOf}</th>
            </tr>
          </thead>
          <tbody>
            {category.criteria.map((c) => {
              const s = score?.criteria.find((x) => x.criterionId === c.id);
              return (
                <tr key={c.id} className="border-b border-border">
                  <th scope="row" className="py-3 pe-4 text-start font-medium">
                    {pick(c.label, lang)}
                  </th>
                  <td className="py-3 text-end">
                    {s && s.score !== null ? (
                      <span className="inline-flex items-center gap-3">
                        <span className="h-2 w-28 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                          <span className="block h-full bg-verified" style={{ width: `${(s.score / 5) * 100}%` }} />
                        </span>
                        <span className="w-8 font-semibold">{formatScore(lang, s.score)}</span>
                      </span>
                    ) : (
                      <span className="text-muted">{fmt(e.criterionPending, { min: formatNumber(lang, min), count: formatNumber(lang, s?.answers ?? 0) })}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {videos.length > 0 ? (
        <section aria-labelledby="videos" className="space-y-3">
          <h2 id="videos" className="font-heading text-xl font-semibold">
            {dict.videos.heading}
          </h2>
          <ul className="flex gap-3 overflow-x-auto pb-2">
            {videos.map((v) => (
              <li key={v.id} className="shrink-0">
                <a href={`#r-${v.reviewId}`} className="relative block h-48 w-28 overflow-hidden rounded-card border border-border bg-surface-2">
                  {v.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- streamed from the API, which sets the cache headers
                    <img src={v.posterUrl} alt={fmt(dict.videos.videoLabel, { duration: Math.round(v.durationSeconds ?? 0) })} width={112} height={192} loading="lazy" decoding="async" className="size-full object-cover" />
                  ) : null}
                  <span className="absolute bottom-2 start-2 rounded-full bg-scrim px-2 py-0.5 text-xs text-on-scrim">{Math.round(v.durationSeconds ?? 0)}s</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="reviews" className="space-y-4">
        <h2 id="reviews" className="font-heading text-xl font-semibold">
          {e.reviews}
        </h2>
        <ReviewFilters base={basePath} current={filter} labels={x} />
        {reviews === null ? (
          <p className="text-muted">{e.unavailable}</p>
        ) : reviews.length === 0 ? (
          <p className="text-muted">{e.noReviews}</p>
        ) : (
          <HelpfulProvider reviewIds={reviews.map((r) => r.id)} initial={Object.fromEntries(reviews.map((r) => [r.id, r.helpfulCount]))}>
          <ul className="space-y-4">
            {reviews.map((r) => (
              <li key={r.id}>
                <div className="space-y-3">
                  <ReviewCardView review={r} lang={lang} labels={{ ...e, accountVerified: dict.verifyPhone.verifiedMark }} media={mediaLabels} owner={dict.business.ownerReply} />
                  <div className="space-y-3 px-2">
                    <HelpfulButton lang={lang} reviewId={r.id} signInNext={basePath} labels={dict.helpful} />
                    <ReviewHistory review={r} lang={lang} labels={x} outOf={e.outOf} />
                    <ReviewComments review={r} lang={lang} labels={{ ...dict.comments, count: dict.cards.comments }} anonymousName={e.anonymousName} returnPath={basePath} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
          </HelpfulProvider>
        )}
      </section>

      {others.ok && others.data.places.some((p) => p.id !== entity.id) ? (
        <form action={`/${lang}/compare`} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="a" value={entity.id} />
          <label htmlFor="compare-b" className="text-sm font-medium">
            {x.compareWith}
          </label>
          <select id="compare-b" name="b" className="min-h-11 rounded-full border border-border bg-surface px-4 text-sm">
            {others.data.places
              .filter((p) => p.id !== entity.id)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {pick(p.name, lang)}
                </option>
              ))}
          </select>
          <button type="submit" className={buttonClass("secondary")}>
            {dict.compare.heading}
          </button>
        </form>
      ) : null}

      {entity.address || entity.city ? (
        <section aria-labelledby="details" className="space-y-2">
          <h2 id="details" className="font-heading text-xl font-semibold">
            {e.details}
          </h2>
          <Card>
            <dl className="grid gap-1 text-sm">
              <dt className="text-muted">{e.address}</dt>
              <dd>{[entity.address, entity.city, entity.country].filter(Boolean).join(lang === "ar" ? "، " : ", ")}</dd>
            </dl>
          </Card>
        </section>
      ) : null}

      <section aria-labelledby="faq" className="space-y-3">
        <h2 id="faq" className="font-heading text-xl font-semibold">
          {e.faqHeading}
        </h2>
        <div className="space-y-2">
          {faq.map((item) => (
            <details key={item.question} className="rounded-card border border-border bg-surface p-4">
              <summary className="cursor-pointer font-medium">{item.question}</summary>
              <p className="mt-2 leading-7 text-muted">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
