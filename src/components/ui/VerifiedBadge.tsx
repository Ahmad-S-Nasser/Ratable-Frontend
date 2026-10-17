import { ShieldCheckIcon } from "./Icons";

/** Indigo means verified. Small, never a large area. */
export function VerifiedBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-tint px-2.5 py-1 text-xs font-medium text-verified">
      <ShieldCheckIcon width={14} height={14} />
      {label}
    </span>
  );
}
