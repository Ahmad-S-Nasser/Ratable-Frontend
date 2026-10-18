import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Onboarding } from "@/components/site/Onboarding";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getCategories } from "@/lib/api/server";
import { getAreas } from "@/lib/api/server";
import { buildMetadata } from "@/lib/seo/metadata";
import { pick } from "@/lib/pick";

export async function generateMetadata({ params }: PageProps<"/[lang]/welcome">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = (await getDictionary(lang)).onboarding;
  return buildMetadata({ lang, path: "/welcome", title: t.title, description: t.description, noindex: true });
}

/** The first-run flow: the splash, then four steps. It has no header or footer, so nothing competes with the one button. */
export default async function WelcomePage({ params }: PageProps<"/[lang]/welcome">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const [categories, areas] = await Promise.all([getCategories(), getAreas()]);

  return (
    <Onboarding
      lang={lang}
      categories={(categories.ok ? categories.data : []).map((c) => ({ id: c.id, name: pick(c.name, lang, c.id) }))}
      areas={(areas.ok ? areas.data : []).map((a) => ({ id: a.id, name: pick(a.name, lang, a.id) }))}
      dict={dict.onboarding}
    />
  );
}
