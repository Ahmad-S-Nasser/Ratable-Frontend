"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ShieldCheckIcon } from "@/components/ui/Icons";
import type { Locale } from "@/i18n/config";
import { fmt, formatNumber } from "@/i18n/format";
import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/http";
import type { Me, StartVerifyResponse, VerifyStatusResponse } from "@/lib/api/types";

type Dict = {
  intro: string; never: string; free: string; phoneLabel: string; phoneHelp: string; start: string; starting: string; signInNeeded: string; signIn: string;
  waitingHeading: string; waitingText: string; yourCode: string; openWhatsApp: string; expiresIn: string; checking: string; sameNumber: string; codeInstead: string;
  codeHeading: string; codeLabel: string; confirm: string; channelWhatsApp: string; channelSms: string; codeNote: string; doneHeading: string; doneText: string;
  back: string; again: string; errors: Record<string, string>;
};

type Step =
  | { name: "loading" }
  | { name: "signedOut" }
  | { name: "start"; needPhone: boolean }
  | { name: "waiting"; code: string; url: string; minutes: number }
  | { name: "code"; channel: "whatsapp" | "sms" }
  | { name: "done" };

const input = "min-h-11 w-full rounded-xl border border-border bg-background px-3";

/**
 * Verify via WhatsApp, in four screens: the offer (verify), the code to send and the wait (waiting), the alternative where we send a code, and the result
 * (verified). The default route costs nothing: the person sends one WhatsApp message with a one-time code that is already typed in. The phone is never shown
 * back, and verifying never changes any score.
 */
