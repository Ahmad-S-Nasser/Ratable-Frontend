"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/http";
import type { SignInProviders, SignedIn } from "@/lib/api/types";

type Dict = { or: string; google: string; apple: string; phoneHeading: string; loadFailed: string; errors: Record<string, string> };

const GOOGLE_SCRIPT = "https://accounts.google.com/gsi/client";
const APPLE_SCRIPT = "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";

type GoogleId = { initialize: (o: { client_id: string; callback: (r: { credential: string }) => void }) => void; prompt: (cb?: (n: { isNotDisplayed?: () => boolean; isSkippedMoment?: () => boolean }) => void) => void };
type AppleAuth = { init: (o: { clientId: string; scope: string; redirectURI: string; usePopup: boolean }) => void; signIn: () => Promise<{ authorization: { id_token: string } }> };
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
    AppleID?: { auth: AppleAuth };
  }
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("load"));
    document.head.appendChild(script);
  });
}

/**
 * "Continue with Google" and "Continue with Apple". A button is shown only when the API says that provider is set up. The provider's own script is loaded
 * only when the person presses its button (nothing from Google or Apple loads on a page view), the provider gives us an ID token, and the API checks it
 * against the provider's published keys before signing anyone in. Nothing but the provider's account id is kept.
 */
export function ExternalSignIn({ next, dict }: { next: string; dict: Dict }) {
  const [providers, setProviders] = useState<SignInProviders | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await unwrap<SignInProviders>(api.GET("/api/auth/providers"));
      if (!cancelled && result.ok) setProviders(result.data);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function finish(provider: "google" | "apple", idToken: string) {
    const result = await unwrap<SignedIn>(api.POST("/api/auth/external", { body: { provider, idToken, client: "web" } }));
    if (result.ok) {
      window.location.assign(next); // a full load, so the header and every page read the new session
      return;
    }
    setBusy(false);
    setError(dict.errors[result.error] ?? dict.errors.unknown);
  }

  async function google(clientId: string) {
    setError(null);
    setBusy(true);
    try {
      await loadScript(GOOGLE_SCRIPT);
      const id = window.google?.accounts.id;
      if (!id) throw new Error("load");
      id.initialize({ client_id: clientId, callback: (r) => void finish("google", r.credential) });
      id.prompt((n) => {
        if (n.isNotDisplayed?.() || n.isSkippedMoment?.()) setBusy(false);
      });
    } catch {
      setBusy(false);
      setError(dict.loadFailed);
    }
  }

  async function apple(clientId: string) {
    setError(null);
    setBusy(true);
    try {
      await loadScript(APPLE_SCRIPT);
      const auth = window.AppleID?.auth;
      if (!auth) throw new Error("load");
      auth.init({ clientId, scope: "", redirectURI: window.location.origin, usePopup: true });
      const response = await auth.signIn();
      await finish("apple", response.authorization.id_token);
    } catch {
      setBusy(false);
      setError(dict.loadFailed);
    }
  }

  if (!providers || (!providers.googleClientId && !providers.appleClientId)) return null;
  return (
    <div className="w-full max-w-md space-y-3" data-testid="external-sign-in">
      {providers.googleClientId ? (
        <Button type="button" variant="secondary" className="w-full" disabled={busy} onClick={() => void google(providers.googleClientId as string)}>
          {dict.google}
        </Button>
      ) : null}
      {providers.appleClientId ? (
        <Button type="button" variant="secondary" className="w-full" disabled={busy} onClick={() => void apple(providers.appleClientId as string)}>
          {dict.apple}
        </Button>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      ) : null}
      <p className="text-center text-sm text-muted">{dict.or}</p>
    </div>
  );
}
