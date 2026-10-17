import type { ElementType, ReactNode } from "react";

export function Card({ as: Tag = "div", className = "", children }: { as?: ElementType; className?: string; children: ReactNode }) {
  return <Tag className={`rounded-card border border-border bg-surface p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] ${className}`}>{children}</Tag>;
}
