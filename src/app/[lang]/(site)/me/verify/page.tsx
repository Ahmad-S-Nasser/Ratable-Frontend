import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VerifyFlow } from "@/components/site/VerifyFlow";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { buildMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: PageProps<"/[lang]/me/verify">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = (await getDictionary(lang)).verifyPhone;
  return buildMetadata({ lang, path: "/me/verify", title: t.title, description: t.intro, noindex: true });
}

export default async function VerifyPage({ params }: PageProps<"/[lang]/me/verify">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const { title, heading, ...rest } = (await getDictionary(lang)).verifyPhone;
  void title;
  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-10">
      <h1 className="font-heading text-[length:var(--text-h1)] font-semibold">{heading}</h1>
      <VerifyFlow lang={lang} dict={rest as React.ComponentProps<typeof VerifyFlow>["dict"]} />
    </div>
  );
}
