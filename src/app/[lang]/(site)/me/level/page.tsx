import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LevelPanel } from "@/components/site/LevelPanel";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { buildMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: PageProps<"/[lang]/me/level">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = (await getDictionary(lang)).level;
  return buildMetadata({ lang, path: "/me/level", title: t.title, description: t.title, noindex: true });
}

export default async function LevelPage({ params }: PageProps<"/[lang]/me/level">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const { heading, title, ...rest } = (await getDictionary(lang)).level;
  void title;
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <h1 className="font-heading text-[length:var(--text-h1)] font-semibold">{heading}</h1>
      <LevelPanel lang={lang} dict={rest as React.ComponentProps<typeof LevelPanel>["dict"]} />
    </div>
  );
}
