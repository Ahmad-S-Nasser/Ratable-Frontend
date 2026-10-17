import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLdScript } from "@/components/site/JsonLdScript";
import { Card } from "@/components/ui/Card";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getCategories } from "@/lib/api/server";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: PageProps<"/[lang]/categories">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = (await getDictionary(lang)).categoriesPage;
  const categories = await getCategories();
  // A page with nothing on it is thin: not indexed.
  return buildMetadata({ lang, path: "/categories", title: t.title, description: t.description, noindex: !categories.ok || categories.data.length === 0 });
}

export default async function CategoriesPage({ params }: PageProps<"/[lang]/categories">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const categories = await getCategories();
  const list = categories.ok ? categories.data : [];
  const named = list.map((c) => ({ name: c.name[lang] ?? c.name.ar ?? c.id, path: `/${lang}/${c.id}`, id: c.id }));

  return (
    <div className="mx-auto max-w-[1120px] space-y-6 px-4 py-10">
      <JsonLdScript
        data={[
          breadcrumbJsonLd([
            { name: dict.site.home, path: `/${lang}` },
            { name: dict.categoriesPage.heading, path: `/${lang}/categories` },
          ]),
          itemListJsonLd(named),
        ]}
      />
      <h1 className="font-heading text-[length:var(--text-h1)] font-semibold">{dict.categoriesPage.heading}</h1>
      {named.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {named.map((c) => (
            <li key={c.id}>
              <Card className="h-full">
                <Link href={c.path} className="font-heading text-lg font-semibold hover:underline">
                  {c.name}
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">{dict.home.categoriesEmpty}</p>
      )}
    </div>
  );
}
