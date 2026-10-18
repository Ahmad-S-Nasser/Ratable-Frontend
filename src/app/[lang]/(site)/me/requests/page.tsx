import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MyRequests } from "@/components/site/MyRequests";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { buildMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: PageProps<"/[lang]/me/requests">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = (await getDictionary(lang)).contact.mine;
  return buildMetadata({ lang, path: "/me/requests", title: t.title, description: t.description, noindex: true });
}

export default async function RequestsPage({ params }: PageProps<"/[lang]/me/requests">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const { title, heading, intro, ...rest } = (await getDictionary(lang)).contact.mine;
  void title;
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <h1 className="font-heading text-[length:var(--text-h1)] font-semibold">{heading}</h1>
      <p className="text-muted">{intro}</p>
      <MyRequests lang={lang} dict={rest as React.ComponentProps<typeof MyRequests>["dict"]} />
    </div>
  );
}
