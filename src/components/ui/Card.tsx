import type { ElementType, HTMLAttributes, ReactNode } from "react";

type Props = { as?: ElementType; className?: string; children: ReactNode } & Omit<HTMLAttributes<HTMLElement>, "className" | "children">;

/** A bordered surface. Extra attributes (an id, a data attribute for tests, aria labels) go through to the element. */
export function Card({ as: Tag = "div", className = "", children, ...rest }: Props) {
  return (
    <Tag {...rest} className={`rounded-card border border-border bg-surface p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] ${className}`}>
      {children}
    </Tag>
  );
}
