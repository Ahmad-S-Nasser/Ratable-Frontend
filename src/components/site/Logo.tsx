import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/i18n/config";

/** The star-and-R mark with the Roboto bold wordmark "Ratable", identical in both languages. Ink on light, lime on dark. */
export function Logo({ lang }: { lang: Locale }) {
  return (
    <Link href={`/${lang}`} className="inline-flex items-center gap-2" aria-label="Ratable" dir="ltr">
      <Image src="/brand/ratable-mark-ink.svg" alt="" width={32} height={32} className="logo-on-light" priority />
      <Image src="/brand/ratable-mark-lime.svg" alt="" width={32} height={32} className="logo-on-dark" priority />
      <span className="font-[family-name:var(--font-roboto)] text-xl font-bold tracking-tight">Ratable</span>
    </Link>
  );
}
