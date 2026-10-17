import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLdScript } from "@/components/site/JsonLdScript";
import { Card } from "@/components/ui/Card";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: PageProps<"/[lang]/methodology">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = (await getDictionary(lang)).methodology;
  return buildMetadata({ lang, path: "/methodology", title: t.title, description: t.description });
}

export default async function MethodologyPage({ params }: PageProps<"/[lang]/methodology">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.methodology;
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: dict.site.home, path: `/${lang}` },
          { name: t.heading, path: `/${lang}/methodology` },
        ])}
      />
      <h1 className="font-heading text-[length:var(--text-h1)] font-semibold">{t.heading}</h1>
      <p className="text-lg text-muted">{t.intro}</p>
      <ol className="space-y-4">
        {t.items.map((item, i) => (
          <li key={item.title}>
            <Card className="space-y-2">
              <h2 className="font-heading text-lg font-semibold">
                <span className="text-verified">{(i + 1).toLocaleString(lang === "ar" ? "ar-EG" : "en")}. </span>
                {item.title}
              </h2>
              <p className="leading-7 text-muted">{item.text}</p>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}
