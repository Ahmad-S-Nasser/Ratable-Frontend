import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalSignIn } from "@/components/site/ExternalSignIn";
import { SignInForm } from "@/components/site/SignInForm";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { buildMetadata } from "@/lib/seo/metadata";
import { safeNext } from "@/lib/safe-next";

export async function generateMetadata({ params }: PageProps<"/[lang]/business/sign-up">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = (await getDictionary(lang)).business.auth.signUp;
  return buildMetadata({ lang, path: "/business/sign-up", title: t.title, description: t.description, noindex: true });
}

/** Creating a business account is the same safe sign-in as everywhere (phone, Google or Apple), framed for a business, and it leads on to claiming a place. */
export default async function BusinessSignUpPage({ params, searchParams }: PageProps<"/[lang]/business/sign-up">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.business.auth.signUp;
  const raw = (await searchParams).next;
  const next = safeNext(Array.isArray(raw) ? raw[0] : raw, lang, `/${lang}/business/claim`);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-10">
      <h1 className="font-heading text-[length:var(--text-h1)] font-semibold">{t.heading}</h1>
      <p className="text-muted">{t.intro}</p>
      <noscript>
        <p className="rounded-xl bg-warning-bg p-3 text-sm text-warning-text">{dict.signIn.noscript}</p>
      </noscript>
      <ExternalSignIn next={next} dict={dict.signInMethods} />
      <SignInForm next={next} dict={{ ...dict.signIn, intro: t.intro }} />
      <p className="text-sm text-muted">
        {t.haveAccount}{" "}
        <Link href={`/${lang}/business/sign-in`} className="font-medium text-link underline">
          {t.signInLink}
        </Link>
      </p>
    </div>
  );
}
