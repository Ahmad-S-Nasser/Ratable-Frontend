"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { DeviceIcon, MoonIcon, SunIcon } from "@/components/ui/Icons";
import type { Locale } from "@/i18n/config";

type Choice = "system" | "light" | "dark";
const KEY = "ratable-theme";
const EVENT = "ratable-theme-changed";

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  return () => window.removeEventListener(EVENT, callback);
}
function read(): Choice {
  const value = document.documentElement.dataset.theme;
  return value === "light" || value === "dark" ? value : "system";
}

function apply(choice: Choice) {
  if (choice === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = choice;
  try {
    if (choice === "system") window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, choice);
  } catch {
    /* the stored choice is only a convenience */
  }
  window.dispatchEvent(new Event(EVENT));
}

type Labels = { label: string; system: string; light: string; dark: string };

/** Follows the device by default; the visitor can pin light or dark. The choice is stored in this browser only. */
export function ThemeSwitch({ labels }: { labels: Labels }) {
  const current = useSyncExternalStore(subscribe, read, () => "system" as Choice);
  const options: { choice: Choice; icon: typeof SunIcon; text: string }[] = [
    { choice: "system", icon: DeviceIcon, text: labels.system },
    { choice: "light", icon: SunIcon, text: labels.light },
    { choice: "dark", icon: MoonIcon, text: labels.dark },
  ];
  return (
    <div role="group" aria-label={labels.label} className="inline-flex rounded-full border border-border bg-surface p-0.5">
      {options.map(({ choice, icon: Icon, text }) => (
        <button
          key={choice}
          type="button"
          aria-pressed={current === choice}
          aria-label={text}
          title={text}
          onClick={() => apply(choice)}
          className={`inline-flex size-9 items-center justify-center rounded-full transition-colors ${
            current === choice ? "bg-tint text-verified" : "text-muted hover:text-foreground"
          }`}
        >
          <Icon width={18} height={18} />
        </button>
      ))}
    </div>
  );
}

/** A plain link to the same page in the other language. It is a full page load, so the stored theme is applied again. */
export function LanguageSwitch({ lang, label }: { lang: Locale; label: string }) {
  const pathname = usePathname();
  const other: Locale = lang === "ar" ? "en" : "ar";
  const target = pathname.replace(/^\/(ar|en)(?=\/|$)/, `/${other}`);
  return (
    <a href={target} hrefLang={other} lang={other} className="inline-flex min-h-9 items-center rounded-full border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2">
      <span className="sr-only">{label}: </span>
      {other === "ar" ? "العربية" : "English"}
    </a>
  );
}
