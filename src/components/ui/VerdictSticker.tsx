export type Verdict = "worth" | "notWorth" | "hiddenGem";

const tone: Record<Verdict, string> = {
  worth: "bg-accent text-accent-text",
  notWorth: "bg-negative-bg text-negative",
  hiddenGem: "bg-tint text-verified",
};

/** The verdict sits next to the score, never inside it (rule 13). */
export function VerdictSticker({ verdict, label }: { verdict: Verdict; label: string }) {
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${tone[verdict]}`}>{label}</span>;
}
