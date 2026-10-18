"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import type { Locale } from "@/i18n/config";
import { fmt, formatNumber } from "@/i18n/format";
import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/http";
import type { RewardsConfigView, RewardsView } from "@/lib/api/types";
import { RankUpDialog } from "./LevelPanel";
import { pick } from "@/lib/pick";

type Dict = {
  heading: string; text: string; written: string; photo: string; video: string; verified: string; note: string; yourLevel: string;
};

/**
 * What a person sees right after saving a review: which points they will earn once it is published (never a promise about the score, and never more for a
 * positive or negative opinion), their level now, and the rank-up moment if a rank was just reached.
 */
export function AfterPosting({
  lang, hasText, photos, videos, dict, rankUp, how, level,
}: { lang: Locale; hasText: boolean; photos: number; videos: number; dict: Dict; rankUp: { heading: string; text: string; close: string }; how: string; level: string }) {
  const [config, setConfig] = useState<RewardsConfigView | null>(null);
  const [me, setMe] = useState<RewardsView | null>(null);
  const [showUp, setShowUp] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [c, r] = await Promise.all([unwrap<RewardsConfigView>(api.GET("/api/rewards/config")), unwrap<RewardsView>(api.GET("/api/me/rewards"))]);
      if (cancelled) return;
      setConfig(c.ok ? c.data : null);
      setMe(r.ok ? r.data : null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!config) return null;
  const p = config.points;
  const lines = [
    hasText ? fmt(dict.written, { n: formatNumber(lang, p.written_review ?? 0) }) : null,
    photos > 0 ? fmt(dict.photo, { n: formatNumber(lang, (p.photo ?? 0) * photos) }) : null,
    videos > 0 ? fmt(dict.video, { n: formatNumber(lang, (p.video ?? 0) * videos) }) : null,
  ].filter(Boolean) as string[];

  async function closeUp() {
    setShowUp(false);
    if (me) await unwrap(api.POST("/api/me/rewards/seen", { body: { rankId: me.rank.id } }));
  }

  return (
    <Card className="space-y-3" data-testid="after-posting">
      {me?.rankUp && showUp ? <RankUpDialog lang={lang} up={me.rankUp} dict={rankUp} onClose={() => void closeUp()} /> : null}
      <p className="text-sm text-muted">{dict.text}</p>
      <ul className="list-disc space-y-1 ps-5">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <p className="text-sm text-muted">{dict.note}</p>
      {me ? (
        <p className="text-sm font-medium">
          {fmt(dict.yourLevel, { rank: pick(me.rank.title, lang), points: formatNumber(lang, me.points) })}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-4 text-sm">
        <Link href={`/${lang}/me/level`} className="font-medium text-link underline">
          {level}
        </Link>
        <Link href={`/${lang}/points`} className="font-medium text-link underline">
          {how}
        </Link>
      </div>
    </Card>
  );
}
