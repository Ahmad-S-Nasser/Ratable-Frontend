import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReviewForm } from "@/components/site/ReviewForm";
import { isLocale } from "@/i18n/config";
import { fmt } from "@/i18n/format";
import { getDictionary } from "@/i18n/get-dictionary";
import { getCategory, getEntity } from "@/lib/api/server";
import { buildMetadata } from "@/lib/seo/metadata";
import { entityIdFromParam, entityPath } from "@/lib/urls";
import { pick } from "@/lib/pick";

export async function generateMetadata({ params }: PageProps<"/[lang]/[category]/[slug]/review">): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};
  const id = entityIdFromParam(slug);
  const entity = id ? await getEntity(id) : null;
  if (!entity?.ok) return {};
  const t = (await getDictionary(lang)).review;
  const name = pick(entity.data.name, lang);
  // A form is never offered to search engines.
  return buildMetadata({
    lang,
    path: `${entityPath(lang, entity.data.categoryId, entity.data).slice(lang.length + 1)}/review`,
    title: fmt(t.title, { name }),
    description: fmt(t.pageDescription, { name }),
    noindex: true,
  });
}

export default async function ReviewPage({ params }: PageProps<"/[lang]/[category]/[slug]/review">) {
  const { lang, category: categoryId, slug } = await params;
  if (!isLocale(lang)) notFound();
  const id = entityIdFromParam(slug);
  if (!id) notFound();
  const [entity, category, dict] = await Promise.all([getEntity(id), getCategory(categoryId), getDictionary(lang)]);
  if (!entity.ok || !category.ok || entity.data.categoryId !== categoryId) notFound();

  const name = pick(entity.data.name, lang);
  const path = entityPath(lang, categoryId, entity.data);
  const t = dict.review;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <div className="space-y-1">
        <h1 className="font-heading text-[length:var(--text-h1)] font-semibold">{t.heading}</h1>
        <p className="text-muted">
          <Link href={path} className="hover:underline">
            {name}
          </Link>
          {entity.data.city ? ` · ${entity.data.city}` : ""}
        </p>
      </div>
      <ReviewForm lang={lang} entityId={entity.data.id} entityPath={path} category={category.data} dict={{ ...t, media: dict.media, verdict: dict.verdict, rewards: { afterPosting: dict.level.afterPosting, rankUp: dict.level.rankUp, how: dict.level.howItWorks, level: dict.level.title } }} />
    </div>
  );
}
