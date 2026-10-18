"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/http";
import { useConsole } from "./context";
import { Banner, Button, Card, Field, Icon, Spinner, TextInput } from "./ui";

type NavItem = { path: string; label: string; icon: string; adminOnly?: boolean };

const MODERATION: NavItem[] = [
  { path: "", label: "nav.overview", icon: "home" },
  { path: "/reviews", label: "nav.reviews", icon: "list" },
  { path: "/entities", label: "nav.entities", icon: "place" },
  { path: "/proofs", label: "nav.proofs", icon: "file" },
  { path: "/media", label: "nav.media", icon: "eye" },
  { path: "/reports", label: "nav.reports", icon: "flag" },
  { path: "/disputes", label: "nav.disputes", icon: "scale" },
];

const ADMIN: NavItem[] = [
  { path: "/audit", label: "nav.audit", icon: "clipboard", adminOnly: true },
  { path: "/users", label: "nav.users", icon: "users", adminOnly: true },
  { path: "/ai", label: "nav.ai", icon: "spark", adminOnly: true },
  { path: "/lookup", label: "nav.lookup", icon: "eye", adminOnly: true },
];

/** The frame of the console: it asks for sign-in first, refuses anyone who is not staff, and only then shows the navigation and the page. */
export function Shell({ children }: { children: ReactNode }) {
  const { meState, isStaff } = useConsole();

  if (meState === "loading") return <div className="grid min-h-screen place-items-center text-muted"><Spinner /></div>;
  if (meState === "signedOut") return <SignIn />;
  if (!isStaff) return <NoAccess />;
  return <Frame>{children}</Frame>;
}

function Frame({ children }: { children: ReactNode }) {
  const { t, lang, href, isAdmin, signOut, theme, setTheme, me } = useConsole();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const other = lang === "ar" ? "en" : "ar";

  const isActive = (path: string) => {
    const target = href(path);
    return path === "" ? pathname === target : pathname.startsWith(target);
  };

  const link = (item: NavItem) => (
    <Link
      key={item.path}
      href={href(item.path)}
      onClick={() => setOpen(false)}
      aria-current={isActive(item.path) ? "page" : undefined}
      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${isActive(item.path) ? "bg-tint text-verified" : "text-foreground hover:bg-surface-2"}`}
    >
      <Icon name={item.icon} />
      {t(item.label)}
    </Link>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="border-border bg-surface lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-e">
        <div className="flex items-center justify-between gap-3 p-4 lg:block">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={theme === "dark" ? "/brand/ratable-mark-lime.svg" : "/brand/ratable-mark-ink.svg"} alt="" className="size-9" />
            <div>
              <div className="font-heading text-base font-semibold leading-tight">{t("title")}</div>
              <div className="text-xs text-muted">{t("signin.signedInAs")}{me?.profile?.displayName ? `: ${me.profile.displayName}` : ""}</div>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border lg:hidden"
            aria-label={t("nav.menu")}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <Icon name="menu" />
          </button>
        </div>
        <nav className={`${open ? "block" : "hidden"} space-y-6 px-3 pb-6 lg:block`} aria-label={t("title")}>
          <div>
            <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wide text-muted">{t("nav.moderation")}</p>
            <div className="space-y-1">{MODERATION.map(link)}</div>
          </div>
          {isAdmin ? (
            <div>
              <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wide text-muted">{t("nav.administration")}</p>
              <div className="space-y-1">{ADMIN.map(link)}</div>
            </div>
          ) : null}
          <div className="space-y-2 border-t border-border pt-4">
            <div className="flex gap-2 px-1">
              <Link href={`/${other}/console`} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-border text-sm" lang={other}>
                {t("common.switchLanguage")}
              </Link>
              <button
                type="button"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-border text-sm"
                aria-label={t("common.theme")}
              >
                <Icon name={theme === "dark" ? "sun" : "moon"} className="size-4" />
                {theme === "dark" ? t("common.light") : t("common.dark")}
              </button>
            </div>
            <button type="button" onClick={() => void signOut()} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm text-muted hover:bg-surface-2">
              <Icon name="logout" />
              {t("nav.signOut")}
            </button>
          </div>
        </nav>
      </aside>
      <main className="mx-auto w-full max-w-[1120px] px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}

function NoAccess() {
  const { t, signOut } = useConsole();
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <Card className="max-w-md space-y-4 text-center">
        <h1 className="font-heading text-2xl font-semibold">{t("signin.noAccessHeading")}</h1>
        <p className="text-muted">{t("signin.noAccess")}</p>
        <Button onClick={() => void signOut()}>{t("nav.signOut")}</Button>
      </Card>
    </div>
  );
}

function SignIn() {
  const { t, refreshMe, has } = useConsole();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fail = (code: string) => setError(has(`signin.${code}`) ? t(`signin.${code}`) : code === "network" ? t("common.network") : t("common.error"));

  async function sendCode() {
    setBusy(true);
    setError(null);
    const result = await unwrap(api.POST("/api/auth/otp/request", { body: { phone } }));
    setBusy(false);
    if (result.ok) setStep("code");
    else fail(result.status === 0 ? "network" : result.error);
  }

  async function verify() {
    setBusy(true);
    setError(null);
    const result = await unwrap(api.POST("/api/auth/otp/verify", { body: { phone, code, client: "web" } }));
    setBusy(false);
    if (result.ok) await refreshMe();
    else fail(result.status === 0 ? "network" : result.error);
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-md space-y-5">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold">{t("signin.heading")}</h1>
          <p className="text-sm text-muted">{t("signin.intro")}</p>
        </div>
        {step === "phone" ? (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void sendCode(); }}>
            <Field label={t("signin.phone")} help={t("signin.phoneHelp")} htmlFor="phone">
              <TextInput id="phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </Field>
            {error ? <Banner tone="negative">{error}</Banner> : null}
            <Button type="submit" variant="primary" busy={busy} disabled={phone.trim().length < 8} className="w-full">{t("signin.sendCode")}</Button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void verify(); }}>
            <Field label={t("signin.code")} help={t("signin.codeHelp")} htmlFor="code">
              <TextInput id="code" inputMode="numeric" autoComplete="one-time-code" dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} maxLength={10} required />
            </Field>
            {error ? <Banner tone="negative">{error}</Banner> : null}
            <Button type="submit" variant="primary" busy={busy} disabled={code.trim().length < 4} className="w-full">{t("signin.verify")}</Button>
            <Button variant="ghost" className="w-full" onClick={() => { setStep("phone"); setCode(""); setError(null); }}>{t("signin.back")}</Button>
          </form>
        )}
      </Card>
    </div>
  );
}
