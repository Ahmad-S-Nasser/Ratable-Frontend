import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProofForm } from "@/components/site/ProofForm";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { buildMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: PageProps<"/[lang]/me/proof/[reviewId]">): Promise<Metadata> {
  const { lang, reviewId } = await params;
  if (!isLocale(lang)) return {};
  const t = (await getDictionary(lang)).proof;
  return buildMetadata({ lang, path: `/me/proof/${reviewId}`, title: t.title, description: t.intro, noindex: true });
}

export default async function ProofPage({ params }: PageProps<"/[lang]/me/proof/[reviewId]">) {
  const { lang, reviewId } = await params;
  if (!isLocale(lang) || !/^[0-9a-f]{24}$/i.test(reviewId)) notFound();
  const dict = await getDictionary(lang);
  const { title, heading, intro, ...rest } = dict.proof;
  void title;
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <h1 className="font-heading text-[length:var(--text-h1)] font-semibold">{heading}</h1>
      <p className="text-muted">{intro}</p>
      <ProofForm lang={lang} reviewId={reviewId} dict={{ ...rest, signInNeeded: dict.account.signInNeeded, signIn: dict.signIn.heading, loading: dict.account.loading }} />
    </div>
  );
}
