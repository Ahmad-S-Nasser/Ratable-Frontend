import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLdScript } from "@/components/site/JsonLdScript";
import { Card } from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/Button";
import { CheckIcon } from "@/components/ui/Icons";
import { isLocale } from "@/i18n/config";
import { fmt, formatNumber } from "@/i18n/format";
import { getDictionary } from "@/i18n/get-dictionary";
import { getPlans } from "@/lib/api/server";
import { breadcrumbJsonLd, faqJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: PageProps<"/[lang]/business/pricing">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = (await getDictionary(lang)).business.pricing;
  // The currency choice is a view of the same page: it keeps the one canonical address.
  return buildMetadata({ lang, path: "/business/pricing", title: t.title, description: t.description });
}

type PlanId = "free" | "insights" | "contact";
const known = new Set<string>(["free", "insights", "contact"]);

/** The plans come from the API, so the page cannot show a feature or a price the server does not know. No plan changes a score or a rank, and the page says so. */
export default async function PricingPage({ params, searchParams }: PageProps<"/[lang]/business/pricing">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.business.pricing;
  const result = await getPlans();
  const plans = result.ok ? result.data.plans.filter((p) => known.has(p.id)) : [];
  const currencies = result.ok ? result.data.currencies : [];
  const annual = result.ok ? result.data.annualDiscountPercent : 0;
  const raw = (await searchParams).currency;
  const asked = (Array.isArray(raw) ? raw[0] : raw)?.toUpperCase();
  const currency = asked && currencies.includes(asked) ? asked : (currencies[0] ?? "EGP");
  const features = t.features as Record<string, string>;
  const names = t.currencies as Record<string, string>;

  return (
    <div className="mx-auto max-w-[1120px] space-y-10 px-4 py-12">
      <JsonLdScript
        data={[
          breadcrumbJsonLd([
            { name: dict.site.home, path: `/${lang}` },
            { name: dict.business.marketing.title, path: `/${lang}/business` },
            { name: t.heading, path: `/${lang}/business/pricing` },
          ]),
          faqJsonLd(t.faq.map((f) => ({ question: f.question, answer: f.answer }))),
        ]}
      />
      <header className="max-w-3xl space-y-3">
        <h1 className="font-heading text-[length:var(--text-h1)] font-semibold">{t.heading}</h1>
        <p className="text-lg text-muted">{t.intro}</p>
        {currencies.length > 1 ? (
          <nav aria-label={t.currencyLabel} className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-sm text-muted">{t.currencyLabel}</span>
            {currencies.map((c) => (
              <Link
                key={c}
                href={`/${lang}/business/pricing?currency=${c}`}
                aria-current={c === currency ? "true" : undefined}
                className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium ${c === currency ? "border-verified bg-tint text-verified" : "border-border bg-surface hover:bg-surface-2"}`}
              >
                {names[c] ?? c}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>

      {plans.length === 0 ? (
        <p className="text-muted">{dict.business.dashboard.errors.unknown}</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-3">
          {plans.map((p) => {
            const copy = t.plans[p.id as PlanId];
            const open = p.id === "free";
            const price = p.monthlyPrices[currency];
            return (
              <li key={p.id}>
                <Card className="flex h-full flex-col gap-4" data-testid={`plan-${p.id}`}>
                  <h2 className="font-heading text-xl font-semibold">{copy.name}</h2>
                  <p className="text-sm text-muted">{copy.tagline}</p>
                  <p className="text-2xl font-bold" data-testid={`price-${p.id}`}>
                    {price === 0 ? (
                      t.free
                    ) : price === undefined ? (
                      <span className="text-base font-medium text-muted">{t.pricePending}</span>
                    ) : (
                      <>
                        {formatNumber(lang, price)} <span className="text-sm font-medium text-muted">{fmt(t.perMonthIn, { currency: names[currency] ?? currency })}</span>
                      </>
                    )}
                  </p>
                  <ul className="flex-1 space-y-2 text-sm">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <CheckIcon width={16} height={16} className="mt-1 shrink-0 text-verified" />
                        <span>{features[f] ?? f}</span>
                      </li>
                    ))}
                  </ul>
                  {open ? (
                    <Link href={`/${lang}/business/sign-up`} className={buttonClass("primary")}>
                      {copy.cta}
                    </Link>
                  ) : (
                    <span aria-disabled="true" className={`${buttonClass("secondary")} cursor-not-allowed opacity-60`}>
                      {copy.cta}
                    </span>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      {annual > 0 ? <p className="text-sm text-muted">{fmt(t.annual, { n: formatNumber(lang, annual) })}</p> : null}
      <p className="text-sm text-muted">{t.note}</p>

      <section aria-labelledby="faq" className="max-w-3xl space-y-4">
        <h2 id="faq" className="font-heading text-xl font-semibold">
          {t.faqHeading}
        </h2>
        <dl className="space-y-4">
          {t.faq.map((f) => (
            <div key={f.question} className="space-y-1">
              <dt className="font-semibold">{f.question}</dt>
              <dd className="leading-7 text-muted">{f.answer}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
