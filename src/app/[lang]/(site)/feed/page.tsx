import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VideoPlayer } from "@/components/site/VideoPlayer";
import { isLocale } from "@/i18n/config";
import { fmt } from "@/i18n/format";
import { getDictionary } from "@/i18n/get-dictionary";
import { getFeed } from "@/lib/api/server";
import { buildMetadata } from "@/lib/seo/metadata";
import { entityPath } from "@/lib/urls";
import { pick } from "@/lib/pick";

export async function generateMetadata({ params }: PageProps<"/[lang]/feed">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = (await getDictionary(lang)).feed;
  const feed = await getFeed(1);
  return buildMetadata({ lang, path: "/feed", title: t.title, description: t.description, noindex: !feed.ok || feed.data.length === 0 });
}

/**
 * The full-screen vertical feed: one approved video per screen, swipe or scroll to the next, a card linking to the place. The posters, names and
 * links are in the HTML; the player loads when a video comes into view.
 */
export default async function FeedPage({ params }: PageProps<"/[lang]/feed">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.feed;
  const feed = await getFeed(10);

  if (!feed.ok || feed.data.length === 0) {
    return (
      <div className="mx-auto max-w-[1120px] space-y-4 px-4 py-10">
        <h1 className="font-heading text-[length:var(--text-h1)] font-semibold">{t.heading}</h1>
        <p className="text-muted">{feed.ok ? t.empty : t.unavailable}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="sr-only">{t.heading}</h1>
      <ul className="h-[calc(100dvh-5rem)] snap-y snap-mandatory overflow-y-auto overscroll-contain" aria-label={t.heading}>
        {feed.data.map((item) => {
          const name = pick(item.entityName, lang);
          const href = entityPath(lang, item.categoryId, { id: item.entityId, slugs: item.entitySlugs });
          return (
            <li key={item.media.id} className="relative h-full snap-start snap-always p-2">
              {item.media.playlistUrl ? (
                <VideoPlayer
                  playlistUrl={item.media.playlistUrl}
                  posterUrl={item.media.posterUrl}
                  autoPlayWhenVisible
                  className="h-full"
                  labels={{ play: t.play, pause: t.pause, mute: t.mute, unmute: t.unmute, label: fmt(t.videoOf, { name }) }}
                />
              ) : null}
              <Link href={href} className="absolute inset-x-4 bottom-20 rounded-card bg-scrim p-3 text-on-scrim">
                <span className="block text-xs">{t.visit}</span>
                <span className="block font-heading text-lg font-semibold">{name}</span>
                {item.city ? <span className="block text-sm">{item.city}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
