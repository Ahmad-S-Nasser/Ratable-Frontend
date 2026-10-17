import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { ConsoleProvider } from "@/components/console/context";
import { Shell } from "@/components/console/Shell";

export async function generateMetadata({ params }: LayoutProps<"/[lang]/console">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = await getDictionary(lang);
  // A back office: never indexed.
  return { title: t.console.title, description: t.console.metaDescription, robots: { index: false, follow: false } };
}

export default async function ConsoleLayout({ children, params }: LayoutProps<"/[lang]/console">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <>
      {/* Light is the default for the console; the stored choice is applied before the first paint so there is no flash. */}
      <script dangerouslySetInnerHTML={{ __html: "try{document.documentElement.dataset.theme=localStorage.getItem('ratable-console-theme')||'light'}catch(e){document.documentElement.dataset.theme='light'}" }} />
      <ConsoleProvider lang={lang} dict={dict.console}>
        <Shell>{children}</Shell>
      </ConsoleProvider>
    </>
  );
}
