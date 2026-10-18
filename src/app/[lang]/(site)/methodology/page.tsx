import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MethodologyView } from "@/components/site/MethodologyView";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
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
  const t = (await getDictionary(lang)).methodology;
  return <MethodologyView lang={lang} section="scores" content={t} />;
}
