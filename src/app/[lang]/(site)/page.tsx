import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLdScript } from "@/components/site/JsonLdScript";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { EyeOffIcon, ScaleIcon, SearchIcon, ShieldCheckIcon } from "@/components/ui/Icons";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getCategories } from "@/lib/api/server";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = (await getDictionary(lang)).home;
  return buildMetadata({ lang, path: "", title: t.title, description: t.description });
}

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.home;
  const categories = await getCategories();
  const list = categories.ok ? categories.data : [];

  const trust = [
    { icon: ShieldCheckIcon, ...t.trust.verified },
    { icon: EyeOffIcon, ...t.trust.anonymous },
    { icon: ScaleIcon, ...t.trust.fair },
  ];
  const steps = [t.how.step1, t.how.step2, t.how.step3];

  return (
    <div className="mx-auto max-w-[1120px] space-y-14 px-4 py-10">
      <JsonLdScript data={[organizationJsonLd(), websiteJsonLd(lang)]} />

      <section className="space-y-5 py-4 text-center sm:py-10">
        <h1 className="font-heading text-[length:var(--text-display)] font-semibold leading-tight">{t.heading}</h1>
        <p className="mx-auto max-w-xl text-lg text-muted">{t.tagline}</p>
        <form action={`/${lang}/search`} role="search" className="mx-auto flex max-w-xl items-center gap-2 rounded-full border border-border bg-surface p-1.5 ps-5">
          <SearchIcon className="shrink-0 text-muted" />
          <label htmlFor="home-search" className="sr-only">
            {t.search.label}
          </label>
          <input
            id="home-search"
            name="q"
            type="search"
            placeholder={t.search.placeholder}
            className="min-h-11 w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted"
          />
          <Button type="submit" variant="primary">
            {t.search.submit}
          </Button>
        </form>
      </section>

      <section aria-labelledby="home-categories" className="space-y-4">
        <h2 id="home-categories" className="font-heading text-xl font-semibold">
          {t.categoriesHeading}
        </h2>
        {list.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {list.map((c) => (
              <li key={c.id}>
                <Chip href={`/${lang}/${c.id}`}>{c.name[lang] ?? c.name.ar}</Chip>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">{t.categoriesEmpty}</p>
        )}
      </section>

      <section aria-labelledby="home-trust" className="rounded-card bg-tint p-6 sm:p-8">
        <h2 id="home-trust" className="font-heading text-xl font-semibold text-foreground">
          {t.trust.heading}
        </h2>
        <ul className="mt-5 grid gap-5 sm:grid-cols-3">
          {trust.map(({ icon: Icon, title, text }) => (
            <li key={title} className="space-y-2">
              <Icon className="text-verified" />
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm leading-6 text-muted">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="home-how" className="space-y-4">
        <h2 id="home-how" className="font-heading text-xl font-semibold">
          {t.how.heading}
        </h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {steps.map((step, i) => (
            <li key={step.title}>
              <Card className="h-full space-y-2">
                <span className="text-sm font-semibold text-verified">{(i + 1).toLocaleString(lang === "ar" ? "ar-EG" : "en")}</span>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="text-sm leading-6 text-muted">{step.text}</p>
              </Card>
            </li>
          ))}
        </ol>
        <p className="text-sm">
          <Link href={`/${lang}/categories`} className="font-medium text-link underline">
            {dict.site.allCategories}
          </Link>
        </p>
      </section>
    </div>
  );
}
