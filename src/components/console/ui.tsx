"use client";

import { useCallback, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { ApiResult } from "@/lib/api/http";
import { useConsole } from "./context";

// ---------- icons (line icons, no emoji) ----------

const ICONS: Record<string, string> = {
  home: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  place: "M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11zM12 12a2 2 0 100-4 2 2 0 000 4z",
  file: "M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5zM14 3v5h5M9 13h6M9 17h6",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  scale: "M12 3v18M5 7h14M5 7l-3 7a4 4 0 006 0L5 7zm14 0l-3 7a4 4 0 006 0l-3-7z",
  clipboard: "M9 4h6a1 1 0 011 1v1H8V5a1 1 0 011-1zM8 6H6a1 1 0 00-1 1v13a1 1 0 001 1h12a1 1 0 001-1V7a1 1 0 00-1-1h-2M9 12h6M9 16h4",
  users: "M16 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M9.5 10a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM21 20v-2a4 4 0 00-3-3.9M16 3.1a3.5 3.5 0 010 6.8",
  spark: "M13 2L4 14h7l-1 8 9-12h-7l1-8z",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z",
  logout: "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
  sun: "M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  moon: "M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z",
  menu: "M3 6h18M3 12h18M3 18h18",
  check: "M5 12l5 5L20 7",
  x: "M6 6l12 12M18 6L6 18",
  chevron: "M9 6l6 6-6 6",
};

export function Icon({ name, className = "size-5" }: { name: keyof typeof ICONS | string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={ICONS[name] ?? ICONS.list} />
    </svg>
  );
}

// ---------- buttons, chips, cards ----------

type Variant = "primary" | "solid" | "secondary" | "danger" | "dangerSolid" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-text hover:brightness-95",
  solid: "bg-foreground text-background hover:opacity-90",
  secondary: "border border-border bg-surface text-foreground hover:bg-surface-2",
  danger: "border border-negative bg-surface text-negative hover:bg-negative-bg",
  dangerSolid: "bg-negative text-background hover:opacity-90",
  ghost: "text-foreground hover:bg-surface-2",
};

export function Button({
  variant = "secondary",
  busy = false,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean }) {
  return (
    <button
      {...rest}
      type={rest.type ?? "button"}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    >
      {busy ? <Spinner className="size-4" /> : null}
      {children}
    </button>
  );
}

export function Spinner({ className = "size-5" }: { className?: string }) {
  return <span className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} role="status" aria-label="loading" />;
}

type Tone = "neutral" | "positive" | "negative" | "warning" | "verified";
const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-foreground",
  positive: "bg-positive-bg text-foreground",
  negative: "bg-negative-bg text-negative",
  warning: "bg-warning-bg text-warning-text",
  verified: "bg-tint text-verified",
};

