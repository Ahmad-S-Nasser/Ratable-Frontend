import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLdScript } from "@/components/site/JsonLdScript";
import { Card } from "@/components/ui/Card";
import { ScoreTile } from "@/components/ui/ScoreTile";
import { isLocale } from "@/i18n/config";
import { fmt, formatDate, formatNumber, formatScore } from "@/i18n/format";
import { getDictionary } from "@/i18n/get-dictionary";
import { getCategory, getPlaces } from "@/lib/api/server";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";
import { entityPath } from "@/lib/urls";

const TOP = 10;

async function loadGuide(lang: string, categoryId: string) {
  const [category, places] = await Promise.all([getCategory(categoryId), getPlaces(categoryId, lang, TOP, 0)]);
  if (!category.ok) return null;
  // Only places with a verified score are ranked here; the guide never lists a place on promise.
  const ranked = places.ok ? places.data.places.filter((p) => p.overall !== null) : [];
  return { category: category.data, ranked };
}

export async function generateMetadata({ params }: PageProps<"/[lang]/[category]/best">): Promise<Metadata> {
  const { lang, category: categoryId } = await params;
  if (!isLocale(lang)) return {};
  const [guide, dict] = await Promise.all([loadGuide(lang, categoryId), getDictionary(lang)]);
  if (!guide) return {};
  const name = guide.category.name[lang] ?? guide.category.name.ar ?? categoryId;
  return buildMetadata({
    lang,
    path: `/${categoryId}/best`,
    title: fmt(dict.guide.title, { name }),
    description: fmt(dict.guide.description, { name }),
    noindex: guide.ranked.length === 0,
  });
}

export default async function BestOfPage({ params }: PageProps<"/[lang]/[category]/best">) {
  const { lang, category: categoryId } = await params;
  if (!isLocale(lang)) notFound();
  const [guide, dict] = await Promise.all([loadGuide(lang, categoryId), getDictionary(lang)]);
  if (!guide) notFound();
  const g = dict.guide;
  const name = guide.category.name[lang] ?? guide.category.name.ar ?? categoryId;
  const placeName = (p: { name: { ar?: string; en?: string } }) => p.name[lang] ?? p.name.ar ?? p.name.en ?? "";

  return (
    <div className="mx-auto max-w-[1120px] space-y-6 px-4 py-10">
      <JsonLdScript
        data={[
          breadcrumbJsonLd([
            { name: dict.site.home, path: `/${lang}` },
            { name, path: `/${lang}/${categoryId}` },
            { name: fmt(g.bestOf, { name }), path: `/${lang}/${categoryId}/best` },
          ]),
          itemListJsonLd(guide.ranked.map((p) => ({ name: placeName(p), path: entityPath(lang, categoryId, p) }))),
        ]}
      />
      <h1 className="font-heading text-[length:var(--text-h1)] font-semibold">{fmt(g.heading, { name })}</h1>
      <p className="text-lg text-muted">{fmt(g.intro, { name })}</p>

      <section aria-labelledby="method" className="space-y-2 rounded-card bg-tint p-5">
        <h2 id="method" className="font-heading text-lg font-semibold">
          {g.methodHeading}
        </h2>
        <p className="leading-7">{g.method}</p>
        <p className="text-sm text-muted">
          <Link href={`/${lang}/methodology`} className="font-medium text-link underline">
            {g.seeMethod}
          </Link>
        </p>
      </section>

      {guide.ranked.length === 0 ? (
        <p className="text-muted">{g.empty}</p>
      ) : (
        <table className="w-full text-sm">
          <caption className="sr-only">{fmt(g.tableLabel, { name })}</caption>
          <thead>
            <tr className="border-b border-border text-start text-muted">
              <th scope="col" className="py-2 pe-3 text-start font-medium">
                #
              </th>
              <th scope="col" className="py-2 pe-3 text-start font-medium">
                {g.place}
              </th>
              <th scope="col" className="py-2 pe-3 text-start font-medium">
                {g.score}
              </th>
              <th scope="col" className="py-2 text-start font-medium">
                {g.reviews}
              </th>
            </tr>
          </thead>
          <tbody>
            {guide.ranked.map((p, i) => (
              <tr key={p.id} className="border-b border-border">
                <td className="py-3 pe-3 font-semibold text-verified">{formatNumber(lang, i + 1)}</td>
                <th scope="row" className="py-3 pe-3 text-start font-medium">
                  <Link href={entityPath(lang, categoryId, p)} className="hover:underline">
                    {placeName(p)}
                  </Link>
                  {p.city ? <span className="block text-xs font-normal text-muted">{p.city}</span> : null}
                </th>
                <td className="py-3 pe-3">
                  <ScoreTile text={formatScore(lang, p.overall as number)} label={`${formatScore(lang, p.overall as number)} ${dict.entity.outOf}`} />
                </td>
                <td className="py-3">{formatNumber(lang, p.verifiedReviews)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {guide.ranked.length > 0 ? <Card className="text-sm text-muted">{fmt(g.updated, { date: formatDate(lang, guide.ranked.map((p) => p.lastModified).sort().at(-1) as string) })}</Card> : null}
      <p>
        <Link href={`/${lang}/${categoryId}`} className="font-medium text-link underline">
          {fmt(g.all, { name })}
        </Link>
      </p>
    </div>
  );
}
