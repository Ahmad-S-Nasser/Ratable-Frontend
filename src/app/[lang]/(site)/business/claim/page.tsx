import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClaimForm } from "@/components/site/ClaimForm";
import { Card } from "@/components/ui/Card";
import { Button, buttonClass } from "@/components/ui/Button";
import { SearchIcon } from "@/components/ui/Icons";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getEntity, searchEntities } from "@/lib/api/server";
import { pick } from "@/lib/pick";
import { buildMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: PageProps<"/[lang]/business/claim">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = (await getDictionary(lang)).business.claim;
  // An account step: never indexed.
  return buildMetadata({ lang, path: "/business/claim", title: t.title, description: t.description, noindex: true });
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Step one is a plain search over every place (a normal GET form, so it works without JavaScript); step two is the claim form for the chosen place. */
export default async function ClaimPage({ params, searchParams }: PageProps<"/[lang]/business/claim">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.business.claim;
  const query = await searchParams;
  const placeId = first(query.place);
  const q = first(query.q).trim().slice(0, 100);

  const entity = /^[a-f0-9]{24}$/.test(placeId) ? await getEntity(placeId) : null;
  const place = entity?.ok ? { id: entity.data.id, name: pick(entity.data.name, lang) } : null;
  const found = !place && q ? await searchEntities(q) : null;

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-10">
      <h1 className="font-heading text-[length:var(--text-h1)] font-semibold">{t.heading}</h1>
      <p className="text-muted">{t.intro}</p>

      {place ? (
        <ClaimForm lang={lang} place={place} dict={t} />
      ) : (
        <section aria-labelledby="claim-search" className="space-y-4">
          <h2 id="claim-search" className="sr-only">
            {t.search.label}
          </h2>
          <form action={`/${lang}/business/claim`} role="search" className="flex items-center gap-2 rounded-full border border-border bg-surface p-1.5 ps-5">
            <SearchIcon className="shrink-0 text-muted" />
            <label htmlFor="claim-q" className="sr-only">
              {t.search.label}
            </label>
            <input id="claim-q" name="q" type="search" defaultValue={q} placeholder={t.search.placeholder} className="min-h-11 w-full min-w-0 bg-transparent outline-none placeholder:text-muted" />
            <Button type="submit" variant="primary">
              {t.search.button}
            </Button>
          </form>
          {found ? (
            found.ok && found.data.length > 0 ? (
              <ul className="space-y-3" data-testid="claim-results">
                {found.data.map((e) => (
                  <li key={e.id}>
                    <Card className="flex flex-wrap items-center justify-between gap-3">
                      <span className="font-semibold" dir="auto">
                        {pick(e.name, lang)}
                        {e.city ? <span className="block text-sm font-normal text-muted">{e.city}</span> : null}
                      </span>
                      <Link href={`/${lang}/business/claim?place=${e.id}`} className={buttonClass("secondary")}>
                        {t.search.choose}
                      </Link>
                    </Card>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">
                {t.search.empty}{" "}
                <Link href={`/${lang}/add`} className="font-medium text-link underline">
                  {t.search.addPlace}
                </Link>
              </p>
            )
          ) : (
            <p className="text-muted">{t.noPlace}</p>
          )}
        </section>
      )}
    </div>
  );
}
