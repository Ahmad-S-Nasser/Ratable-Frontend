import { notFound } from "next/navigation";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

// Applies the stored theme choice before the first paint. No stored choice means the page follows the device.
const themeScript = "try{var t=localStorage.getItem('ratable-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}";

export default async function SiteLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = (await getDictionary(lang)).site;

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-text"
      >
        {t.skip}
      </a>
      <Header lang={lang} />
      <main id="main">{children}</main>
      <Footer lang={lang} />
    </>
  );
}
