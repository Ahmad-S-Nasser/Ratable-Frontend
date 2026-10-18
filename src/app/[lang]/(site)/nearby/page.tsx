import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NearbyView } from "@/components/site/NearbyView";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getAreas, getCategories } from "@/lib/api/server";
import { buildMetadata } from "@/lib/seo/metadata";
import { pick } from "@/lib/pick";

export async function generateMetadata({ params }: PageProps<"/[lang]/nearby">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = (await getDictionary(lang)).nearby;
  // The result depends on where the visitor is, so it is not a page for search engines.
  return buildMetadata({ lang, path: "/nearby", title: t.title, description: t.description, noindex: true });
}

export default async function NearbyPage({ params, searchParams }: PageProps<"/[lang]/nearby">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const [areas, categories] = await Promise.all([getAreas(), getCategories()]);
  const raw = (await searchParams).area;
  const area = Array.isArray(raw) ? raw[0] : raw;
  const cats = categories.ok ? categories.data : [];
  const criteria: Record<string, string> = {};
  for (const c of cats) for (const k of c.criteria) criteria[k.id] ??= pick(k.label, lang, k.id);

  return (
    <div className="mx-auto max-w-[1120px] space-y-6 px-4 py-10">
      <h1 className="font-heading text-[length:var(--text-h1)] font-semibold">{dict.nearby.heading}</h1>
      <NearbyView
        lang={lang}
        areas={(areas.ok ? areas.data : []).map((a) => ({ id: a.id, name: pick(a.name, lang, a.id) }))}
        categories={cats.map((c) => ({ id: c.id, name: pick(c.name, lang, c.id) }))}
        initialArea={area}
        dict={dict.nearby}
        labels={{
          reviewsCount: dict.category.reviewsCount,
          unrated: dict.category.unrated,
          outOf: dict.entity.outOf,
          price: dict.lists.price,
          distance: dict.lists.distance,
          verdicts: { worth: dict.verdict.worth, not_worth: dict.verdict.not_worth, hidden_gem: dict.verdict.hidden_gem },
          criteria,
        }}
      />
    </div>
  );
}
