import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors disabled:opacity-50";
const variants: Record<Variant, string> = {
  // Lime with ink text: the one main button on a screen.
  primary: "bg-accent text-accent-text hover:brightness-95",
  secondary: "border border-border bg-surface text-foreground hover:bg-surface-2",
  ghost: "text-foreground hover:bg-surface-2",
};

export const buttonClass = (variant: Variant = "secondary") => `${base} ${variants[variant]}`;

export function Button({ variant = "secondary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button {...props} className={`${buttonClass(variant)} ${className}`} />;
}

export function ButtonLink({ href, variant = "secondary", children }: { href: string; variant?: Variant; children: ReactNode }) {
  return (
    <Link href={href} className={buttonClass(variant)}>
      {children}
    </Link>
  );
}
