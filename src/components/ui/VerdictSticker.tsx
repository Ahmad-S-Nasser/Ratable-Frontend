export type VerdictKind = "worth" | "not_worth" | "hidden_gem";

const tone: Record<VerdictKind, string> = {
  worth: "bg-accent text-accent-text",
  not_worth: "bg-negative-bg text-negative",
  hidden_gem: "bg-tint text-verified",
};

/** The verdict sits next to the score, never inside it (rule 13). The label comes from the translation files. */
export function VerdictSticker({ verdict, label }: { verdict: VerdictKind; label: string }) {
  return <span data-testid="verdict" className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${tone[verdict]}`}>{label}</span>;
}

export const isVerdictKind = (value: string): value is VerdictKind => value === "worth" || value === "not_worth" || value === "hidden_gem";
