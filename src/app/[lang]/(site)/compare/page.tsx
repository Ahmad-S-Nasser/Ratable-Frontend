import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { fmt, formatNumber, formatScore } from "@/i18n/format";
import { getDictionary } from "@/i18n/get-dictionary";
import { getCategory, getEntity, getScore } from "@/lib/api/server";
import { buildMetadata } from "@/lib/seo/metadata";
import { entityIdFromParam, entityPath } from "@/lib/urls";

const idOf = (v: string | string[] | undefined) => entityIdFromParam((Array.isArray(v) ? v[0] : v) ?? "");

async function loadSide(id: string | null) {
  if (!id) return null;
  const [entity, score] = await Promise.all([getEntity(id), getScore(id)]);
  return entity.ok && score.ok ? { entity: entity.data, score: score.data } : null;
}

const nameOf = (e: { name: { ar?: string; en?: string } }, lang: Locale) => e.name[lang] ?? e.name.ar ?? e.name.en ?? "";

export async function generateMetadata({ params, searchParams }: PageProps<"/[lang]/compare">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = (await getDictionary(lang)).compare;
  const q = await searchParams;
  const [a, b] = await Promise.all([loadSide(idOf(q.a)), loadSide(idOf(q.b))]);
  const names = a && b ? { a: nameOf(a.entity, lang), b: nameOf(b.entity, lang) } : null;
  // Any pair of places can be compared, so the pages are endless and thin for search: readers use them, search engines do not index them.
  return buildMetadata({
    lang,
    path: "/compare",
    title: names ? fmt(t.title, names) : t.heading,
    description: names ? fmt(t.description, names) : t.choose,
    noindex: true,
  });
}

export default async function ComparePage({ params, searchParams }: PageProps<"/[lang]/compare">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.compare;
  const q = await searchParams;
  const [a, b] = await Promise.all([loadSide(idOf(q.a)), loadSide(idOf(q.b))]);
  const category = a && b && a.entity.categoryId === b.entity.categoryId ? await getCategory(a.entity.categoryId) : null;

  if (!a || !b || !category?.ok) {
    return (
      <div className="mx-auto max-w-[1120px] space-y-4 px-4 py-10">
        <h1 className="font-heading text-[length:var(--text-h1)] font-semibold">{t.heading}</h1>
        <p className="text-muted">{a || b ? t.invalid : t.choose}</p>
      </div>
    );
  }

  const cell = (side: NonNullable<typeof a>, criterionId: string) => {
    const s = side.score.criteria.find((c) => c.criterionId === criterionId);
    return s && s.score !== null ? formatScore(lang, s.score) : t.noScore;
  };
  const best = (criterionId: string) => {
    const x = a.score.criteria.find((c) => c.criterionId === criterionId)?.score ?? null;
    const y = b.score.criteria.find((c) => c.criterionId === criterionId)?.score ?? null;
    return x !== null && y !== null && x !== y ? (x > y ? "a" : "b") : null;
  };

  return (
    <div className="mx-auto max-w-[1120px] space-y-6 px-4 py-10">
      <h1 className="font-heading text-[length:var(--text-h1)] font-semibold">{fmt(t.title, { a: nameOf(a.entity, lang), b: nameOf(b.entity, lang) })}</h1>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <caption className="sr-only">{t.heading}</caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="py-3 pe-4 text-start font-medium text-muted">
                {t.criterion}
              </th>
              {[a, b].map((side) => (
                <th key={side.entity.id} scope="col" className="py-3 text-start font-heading text-base font-semibold">
                  <Link href={entityPath(lang, side.entity.categoryId, side.entity)} className="hover:underline">
                    {nameOf(side.entity, lang)}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border bg-tint">
              <th scope="row" className="py-3 pe-4 text-start font-semibold">
                {t.overall}
              </th>
              {[a, b].map((side) => (
                <td key={side.entity.id} className="py-3 font-bold text-verified">
                  {side.score.overall !== null ? formatScore(lang, side.score.overall) : t.noScore}
                </td>
              ))}
            </tr>
            <tr className="border-b border-border">
              <th scope="row" className="py-3 pe-4 text-start font-medium">
                {t.reviews}
              </th>
              {[a, b].map((side) => (
                <td key={side.entity.id} className="py-3">
                  {formatNumber(lang, side.score.verifiedReviews)}
                </td>
              ))}
            </tr>
            {category.data.criteria.map((c) => {
              const winner = best(c.id);
              return (
                <tr key={c.id} className="border-b border-border">
                  <th scope="row" className="py-3 pe-4 text-start font-medium">
                    {c.label[lang] ?? c.label.ar}
                  </th>
                  <td className={`py-3 ${winner === "a" ? "font-semibold text-verified" : ""}`}>{cell(a, c.id)}</td>
                  <td className={`py-3 ${winner === "b" ? "font-semibold text-verified" : ""}`}>{cell(b, c.id)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
