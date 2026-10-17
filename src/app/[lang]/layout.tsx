import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { IBM_Plex_Sans_Arabic, Readex_Pro, Roboto } from "next/font/google";
import { direction, isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import "../globals.css";

const readex = Readex_Pro({ subsets: ["arabic", "latin"], variable: "--font-readex" });
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-arabic",
});
const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-roboto" });

// The browser bar follows the page: cream in light, near-black in dark (the brand background tokens).
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF8F4" },
    { media: "(prefers-color-scheme: dark)", color: "#0F1114" },
  ],
};

export const generateStaticParams = () => locales.map((lang) => ({ lang }));

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = await getDictionary(lang);
  return {
    title: t.home.title,
    description: t.home.description,
    applicationName: "Ratable",
    icons: {
      icon: [{ url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" }, { url: "/brand/ratable-mark-ink.svg", type: "image/svg+xml" }],
      apple: "/icons/apple-touch-icon.png",
    },
    appleWebApp: { capable: true, title: "Ratable", statusBarStyle: "default" },
  };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <html
      lang={lang}
      dir={direction(lang)}
      // The console sets data-theme on this element before React starts, so the server HTML and the client differ on purpose.
      suppressHydrationWarning
      className={`${readex.variable} ${plexArabic.variable} ${roboto.variable}`}
    >
      <head>
        {/* Applies the stored theme choice before the first paint. No stored choice means the page follows the device. */}
        <script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('ratable-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}" }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
