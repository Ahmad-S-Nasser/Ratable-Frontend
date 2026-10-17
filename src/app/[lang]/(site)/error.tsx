"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { buttonClass } from "@/components/ui/Button";

type Texts = { title: string; text: string; retry: string; home: string };

/** What a visitor sees when a page fails to load. The wording comes from the translation files (loaded only when an error happens). */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const lang = usePathname().startsWith("/en") ? "en" : "ar";
  const [texts, setTexts] = useState<Texts | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const dict = lang === "en" ? (await import("@/i18n/dictionaries/en.json")).default : (await import("@/i18n/dictionaries/ar.json")).default;
      if (!cancelled) setTexts(dict.errorPage);
    })();
    return () => {
      cancelled = true;
    };
  }, [lang]);

  if (!texts) return null;
  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-16 text-center">
      <h1 className="font-heading text-[length:var(--text-h1)] font-semibold">{texts.title}</h1>
      <p className="text-muted">{texts.text}</p>
      <div className="flex justify-center gap-3">
        <button type="button" onClick={reset} className={buttonClass("primary")}>
          {texts.retry}
        </button>
        <Link href={`/${lang}`} className={buttonClass("secondary")}>
          {texts.home}
        </Link>
      </div>
    </div>
  );
}
