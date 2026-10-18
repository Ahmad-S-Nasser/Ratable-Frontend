"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/site/Logo";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EyeOffIcon, ScaleIcon, ShieldCheckIcon, StarIcon } from "@/components/ui/Icons";
import type { Locale } from "@/i18n/config";
import { fmt } from "@/i18n/format";
import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/http";
import type { Me } from "@/lib/api/types";
import { ONBOARDED_KEY } from "./FirstRunRedirect";

type Dict = {
  splashTagline: string; skip: string; next: string; start: string; progress: string;
  steps: { title: string; text: string }[];
  interests: string; interestsNeed: string; city: string; cityPlaceholder: string; errors: Record<string, string>;
};

const MIN_INTERESTS = 3;
const ICONS = [ShieldCheckIcon, ScaleIcon, StarIcon, EyeOffIcon];
export const PREFS_KEY = "ratable-prefs";

/**
 * The splash and four onboarding steps (real people, verdicts, points and badges, interests and city), with Skip always available, progress dots and one
 * lime button. The last step needs at least 3 interests and a city, and saves them to the profile when the person is signed in (otherwise only in this
 * browser). Permissions are never asked here: location is asked later, in context.
 */
export function Onboarding({ lang, categories, areas, dict }: { lang: Locale; categories: { id: string; name: string }[]; areas: { id: string; name: string }[]; dict: Dict }) {
  const router = useRouter();
  const [splash, setSplash] = useState(true);
  const [step, setStep] = useState(0);
  const [interests, setInterests] = useState<string[]>([]);
  const [area, setArea] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSplash(false), 1100);
    return () => clearTimeout(timer);
  }, []);

  function finish() {
    try {
      window.localStorage.setItem(ONBOARDED_KEY, "1");
    } catch {
      /* the flag is only a convenience */
    }
    router.replace(`/${lang}`);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify({ interests, area }));
    } catch {
      /* optional */
    }
    const me = await unwrap<Me>(api.GET("/api/me"));
    if (me.ok) {
      const saved = await unwrap<Me>(api.PUT("/api/me/profile", { body: { displayName: me.data.profile.displayName, avatarUrl: me.data.profile.avatarUrl, interests, areaId: area } }));
      if (!saved.ok) {
        setBusy(false);
        return setError(dict.errors[saved.error] ?? dict.errors.unknown);
      }
    }
    finish();
  }

  const last = step === dict.steps.length - 1;
  const canStart = interests.length >= MIN_INTERESTS && area !== "";
  const Icon = ICONS[step] ?? ShieldCheckIcon;

  if (splash)
    return (
      <div className="grid min-h-dvh place-items-center bg-background px-6 text-center" data-testid="splash">
        <div className="space-y-4">
          <div className="mx-auto w-fit">
            <Logo lang={lang} />
          </div>
          <p className="text-muted">{dict.splashTagline}</p>
        </div>
      </div>
    );

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-5 py-6">
      <div className="flex items-center justify-between">
        <Logo lang={lang} />
        <button type="button" onClick={finish} className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium text-muted hover:bg-surface-2">
          {dict.skip}
        </button>
      </div>

      <main className="flex flex-1 flex-col justify-center gap-6" aria-live="polite">
        <Icon width={44} height={44} className="text-verified" />
        <h1 className="font-heading text-[length:var(--text-h1)] font-semibold">{dict.steps[step].title}</h1>
        <p className="text-lg leading-8 text-muted">{dict.steps[step].text}</p>

        {last ? (
          <Card className="space-y-5">
            <fieldset className="space-y-2">
              <legend className="font-medium">
                {dict.interests} <span className="text-sm text-muted">({fmt(dict.interestsNeed, { n: MIN_INTERESTS })})</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <label key={c.id} className="cursor-pointer">
                    <input
                      type="checkbox"
                      checked={interests.includes(c.id)}
                      onChange={() => setInterests((all) => (all.includes(c.id) ? all.filter((x) => x !== c.id) : [...all, c.id]))}
                      className="peer sr-only"
                    />
                    <span className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-sm font-medium peer-checked:border-verified peer-checked:bg-tint peer-checked:text-verified peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-verified">
                      {c.name}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="space-y-1">
              <label htmlFor="onboarding-city" className="font-medium">
                {dict.city}
              </label>
              <select id="onboarding-city" value={area} onChange={(e) => setArea(e.target.value)} className="min-h-11 w-full rounded-xl border border-border bg-background px-3">
                <option value="">{dict.cityPlaceholder}</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            {error ? (
              <p role="alert" className="text-sm text-negative">
                {error}
              </p>
            ) : null}
          </Card>
        ) : null}
      </main>

      <footer className="space-y-4">
        <ol className="flex justify-center gap-2" aria-label={fmt(dict.progress, { n: step + 1, total: dict.steps.length })}>
          {dict.steps.map((_, i) => (
            <li key={i} aria-current={i === step ? "step" : undefined} className={`h-2 rounded-full transition-all ${i === step ? "w-6 bg-verified" : "w-2 bg-border"}`} />
          ))}
        </ol>
        <Button type="button" variant="primary" className="w-full" disabled={busy || (last && !canStart)} onClick={() => (last ? void save() : setStep(step + 1))}>
          {last ? dict.start : dict.next}
        </Button>
      </footer>
    </div>
  );
}
