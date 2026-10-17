"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/http";

type Dict = {
  heading: string; intro: string; phone: string; phoneHelp: string; sendCode: string; code: string; codeHelp: string; verify: string;
  back: string; sending: string; errors: Record<string, string>;
};

const input = "min-h-11 w-full rounded-xl border border-border bg-background px-3";

/** Phone number, then the code we send. On success the browser gets the httpOnly session cookie and the page reloads at the next address. */
export function SignInForm({ next, dict }: { next: string; dict: Dict }) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fail = (c: string) => setError(dict.errors[c] ?? dict.errors.unknown);
  const cleanPhone = () => phone.replace(/[\s()-]/g, "");

  async function sendCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await unwrap(api.POST("/api/auth/otp/request", { body: { phone: cleanPhone() } }));
    setBusy(false);
    if (result.ok) setStep("code");
    else fail(result.error);
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await unwrap(api.POST("/api/auth/otp/verify", { body: { phone: cleanPhone(), code: code.trim(), client: "web" } }));
    if (result.ok) {
      // A full load, so the header and every page read the new session.
      window.location.assign(next);
      return;
    }
    setBusy(false);
    fail(result.error);
  }

  return (
    <Card className="w-full max-w-md space-y-5">
      <p className="text-muted">{dict.intro}</p>
      {step === "phone" ? (
        <form className="space-y-4" onSubmit={sendCode} noValidate>
          <div className="space-y-1">
            <label htmlFor="signin-phone" className="font-medium">
              {dict.phone}
            </label>
            <input id="signin-phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} className={input} aria-describedby="signin-phone-help" />
            <p id="signin-phone-help" className="text-sm text-muted">
              {dict.phoneHelp}
            </p>
          </div>
          {error ? (
            <p role="alert" className="rounded-xl bg-negative-bg p-3 text-sm text-negative">
              {error}
            </p>
          ) : null}
          <Button type="submit" variant="primary" disabled={busy || cleanPhone().length < 8} className="w-full">
            {busy ? dict.sending : dict.sendCode}
          </Button>
        </form>
      ) : (
        <form className="space-y-4" onSubmit={verify} noValidate>
          <div className="space-y-1">
            <label htmlFor="signin-code" className="font-medium">
              {dict.code}
            </label>
            <input id="signin-code" inputMode="numeric" autoComplete="one-time-code" dir="ltr" maxLength={10} value={code} onChange={(e) => setCode(e.target.value)} className={input} aria-describedby="signin-code-help" />
            <p id="signin-code-help" className="text-sm text-muted">
              {dict.codeHelp}
            </p>
          </div>
          {error ? (
            <p role="alert" className="rounded-xl bg-negative-bg p-3 text-sm text-negative">
              {error}
            </p>
          ) : null}
          <Button type="submit" variant="primary" disabled={busy || code.trim().length < 4} className="w-full">
            {dict.verify}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              setStep("phone");
              setCode("");
              setError(null);
            }}
          >
            {dict.back}
          </Button>
        </form>
      )}
    </Card>
  );
}
