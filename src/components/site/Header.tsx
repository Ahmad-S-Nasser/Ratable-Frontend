import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { AccountLink } from "./AccountLink";
import { LanguageSwitch, ThemeSwitch } from "./HeaderControls";
import { Logo } from "./Logo";

export async function Header({ lang }: { lang: Locale }) {
  const dict = await getDictionary(lang);
  const t = dict.site;
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3">
        <Logo lang={lang} />
        <nav aria-label={t.mainNav} className="flex flex-wrap items-center gap-1 sm:gap-3">
          <Link href={`/${lang}/categories`} className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium hover:bg-surface-2">
            {t.categories}
          </Link>
          <Link href={`/${lang}/feed`} className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium hover:bg-surface-2">
            {dict.feed.heading}
          </Link>
          <AccountLink lang={lang} signIn={dict.account.signIn} me={dict.account.me} />
          <ThemeSwitch labels={t.theme} />
          <LanguageSwitch lang={lang} label={t.language.label} />
        </nav>
      </div>
    </header>
  );
}
