import Link from "next/link";
import { JsonLdScript } from "@/components/site/JsonLdScript";
import { Card } from "@/components/ui/Card";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";

type Section = "scores" | "verification" | "moderation";
const paths: Record<Section, string> = { scores: "/methodology", verification: "/methodology/verification", moderation: "/methodology/moderation" };

/** One of the three trust pages (scores, verification, moderation), with links to the other two. */
export async function MethodologyView({
  lang, section, content,
}: { lang: Locale; section: Section; content: { heading: string; intro: string; items: { title: string; text: string }[] } }) {
  const dict = await getDictionary(lang);
  const nav = dict.methodologyNav;
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: dict.site.home, path: `/${lang}` },
          { name: content.heading, path: `/${lang}${paths[section]}` },
        ])}
      />
      <nav aria-label={nav.label} className="flex flex-wrap gap-2">
        {(Object.keys(paths) as Section[]).map((s) => (
          <Link
            key={s}
            href={`/${lang}${paths[s]}`}
            aria-current={s === section ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium ${
              s === section ? "border-verified bg-tint text-verified" : "border-border bg-surface hover:bg-surface-2"
            }`}
          >
            {nav[s]}
          </Link>
        ))}
      </nav>
      <h1 className="font-heading text-[length:var(--text-h1)] font-semibold">{content.heading}</h1>
      <p className="text-lg text-muted">{content.intro}</p>
      <ol className="space-y-4">
        {content.items.map((item, i) => (
          <li key={item.title}>
            <Card className="space-y-2">
              <h2 className="font-heading text-lg font-semibold">
                <span className="text-verified">{(i + 1).toLocaleString(lang === "ar" ? "ar-EG" : "en")}. </span>
                {item.title}
              </h2>
              <p className="leading-7 text-muted">{item.text}</p>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}
