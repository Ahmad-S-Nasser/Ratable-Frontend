import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLdScript } from "@/components/site/JsonLdScript";
import { Card } from "@/components/ui/Card";
import { isLocale } from "@/i18n/config";
import { fmt, formatNumber } from "@/i18n/format";
import { getDictionary } from "@/i18n/get-dictionary";
import { getRewardsConfig } from "@/lib/api/server";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";
import { pick } from "@/lib/pick";

export async function generateMetadata({ params }: PageProps<"/[lang]/points">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = (await getDictionary(lang)).pointsPage;
  return buildMetadata({ lang, path: "/points", title: t.title, description: t.description });
}

/** How points work. Every number comes from the same configuration that pays the points, so the page cannot disagree with what is paid. */
export default async function PointsPage({ params }: PageProps<"/[lang]/points">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.pointsPage;
  const config = await getRewardsConfig();
  const name = (x?: { ar?: string; en?: string }) => pick(x, lang);

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: dict.site.home, path: `/${lang}` },
          { name: t.heading, path: `/${lang}/points` },
        ])}
      />
      <h1 className="font-heading text-[length:var(--text-h1)] font-semibold">{t.heading}</h1>
      <p className="text-lg text-muted">{t.intro}</p>

      {config.ok ? (
        <>
          <section aria-labelledby="earn" className="space-y-3">
            <h2 id="earn" className="font-heading text-xl font-semibold">
              {t.earn}
            </h2>
            <table className="w-full text-sm">
              <caption className="sr-only">{t.earn}</caption>
              <tbody>
                {Object.entries(config.data.points).map(([action, points]) => (
                  <tr key={action} className="border-b border-border">
                    <th scope="row" className="py-3 pe-4 text-start font-medium">
                      {t.actions[action as keyof typeof t.actions] ?? action}
                      {config.data.dailyCaps[action] ? <span className="block text-xs font-normal text-muted">{fmt(t.perDay, { n: formatNumber(lang, config.data.dailyCaps[action] ?? 0) })}</span> : null}
                    </th>
                    <td className="py-3 text-end font-semibold text-verified" dir="ltr">
                      +{formatNumber(lang, points)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-sm text-muted">{fmt(t.minWords, { n: formatNumber(lang, config.data.minWrittenLength) })}</p>
          </section>

          <section aria-labelledby="ranks" className="space-y-3">
            <h2 id="ranks" className="font-heading text-xl font-semibold">
              {t.ranks}
            </h2>
            <ol className="grid gap-3 sm:grid-cols-2">
              {config.data.ranks.map((r) => (
                <li key={r.id}>
                  <Card className="space-y-1">
                    <p className="font-semibold">{name(r.title)}</p>
                    <p className="text-sm text-muted">{fmt(t.fromPoints, { n: formatNumber(lang, r.minPoints ?? 0) })}</p>
                  </Card>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="badges" className="space-y-3">
            <h2 id="badges" className="font-heading text-xl font-semibold">
              {t.badges}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {config.data.badges.map((b) => (
                <li key={b.id}>
                  <Card className="h-full space-y-1">
                    <p className="font-semibold">{name(b.title)}</p>
                    <p className="text-sm text-muted">{name(b.description)}</p>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}

      <section aria-labelledby="rules" className="space-y-3 rounded-card bg-tint p-5">
        <h2 id="rules" className="font-heading text-xl font-semibold">
          {t.rules}
        </h2>
        <ul className="list-disc space-y-2 ps-5 leading-7">
          {t.rulesItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
