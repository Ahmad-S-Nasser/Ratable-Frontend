import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);
  const other = lang === "ar" ? "en" : "ar";

  return (
    <main className="mx-auto flex min-h-screen max-w-[1120px] flex-col gap-4 px-4 py-10">
      <h1 className="font-heading text-[length:var(--text-h1)] font-semibold">{t.home.heading}</h1>
      <p className="text-muted">{t.home.tagline}</p>
      <Link href={`/${other}`} className="text-link ps-0 underline">
        {t.language[other]}
      </Link>
    </main>
  );
}
