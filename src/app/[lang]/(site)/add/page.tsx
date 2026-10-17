import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AddPlaceForm } from "@/components/site/AddPlaceForm";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getCategories } from "@/lib/api/server";
import { buildMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: PageProps<"/[lang]/add">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = (await getDictionary(lang)).add;
  // A form is not offered to search engines.
  return buildMetadata({ lang, path: "/add", title: t.title, description: t.description, noindex: true });
}

export default async function AddPage({ params, searchParams }: PageProps<"/[lang]/add">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const categories = await getCategories();
  const raw = (await searchParams).category;
  const wanted = Array.isArray(raw) ? raw[0] : raw;
  const list = categories.ok ? categories.data.map((c) => ({ id: c.id, name: c.name[lang] ?? c.name.ar ?? c.id })) : [];

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <h1 className="font-heading text-[length:var(--text-h1)] font-semibold">{dict.add.heading}</h1>
      <AddPlaceForm lang={lang} categories={list} initialCategory={list.some((c) => c.id === wanted) ? (wanted as string) : ""} dict={dict.add} />
    </div>
  );
}
