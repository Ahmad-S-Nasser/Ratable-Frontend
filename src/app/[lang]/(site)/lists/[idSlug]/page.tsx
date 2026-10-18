import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { JsonLdScript } from "@/components/site/JsonLdScript";
import { PlaceList } from "@/components/site/PlaceList";
import { isLocale, type Locale } from "@/i18n/config";
import { fmt, formatDate, formatNumber } from "@/i18n/format";
import { getDictionary } from "@/i18n/get-dictionary";
import { getCategory, getList } from "@/lib/api/server";
import { cardLabels } from "@/lib/labels";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";
import { entityPath } from "@/lib/urls";
import { pick } from "@/lib/pick";

/** The list id is the part before the first dash. It never changes, so an old slug can always be sent to the current address. */
const idOf = (param: string) => decodeURIComponent(param).split("-")[0];

async function load(lang: Locale, param: string) {
  const id = idOf(param);
  if (!/^[A-Za-z0-9]{1,16}$/.test(id)) notFound();
  const list = await getList(id, lang);
  if (!list.ok) notFound();
  const current = `/${lang}/lists/${list.data.id}-${pick(list.data.slug, lang)}`;
  if (decodeURIComponent(`/${lang}/lists/${param}`) !== decodeURIComponent(current)) permanentRedirect(encodeURI(current));
  const category = await getCategory(list.data.categoryId);
  if (!category.ok) notFound();
  return { list: list.data, category: category.data };
}

export async function generateMetadata({ params }: PageProps<"/[lang]/lists/[idSlug]">): Promise<Metadata> {
  const { lang, idSlug } = await params;
  if (!isLocale(lang)) return {};
  const list = await getList(idOf(idSlug), lang);
  if (!list.ok) return {};
  const dict = await getDictionary(lang);
  const title = pick(list.data.title, lang);
  const at = (l: Locale) => `/lists/${list.data.id}-${list.data.slug[l] ?? list.data.slug.ar}`;
  return buildMetadata({
    lang,
    path: at(lang),
    alternatePaths: { ar: at("ar"), en: at("en") },
    title,
    description: `${title}. ${dict.lists.nobodyPays}`,
    noindex: list.data.places.length === 0, // an empty list is thin
  });
}

export default async function ListPage({ params }: PageProps<"/[lang]/lists/[idSlug]">) {
  const { lang, idSlug } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const { list, category } = await load(lang, idSlug);
  const t = dict.lists;
  const title = pick(list.title, lang);
  const categoryName = pick(category.name, lang, category.id);
  const area = list.area ? (pick(list.area, lang)) : "";

  return (
    <div className="mx-auto max-w-[1120px] space-y-6 px-4 py-10">
      <JsonLdScript
        data={[
          breadcrumbJsonLd([
            { name: dict.site.home, path: `/${lang}` },
            { name: t.heading, path: `/${lang}/lists` },
            { name: title, path: `/${lang}/lists/${list.id}-${pick(list.slug, lang)}` },
          ]),
          itemListJsonLd(list.places.map((p) => ({ name: pick(p.name, lang), path: entityPath(lang, list.categoryId, p) }))),
        ]}
      />
      <h1 className="font-heading text-[length:var(--text-h1)] font-semibold">{title}</h1>
      <section className="space-y-1 rounded-card bg-tint p-5" aria-label={t.nobodyPays}>
        <p className="font-medium">{t.nobodyPays}</p>
        <p className="text-sm text-muted">{fmt(t.rule, { min: formatNumber(lang, list.minReviews), category: categoryName, area: area ? fmt(t.inArea, { area }) : "" })}</p>
        {list.updatedAt ? <p className="text-sm text-muted">{fmt(t.updated, { date: formatDate(lang, list.updatedAt) })}</p> : null}
        <p className="text-sm">
          <Link href={`/${lang}/methodology`} className="font-medium text-link underline">
            {t.seeMethod}
          </Link>
        </p>
      </section>
      {list.places.length === 0 ? (
        <p className="text-muted">{t.emptyList}</p>
      ) : (
        <PlaceList
          places={list.places}
          lang={lang}
          categoryId={list.categoryId}
          labels={cardLabels(dict, category, lang)}
          distanceUrl={`/api/collections/${list.id}?lang=${lang}`}
          near={dict.nearMe}
        />
      )}
      <p>
        <Link href={`/${lang}/lists`} className="font-medium text-link underline">
          {t.allLists}
        </Link>
      </p>
    </div>
  );
}
