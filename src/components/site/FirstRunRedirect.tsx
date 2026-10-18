"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { Locale } from "@/i18n/config";

export const ONBOARDED_KEY = "ratable-onboarded";

/**
 * The first visit shows the splash and the four onboarding steps. Once they were seen or skipped, a flag in this browser (and nothing else) says so.
 * Search engines and visitors without JavaScript never get sent anywhere: the home page is complete without this.
 */
export function FirstRunRedirect({ lang }: { lang: Locale }) {
  const router = useRouter();
  useEffect(() => {
    let done = true;
    try {
      done = window.localStorage.getItem(ONBOARDED_KEY) === "1";
    } catch {
      /* storage blocked: do not send anyone anywhere */
    }
    if (!done) router.replace(`/${lang}/welcome`);
  }, [lang, router]);
  return null;
}
