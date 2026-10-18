import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLdScript } from "@/components/site/JsonLdScript";
import { Card } from "@/components/ui/Card";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLists } from "@/lib/api/server";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";
import { pick } from "@/lib/pick";

export async function generateMetadata({ params }: PageProps<"/[lang]/lists">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = (await getDictionary(lang)).lists;
  const lists = await getLists();
  return buildMetadata({ lang, path: "/lists", title: t.title, description: t.description, noindex: !lists.ok || lists.data.length === 0 });
}

export default async function ListsPage({ params }: PageProps<"/[lang]/lists">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.lists;
  const lists = await getLists();
  const items = lists.ok ? lists.data : [];

  return (
    <div className="mx-auto max-w-[1120px] space-y-6 px-4 py-10">
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: dict.site.home, path: `/${lang}` },
          { name: t.heading, path: `/${lang}/lists` },
        ])}
      />
      <h1 className="font-heading text-[length:var(--text-h1)] font-semibold">{t.heading}</h1>
      <p className="text-muted">{t.intro}</p>
      {items.length === 0 ? (
        <p className="text-muted">{t.empty}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {items.map((l) => (
            <li key={l.id}>
              <Card className="h-full space-y-1">
                <Link href={`/${lang}/lists/${l.id}-${pick(l.slug, lang)}`} className="font-heading text-lg font-semibold hover:underline">
                  {pick(l.title, lang)}
                </Link>
                {l.area ? <p className="text-sm text-muted">{pick(l.area, lang)}</p> : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
