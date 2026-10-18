import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLdScript } from "@/components/site/JsonLdScript";
import { Card } from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/Button";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: PageProps<"/[lang]/business">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = (await getDictionary(lang)).business.marketing;
  return buildMetadata({ lang, path: "/business", title: t.title, description: t.description });
}

/** The page for businesses. The business side uses the same system and tokens as the rest of the site. */
export default async function BusinessPage({ params }: PageProps<"/[lang]/business">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.business.marketing;

  return (
    <div className="mx-auto max-w-[1120px] space-y-12 px-4 py-12">
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: dict.site.home, path: `/${lang}` },
          { name: t.title, path: `/${lang}/business` },
        ])}
      />
      <header className="max-w-3xl space-y-4">
        <h1 className="font-heading text-[length:var(--text-h1)] font-semibold">{t.heading}</h1>
        <p className="text-lg leading-8 text-muted">{t.intro}</p>
        <div className="flex flex-wrap gap-3">
          <Link href={`/${lang}/business/sign-up`} className={buttonClass("primary")}>
            {t.ctaClaim}
          </Link>
          <Link href={`/${lang}/business/pricing`} className={buttonClass("secondary")}>
            {t.ctaPricing}
          </Link>
        </div>
      </header>

      <ul className="grid gap-4 md:grid-cols-3">
        {t.points.map((p) => (
          <li key={p.title}>
            <Card className="h-full space-y-2">
              <h2 className="font-heading text-lg font-semibold">{p.title}</h2>
              <p className="leading-7 text-muted">{p.text}</p>
            </Card>
          </li>
        ))}
      </ul>

      <section aria-labelledby="steps" className="space-y-4">
        <h2 id="steps" className="font-heading text-xl font-semibold">
          {t.stepsHeading}
        </h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {t.steps.map((s, i) => (
            <li key={s.title}>
              <Card className="h-full space-y-2">
                <h3 className="font-heading text-lg font-semibold">
                  <span className="text-verified">{(i + 1).toLocaleString(lang === "ar" ? "ar-EG" : "en")}. </span>
                  {s.title}
                </h3>
                <p className="leading-7 text-muted">{s.text}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
