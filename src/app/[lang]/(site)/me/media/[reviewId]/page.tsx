import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MediaPageView } from "@/components/site/MediaPageView";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { buildMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: PageProps<"/[lang]/me/media/[reviewId]">): Promise<Metadata> {
  const { lang, reviewId } = await params;
  if (!isLocale(lang)) return {};
  const t = (await getDictionary(lang)).media;
  return buildMetadata({ lang, path: `/me/media/${reviewId}`, title: t.title, description: t.intro, noindex: true });
}

export default async function MediaPage({ params }: PageProps<"/[lang]/me/media/[reviewId]">) {
  const { lang, reviewId } = await params;
  if (!isLocale(lang) || !/^[0-9a-f]{24}$/i.test(reviewId)) notFound();
  const dict = await getDictionary(lang);
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <h1 className="font-heading text-[length:var(--text-h1)] font-semibold">{dict.media.heading}</h1>
      <MediaPageView
        lang={lang}
        reviewId={reviewId}
        dict={{ ...dict.media }}
        texts={{ loading: dict.account.loading, signInNeeded: dict.account.signInNeeded, signIn: dict.signIn.heading, notFound: dict.proof.notFound }}
      />
    </div>
  );
}
