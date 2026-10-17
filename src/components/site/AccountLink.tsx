"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Locale } from "@/i18n/config";
import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/http";

/** "Sign in" for a visitor and "My account" once signed in. The header is rendered on the server, so this part fills in after load. */
export function AccountLink({ lang, signIn, me }: { lang: Locale; signIn: string; me: string }) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await unwrap(api.GET("/api/me"));
      if (!cancelled) setSignedIn(result.ok);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Link
      href={signedIn ? `/${lang}/me` : `/${lang}/sign-in`}
      className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium hover:bg-surface-2"
    >
      {signedIn ? me : signIn}
    </Link>
  );
}
