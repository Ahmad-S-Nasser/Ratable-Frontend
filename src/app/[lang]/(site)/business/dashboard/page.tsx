import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BusinessDashboard } from "@/components/site/BusinessDashboard";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { buildMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: PageProps<"/[lang]/business/dashboard">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = (await getDictionary(lang)).business.dashboard;
  // Private numbers: never indexed.
  return buildMetadata({ lang, path: "/business/dashboard", title: t.title, description: t.intro, noindex: true });
}

export default async function DashboardPage({ params }: PageProps<"/[lang]/business/dashboard">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const { title, heading, intro, ...rest } = dict.business.dashboard;
  void title;
  return (
    <div className="mx-auto max-w-[1120px] space-y-6 px-4 py-10">
      <header className="space-y-1">
        <h1 className="font-heading text-[length:var(--text-h1)] font-semibold">{heading}</h1>
        <p className="text-muted">{intro}</p>
      </header>
      <BusinessDashboard lang={lang} dict={rest as React.ComponentProps<typeof BusinessDashboard>["dict"]} contactDict={dict.business.dashboardContact as React.ComponentProps<typeof BusinessDashboard>["contactDict"]} />
    </div>
  );
}
