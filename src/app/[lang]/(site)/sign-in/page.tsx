import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExternalSignIn } from "@/components/site/ExternalSignIn";
import { SignInForm } from "@/components/site/SignInForm";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { buildMetadata } from "@/lib/seo/metadata";
import { safeNext } from "@/lib/safe-next";

export async function generateMetadata({ params }: PageProps<"/[lang]/sign-in">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = (await getDictionary(lang)).signIn;
  return buildMetadata({ lang, path: "/sign-in", title: t.title, description: t.description, noindex: true });
}

export default async function SignInPage({ params, searchParams }: PageProps<"/[lang]/sign-in">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.signIn;
  const raw = (await searchParams).next;
  const next = safeNext(Array.isArray(raw) ? raw[0] : raw, lang);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-10">
      <h1 className="font-heading text-[length:var(--text-h1)] font-semibold">{t.heading}</h1>
      <noscript>
        <p className="rounded-xl bg-warning-bg p-3 text-sm text-warning-text">{t.noscript}</p>
      </noscript>
      <ExternalSignIn next={next} dict={dict.signInMethods} />
      <SignInForm next={next} dict={t} />
    </div>
  );
}
