import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AccountPanel } from "@/components/site/AccountPanel";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { buildMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: PageProps<"/[lang]/me">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = (await getDictionary(lang)).account;
  return buildMetadata({ lang, path: "/me", title: t.title, description: t.title, noindex: true });
}

export default async function MePage({ params }: PageProps<"/[lang]/me">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = (await getDictionary(lang)).account;
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <h1 className="font-heading text-[length:var(--text-h1)] font-semibold">{dict.heading}</h1>
      <AccountPanel lang={lang} dict={{ ...dict, addMedia: (await getDictionary(lang)).media.addTo, signIn: (await getDictionary(lang)).signIn.heading }} />
    </div>
  );
}
