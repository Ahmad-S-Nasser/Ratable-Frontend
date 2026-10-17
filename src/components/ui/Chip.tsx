import Link from "next/link";
import type { ReactNode } from "react";

export function Chip({ href, active = false, children }: { href: string; active?: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors ${
        active ? "border-verified bg-tint text-verified" : "border-border bg-surface text-foreground hover:bg-surface-2"
      }`}
    >
      {children}
    </Link>
  );
}