export function VerifyFlow({ lang, dict }: { lang: Locale; dict: Dict }) {
  const [step, setStep] = useState<Step>({ name: "loading" });
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needPhone, setNeedPhone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const me = await unwrap<Me>(api.GET("/api/me"));
      if (cancelled) return;
      if (!me.ok) return setStep({ name: "signedOut" });
      setStep(me.data.phoneVerified ? { name: "done" } : { name: "start", needPhone: false });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fail = useCallback((c: string) => setError(dict.errors[c] ?? dict.errors.unknown), [dict.errors]);

  async function begin(route: "reverse" | "code", channel?: "whatsapp" | "sms") {
    setBusy(true);
    setError(null);
    const result = await unwrap<StartVerifyResponse>(
      api.POST("/api/me/phone/verify/start", { body: { phone: phone.trim() || null, route, channel: channel ?? null } }),
    );
    setBusy(false);
    if (!result.ok) {
      if (result.error === "invalid_phone") setNeedPhone(true); // the account has no number yet: ask for one
      return fail(result.error);
    }
    if (result.data.route === "reverse" && result.data.code && result.data.whatsAppUrl) setStep({ name: "waiting", code: result.data.code, url: result.data.whatsAppUrl, minutes: Math.max(1, Math.round((new Date(result.data.expiresAt).getTime() - Date.now()) / 60_000)) });
    else setStep({ name: "code", channel: channel ?? "whatsapp" });
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    const result = await unwrap<VerifyStatusResponse>(api.POST("/api/me/phone/verify/confirm", { body: { code } }));
    setBusy(false);
    if (result.ok) setStep({ name: "done" });
    else fail(result.error);
  }

  // While waiting, look for the message every few seconds.
  const waiting = step.name === "waiting";
  useEffect(() => {
    if (!waiting) return;
    let cancelled = false;
    const timer = setInterval(() => {
      void (async () => {
        const status = await unwrap<VerifyStatusResponse>(api.GET("/api/me/phone/verify/status"));
        if (cancelled || !status.ok) return;
        if (status.data.state === "verified") setStep({ name: "done" });
        else if (status.data.state === "expired") {
          setStep({ name: "start", needPhone });
          fail("code_expired");
        }
      })();
    }, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [waiting, needPhone, fail]);

  if (step.name === "loading") return <p className="text-muted">…</p>;

  if (step.name === "signedOut")
    return (
      <Card className="space-y-4">
        <p>{dict.signInNeeded}</p>
        <Link href={`/${lang}/sign-in?next=${encodeURIComponent(`/${lang}/me/verify`)}`} className={buttonClass("primary")}>
          {dict.signIn}
        </Link>
      </Card>
    );

  if (step.name === "done")
    return (
      <Card className="space-y-4" data-testid="verify-done">
        <ShieldCheckIcon width={36} height={36} className="text-verified" />
        <h2 role="status" className="font-heading text-xl font-semibold">
          {dict.doneHeading}
        </h2>
        <p className="leading-7 text-muted">{dict.doneText}</p>
        <Link href={`/${lang}/me`} className={buttonClass("secondary")}>
          {dict.back}
        </Link>
      </Card>
    );

  if (step.name === "waiting") {
    return (
      <Card className="space-y-5" data-testid="verify-waiting">
        <h2 className="font-heading text-xl font-semibold">{dict.waitingHeading}</h2>
        <p className="leading-7 text-muted">{dict.waitingText}</p>
        <div>
          <p className="text-sm text-muted">{dict.yourCode}</p>
          <p data-testid="verify-code" dir="ltr" className="font-mono text-3xl font-bold tracking-widest text-verified">
            {step.code}
          </p>
        </div>
        <a href={step.url} target="_blank" rel="noopener noreferrer" className={`${buttonClass("primary")} w-full`}>
          {dict.openWhatsApp}
        </a>
        <p className="text-sm text-muted">{dict.sameNumber}</p>
        <p className="text-sm text-muted">{fmt(dict.expiresIn, { minutes: formatNumber(lang, step.minutes) })}</p>
        <p role="status" className="text-sm font-medium">
          {dict.checking}
        </p>
        {error ? (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        ) : null}
        <button type="button" onClick={() => void begin("code", "whatsapp")} className="text-sm font-medium text-link underline">
          {dict.codeInstead}
        </button>
      </Card>
    );
  }

  if (step.name === "code")
    return (
      <Card className="space-y-4" data-testid="verify-code-entry">
        <h2 className="font-heading text-xl font-semibold">{dict.codeHeading}</h2>
        <p className="text-sm text-muted">{dict.codeNote}</p>
        <div className="space-y-1">
          <label htmlFor="verify-code-input" className="font-medium">
            {dict.codeLabel}
          </label>
          <input id="verify-code-input" value={code} onChange={(e) => setCode(e.target.value)} dir="ltr" autoComplete="one-time-code" maxLength={12} className={input} />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        ) : null}
        <Button type="button" variant="primary" className="w-full" disabled={busy || code.replace(/[\s-]/g, "").length < 8} onClick={() => void confirm()}>
          {dict.confirm}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={() => { setStep({ name: "start", needPhone }); setError(null); setCode(""); }}>
          {dict.again}
        </Button>
      </Card>
    );

  return (
    <Card className="space-y-5" data-testid="verify-start">
      <ShieldCheckIcon width={36} height={36} className="text-verified" />
      <p className="leading-7">{dict.intro}</p>
      <ul className="list-disc space-y-1 ps-5 text-sm text-muted">
        <li>{dict.free}</li>
        <li>{dict.never}</li>
      </ul>
      {needPhone || step.needPhone ? (
        <div className="space-y-1">
          <label htmlFor="verify-phone" className="font-medium">
            {dict.phoneLabel}
          </label>
          <input id="verify-phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} className={input} aria-describedby="verify-phone-help" />
          <p id="verify-phone-help" className="text-sm text-muted">
            {dict.phoneHelp}
          </p>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      ) : null}
      <Button type="button" variant="primary" className="w-full" disabled={busy} onClick={() => void begin("reverse")}>
        {busy ? dict.starting : dict.start}
      </Button>
      <div className="flex flex-wrap gap-4 text-sm">
        <button type="button" onClick={() => void begin("code", "whatsapp")} className="font-medium text-link underline">
          {dict.codeInstead} ({dict.channelWhatsApp})
        </button>
        <button type="button" onClick={() => void begin("code", "sms")} className="font-medium text-link underline">
          {dict.channelSms}
        </button>
      </div>
    </Card>
  );
}
