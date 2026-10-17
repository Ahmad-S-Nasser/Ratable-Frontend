import type { MetadataRoute } from "next";

/** Makes the site installable. Colours are the brand ink and cream; the app opens in Arabic, the default language. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ريتابل | Ratable",
    short_name: "Ratable",
    description: "تقييمات موثقة من ناس جربت في مصر والخليج. Verified reviews from people who tried, in Egypt and the Gulf.",
    id: "/ar",
    start_url: "/ar",
    scope: "/",
    lang: "ar",
    dir: "rtl",
    display: "standalone",
    background_color: "#FAF8F4",
    theme_color: "#15171A",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
