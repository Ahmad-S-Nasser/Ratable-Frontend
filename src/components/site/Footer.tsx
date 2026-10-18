import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getCategories } from "@/lib/api/server";
import { pick } from "@/lib/pick";

/**
 * The footer lists every category, from the API, and links to "All categories". It is ink in both themes
 * (the desktop design has an ink footer), so it has its own footer tokens.
 */
export async function Footer({ lang }: { lang: Locale }) {
  const dict = await getDictionary(lang);
  const t = dict.site;
  const categories = await getCategories();
  const list = categories.ok ? categories.data : [];

  return (
    <footer className="mt-16 bg-footer text-footer-text">
      <div className="mx-auto grid max-w-[1120px] gap-8 px-4 py-12 sm:grid-cols-3">
        <div className="space-y-3">
          <p className="font-[family-name:var(--font-roboto)] text-xl font-bold" dir="ltr">
            Ratable
          </p>
          <p className="text-sm leading-6 text-footer-muted">{t.footer.about}</p>
        </div>
        <nav aria-labelledby="footer-explore" className="space-y-3">
          <h2 id="footer-explore" className="text-sm font-semibold">
            {t.footer.explore}
          </h2>
          <ul className="space-y-1 text-sm text-footer-muted">
            {list.map((c) => (
              <li key={c.id}>
                <Link href={`/${lang}/${c.id}`} className="inline-flex min-h-9 items-center hover:text-footer-text">
                  {pick(c.name, lang)}
                </Link>
              </li>
            ))}
            <li>
              <Link href={`/${lang}/nearby`} className="inline-flex min-h-9 items-center hover:text-footer-text">
                {dict.nearby.heading}
              </Link>
            </li>
            <li>
              <Link href={`/${lang}/lists`} className="inline-flex min-h-9 items-center hover:text-footer-text">
                {dict.lists.heading}
              </Link>
            </li>
            <li>
              <Link href={`/${lang}/categories`} className="inline-flex min-h-9 items-center font-medium text-footer-text underline">
                {t.allCategories}
              </Link>
            </li>
          </ul>
        </nav>
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">{t.footer.company}</h2>
          <ul className="space-y-2 text-sm text-footer-muted">
            <li>{t.footer.verifiedOnly}</li>
            <li>{t.footer.noPaidRank}</li>
            <li>
              <Link href={`/${lang}/methodology`} className="inline-flex min-h-9 items-center font-medium text-footer-text underline">
                {t.methodology}
              </Link>
            </li>
            <li>
              <Link href={`/${lang}/points`} className="inline-flex min-h-9 items-center hover:text-footer-text">
                {dict.pointsPage.heading}
              </Link>
            </li>
            <li>
              <Link href={`/${lang}/add`} className="inline-flex min-h-9 items-center hover:text-footer-text">
                {t.addPlace}
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <p className="border-t border-footer-line px-4 py-4 text-center text-xs text-footer-muted">{t.footer.rights}</p>
    </footer>
  );
}
