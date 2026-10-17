"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/http";
import type { Me } from "@/lib/api/types";
import type { Locale } from "@/i18n/config";

type Vars = Record<string, string | number>;
type Theme = "light" | "dark";
type MeState = "loading" | "signedOut" | "ready";

type ConsoleContextValue = {
  lang: Locale;
  /** Looks a string up by path, for example t("queue.publish"). A missing path shows the path itself, so it is easy to spot. */
  t: (path: string, vars?: Vars) => string;
  has: (path: string) => boolean;
  date: (iso: string | null | undefined, withTime?: boolean) => string;
  number: (n: number) => string;
  href: (path: string) => string;
  me: Me | null;
  meState: MeState;
  isAdmin: boolean;
  isStaff: boolean;
  refreshMe: () => Promise<void>;
  signOut: () => Promise<void>;
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const Ctx = createContext<ConsoleContextValue | null>(null);

export function useConsole(): ConsoleContextValue {
  const value = useContext(Ctx);
  if (!value) throw new Error("useConsole must be used inside ConsoleProvider");
  return value;
}

const THEME_KEY = "ratable-console-theme";
const THEME_EVENT = "ratable-console-theme-changed";

/** The theme lives on the page itself (data-theme on the html element), so it is read from there and nothing has to be set in an effect. */
function subscribeTheme(callback: () => void) {
  window.addEventListener(THEME_EVENT, callback);
  return () => window.removeEventListener(THEME_EVENT, callback);
}
const readTheme = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");
function lookup(dict: unknown, path: string): string | undefined {
  let node: unknown = dict;
  for (const part of path.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

export function ConsoleProvider({ lang, dict, children }: { lang: Locale; dict: unknown; children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [meState, setMeState] = useState<MeState>("loading");
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "light" as Theme);

  const refreshMe = useCallback(async () => {
    const result = await unwrap<Me>(api.GET("/api/me"));
    if (result.ok) {
      setMe(result.data);
      setMeState("ready");
    } else {
      setMe(null);
      setMeState("signedOut");
    }
  }, []);

  useEffect(() => {
    // Reads the session once on load. State is set after the await, never synchronously in the effect.
    let cancelled = false;
    void (async () => {
      const result = await unwrap<Me>(api.GET("/api/me"));
      if (cancelled) return;
      setMe(result.ok ? result.data : null);
      setMeState(result.ok ? "ready" : "signedOut");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Opening the console in another language replaces the whole page, and with it the theme the first script set: put the saved theme back.
    let saved: Theme = "light";
    try {
      saved = window.localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
    } catch {
      /* the stored choice is only a convenience */
    }
    if (document.documentElement.dataset.theme !== saved) {
      document.documentElement.dataset.theme = saved;
      window.dispatchEvent(new Event(THEME_EVENT));
    }
  }, [lang]);

  const setTheme = useCallback((next: Theme) => {
    document.documentElement.dataset.theme = next;
    window.dispatchEvent(new Event(THEME_EVENT));
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      /* the stored choice is only a convenience */
    }
  }, []);

  const signOut = useCallback(async () => {
    await unwrap<void>(api.POST("/api/auth/logout"));
    setMe(null);
    setMeState("signedOut");
  }, []);

  const value = useMemo<ConsoleContextValue>(() => {
    const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en-GB";
    const dateOnly = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
    const dateTime = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
    const numbers = new Intl.NumberFormat(locale);
    const roles = me?.roles ?? [];
    return {
      lang,
      t: (path, vars) => {
        const text = lookup(dict, path) ?? path;
        return vars ? text.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`)) : text;
      },
      has: (path) => lookup(dict, path) !== undefined,
      date: (iso, withTime = true) => (iso ? (withTime ? dateTime : dateOnly).format(new Date(iso)) : ""),
      number: (n) => numbers.format(n),
      href: (path) => `/${lang}/console${path}`,
      me,
      meState,
      isAdmin: roles.includes("Admin"),
      isStaff: roles.includes("Admin") || roles.includes("Moderator"),
      refreshMe,
      signOut,
      theme,
      setTheme,
    };
  }, [lang, dict, me, meState, refreshMe, signOut, theme, setTheme]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