export function Chip({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${TONES[tone]}`}>{children}</span>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-card border border-border bg-surface p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}>{children}</section>;
}

export function Banner({ tone = "neutral", children, onClose }: { tone?: Tone; children: ReactNode; onClose?: () => void }) {
  const { t } = useConsole();
  return (
    <div role={tone === "negative" ? "alert" : "status"} className={`flex items-start justify-between gap-3 rounded-2xl px-4 py-3 text-sm ${TONES[tone]}`}>
      <div>{children}</div>
      {onClose ? (
        <button type="button" onClick={onClose} aria-label={t("common.close")} className="rounded-full p-1 hover:opacity-70">
          <Icon name="x" className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

export function PageHeader({ title, intro, right }: { title: string; intro?: string; right?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-heading text-[length:var(--text-h1)] font-semibold leading-tight">{title}</h1>
        {intro ? <p className="mt-1 max-w-2xl text-sm text-muted">{intro}</p> : null}
      </div>
      {right}
    </header>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-card border border-dashed border-border px-6 py-12 text-center text-muted">{children}</div>;
}

// ---------- forms ----------

const INPUT = "w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted";

export function Field({ label, help, children, htmlFor }: { label: string; help?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="block">
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium">{label}</label>
      {children}
      {help ? <p className="mt-1 text-xs text-muted">{help}</p> : null}
    </div>
  );
}

export function TextInput(props: React.ComponentProps<"input">) {
  return <input {...props} className={`${INPUT} min-h-11 ${props.className ?? ""}`} />;
}

export function Select(props: React.ComponentProps<"select">) {
  return <select {...props} className={`${INPUT} min-h-11 ${props.className ?? ""}`} />;
}

export function TextArea(props: React.ComponentProps<"textarea">) {
  return <textarea {...props} className={`${INPUT} min-h-24 ${props.className ?? ""}`} />;
}

/** The small panel that asks for a written reason before a decision that needs one (hide, reject, suspend, look up). */
export function ReasonForm({
  title, help, submitLabel, danger = true, busy, error, minLength = 1, onSubmit, onCancel,
}: {
  title: string; help: string; submitLabel: string; danger?: boolean; busy: boolean; error?: string | null; minLength?: number;
  onSubmit: (reason: string) => void; onCancel: () => void;
}) {
  const { t } = useConsole();
  const [reason, setReason] = useState("");
  const id = useId();

  return (
    <form
      className="mt-4 space-y-3 rounded-2xl border border-border bg-surface-2 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (reason.trim().length >= minLength) onSubmit(reason.trim());
      }}
    >
      <p className="font-medium">{title}</p>
      <Field label={t("common.reason")} help={help} htmlFor={id}>
        <TextArea id={id} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("common.reasonPlaceholder")} maxLength={500} required />
      </Field>
      {error ? <Banner tone="negative">{error}</Banner> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant={danger ? "dangerSolid" : "solid"} busy={busy} disabled={reason.trim().length < minLength}>{submitLabel}</Button>
        <Button variant="ghost" onClick={onCancel}>{t("common.cancel")}</Button>
      </div>
    </form>
  );
}

// ---------- loading data ----------

export type Loaded<T> = { status: "loading" } | { status: "error"; error: string } | { status: "ready"; data: T };

/**
 * Loads from the API when the page opens and whenever the key changes (the key stands for the inputs, for example the filters), and gives back a
 * reload function for after a decision. While the key is new the state is "loading": it is worked out from the key, not set in an effect.
 */
export function useLoad<T>(key: string, load: () => Promise<ApiResult<T>>): [Loaded<T>, () => void] {
  const [tick, setTick] = useState(0);
  const [done, setDone] = useState<{ key: string; tick: number; value: Loaded<T> } | null>(null);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    let cancelled = false;
    void loadRef.current().then((result) => {
      if (cancelled) return;
      setDone({ key, tick, value: result.ok ? { status: "ready", data: result.data } : { status: "error", error: result.status === 0 ? "network" : result.error } });
    });
    return () => {
      cancelled = true;
    };
  }, [key, tick]);

  const value: Loaded<T> = done && done.key === key && done.tick === tick ? done.value : { status: "loading" };
  return [value, () => setTick((n) => n + 1)];
}

/** Turns an API error code into a sentence. The function is stable between renders, so effects that use it do not run again and again. */
export function useErrorText() {
  const { t, has } = useConsole();
  return useCallback((code: string) => (code === "network" ? t("common.network") : has(`errors.${code}`) ? t(`errors.${code}`) : t("common.error")), [t, has]);
}

export function LoadState<T>({ state, reload, children }: { state: Loaded<T>; reload: () => void; children: (data: T) => ReactNode }) {
  const { t } = useConsole();
  const errorText = useErrorText();
  if (state.status === "loading") return <div className="flex justify-center py-16 text-muted"><Spinner /></div>;
  if (state.status === "error") {
    return (
      <div className="space-y-3">
        <Banner tone="negative">{errorText(state.error)}</Banner>
        <Button onClick={reload}>{t("common.retry")}</Button>
      </div>
    );
  }
  return <>{children(state.data)}</>;
}

/** Runs one decision: shows it as busy, turns an API error into a readable message, and calls onDone on success. */
export function useAction() {
  const errorText = useErrorText();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async <T,>(call: () => Promise<ApiResult<T>>, onDone: (data: T) => void | Promise<void>, onFail?: (code: string) => void) => {
      setBusy(true);
      setError(null);
      const result = await call();
      setBusy(false);
      if (result.ok) {
        await onDone(result.data);
      } else {
        setError(errorText(result.status === 0 ? "network" : result.error));
        onFail?.(result.error);
      }
    },
    [errorText],
  );

  return { busy, error, run, clearError: () => setError(null) };
}
