import Link from "next/link";
import { getDictionary } from "@/i18n/get-dictionary";
import { buttonClass } from "@/components/ui/Button";

/**
 * Shown (with a 404 status) when a page, place or category does not exist. It cannot know the language of the address, so it speaks both,
 * Arabic first.
 */
export default async function NotFound() {
  const [ar, en] = await Promise.all([getDictionary("ar"), getDictionary("en")]);
  return (
    <div className="mx-auto max-w-xl space-y-8 px-4 py-16 text-center">
      <section lang="ar" dir="rtl" className="space-y-3">
        <h1 className="font-heading text-[length:var(--text-h1)] font-semibold">{ar.notFound.title}</h1>
        <p className="text-muted">{ar.notFound.text}</p>
        <Link href="/ar" className={buttonClass("primary")}>
          {ar.notFound.home}
        </Link>
      </section>
      <section lang="en" dir="ltr" className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">{en.notFound.title}</h2>
        <p className="text-muted">{en.notFound.text}</p>
        <Link href="/en" className={buttonClass("secondary")}>
          {en.notFound.home}
        </Link>
      </section>
    </div>
  );
}
