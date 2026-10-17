import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { SearchIcon } from "@/components/ui/Icons";
import { Button } from "@/components/ui/Button";
import { isLocale } from "@/i18n/config";
import { fmt } from "@/i18n/format";
import { getDictionary } from "@/i18n/get-dictionary";
import { searchEntities } from "@/lib/api/server";
import { buildMetadata } from "@/lib/seo/metadata";
import { entityPath } from "@/lib/urls";

export async function generateMetadata({ params }: PageProps<"/[lang]/search">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = (await getDictionary(lang)).search;
  // Search results are never offered to search engines; the pages they lead to are.
  return buildMetadata({ lang, path: "/search", title: t.title, description: t.description, noindex: true });
}

export default async function SearchPage({ params, searchParams }: PageProps<"/[lang]/search">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.search;
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 100) ?? "";
  const result = q ? await searchEntities(q) : null;

  return (
    <div className="mx-auto max-w-[1120px] space-y-6 px-4 py-10">
      <h1 className="font-heading text-[length:var(--text-h1)] font-semibold">{t.heading}</h1>
      <form action={`/${lang}/search`} role="search" className="flex max-w-xl items-center gap-2 rounded-full border border-border bg-surface p-1.5 ps-5">
        <SearchIcon className="shrink-0 text-muted" />
        <label htmlFor="search-q" className="sr-only">
          {dict.home.search.label}
        </label>
        <input id="search-q" name="q" type="search" defaultValue={q} placeholder={dict.home.search.placeholder} className="min-h-11 w-full min-w-0 bg-transparent outline-none placeholder:text-muted" />
        <Button type="submit" variant="primary">
          {dict.home.search.submit}
        </Button>
      </form>

      {result === null ? (
        <p className="text-muted">{t.prompt}</p>
      ) : !result.ok ? (
        <p className="text-muted">{dict.category.unavailable}</p>
      ) : result.data.length === 0 ? (
        <p className="text-muted">{t.none}</p>
      ) : (
        <>
          <h2 className="text-sm text-muted">{fmt(t.resultsFor, { q })}</h2>
          <ul className="grid gap-4 md:grid-cols-2">
            {result.data.map((p) => (
              <li key={p.id}>
                <Card>
                  <Link href={entityPath(lang, p.categoryId, p)} className="font-heading text-lg font-semibold hover:underline">
                    {p.name[lang] ?? p.name.ar ?? p.name.en}
                  </Link>
                  <p className="text-sm text-muted">{[p.city, p.address].filter(Boolean).join(" · ")}</p>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
