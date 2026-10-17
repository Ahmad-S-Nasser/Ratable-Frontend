"use client";

import { useEffect } from "react";

/** Registers the small service worker that makes the site installable. Production only: it would get in the way of the dev server. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      /* installing the app is an extra; the site works without it */
    });
  }, []);
  return null;
}
