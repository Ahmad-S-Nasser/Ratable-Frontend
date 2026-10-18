import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MethodologyView } from "@/components/site/MethodologyView";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { buildMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: PageProps<"/[lang]/methodology/moderation">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = (await getDictionary(lang)).methodologyModeration;
  return buildMetadata({ lang, path: "/methodology/moderation", title: t.title, description: t.description });
}

export default async function ModerationPage({ params }: PageProps<"/[lang]/methodology/moderation">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = (await getDictionary(lang)).methodologyModeration;
  return <MethodologyView lang={lang} section="moderation" content={t} />;
}
