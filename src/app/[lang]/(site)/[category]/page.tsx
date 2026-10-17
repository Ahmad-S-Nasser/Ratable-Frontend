import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLdScript } from "@/components/site/JsonLdScript";
import { PlaceCardView } from "@/components/site/PlaceCardView";
import { buttonClass } from "@/components/ui/Button";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { fmt, formatNumber } from "@/i18n/format";
import { getCategory, getPlaces } from "@/lib/api/server";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";
import { entityPath } from "@/lib/urls";

const PAGE_SIZE = 20;

const pageNumber = (value: string | string[] | undefined) => {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n >= 1 && n <= 500 ? n : 1;
};

export async function generateMetadata({ params, searchParams }: PageProps<"/[lang]/[category]">): Promise<Metadata> {
  const { lang, category: categoryId } = await params;
  if (!isLocale(lang)) return {};
  const [category, t] = await Promise.all([getCategory(categoryId), getDictionary(lang)]);
  if (!category.ok) return {};
  const places = await getPlaces(categoryId, lang, PAGE_SIZE, 0);
  const name = category.data.name[lang] ?? category.data.name.ar ?? categoryId;
  const total = places.ok ? places.data.total : 0;
  const page = pageNumber((await searchParams).page);
  // Later pages and empty lists are thin: they are not indexed, and the canonical is always the base page.
  return buildMetadata({
    lang,
    path: `/${categoryId}`,
    title: fmt(t.category.title, { name }),
    description: fmt(t.category.description, { name, count: formatNumber(lang, total) }),
    noindex: total === 0 || page > 1,
  });
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/[lang]/[category]">) {
  const { lang, category: categoryId } = await params;
  if (!isLocale(lang)) notFound();
  const [category, dict] = await Promise.all([getCategory(categoryId), getDictionary(lang)]);
  if (!category.ok) notFound();

  const page = pageNumber((await searchParams).page);
  const places = await getPlaces(categoryId, lang, PAGE_SIZE, (page - 1) * PAGE_SIZE);
  const name = category.data.name[lang] ?? category.data.name.ar ?? categoryId;
  const t = dict.category;
  const list = places.ok ? places.data.places : [];
  const total = places.ok ? places.data.total : 0;
  const hasNext = page * PAGE_SIZE < total;

  return (
    <div className="mx-auto max-w-[1120px] space-y-6 px-4 py-10">
      <JsonLdScript
        data={[
          breadcrumbJsonLd([
            { name: dict.site.home, path: `/${lang}` },
            { name: dict.site.categories, path: `/${lang}/categories` },
            { name, path: `/${lang}/${categoryId}` },
          ]),
          itemListJsonLd(list.map((p) => ({ name: p.name[lang] ?? p.name.ar ?? "", path: entityPath(lang, categoryId, p) }))),
        ]}
      />
      <nav aria-label={dict.entity.breadcrumb} className="text-sm text-muted">
        <Link href={`/${lang}`} className="hover:underline">
          {dict.site.home}
        </Link>
        <span aria-hidden="true"> / </span>
        <Link href={`/${lang}/categories`} className="hover:underline">
          {dict.site.categories}
        </Link>
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-heading text-[length:var(--text-h1)] font-semibold">{name}</h1>
          {places.ok ? <p className="text-sm text-muted">{fmt(t.count, { count: formatNumber(lang, total) })}</p> : null}
        </div>
        <Link href={`/${lang}/add?category=${categoryId}`} className={buttonClass("secondary")}>
          {t.addPlace}
        </Link>
      </div>

      {!places.ok ? (
        <p className="text-muted">{t.unavailable}</p>
      ) : list.length === 0 ? (
        <p className="text-muted">{t.empty}</p>
      ) : (
        <ol className="grid gap-4 md:grid-cols-2">
          {list.map((p) => (
            <li key={p.id}>
              <PlaceCardView place={p} lang={lang} categoryId={categoryId} labels={{ reviewsCount: t.reviewsCount, unrated: t.unrated, outOf: dict.entity.outOf }} />
            </li>
          ))}
        </ol>
      )}

      {page > 1 || hasNext ? (
        <nav aria-label={t.page.replace("{page}", String(page))} className="flex justify-between gap-3">
          {page > 1 ? (
            <Link rel="prev" href={`/${lang}/${categoryId}${page > 2 ? `?page=${page - 1}` : ""}`} className={buttonClass("secondary")}>
              {t.previous}
            </Link>
          ) : (
            <span />
          )}
          {hasNext ? (
            <Link rel="next" href={`/${lang}/${categoryId}?page=${page + 1}`} className={buttonClass("secondary")}>
              {t.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
