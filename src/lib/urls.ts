import type { Locale } from "@/i18n/config";

type WithSlugs = { id: string; slugs: Record<string, string> };

const ID = /^[0-9a-f]{24}$/;

/** The slug in this language, falling back to the other one. The id in front never changes, so a changed slug can always be redirected. */
export function entitySlug(entity: WithSlugs, lang: Locale): string {
  return entity.slugs[lang] || entity.slugs[lang === "ar" ? "en" : "ar"] || "place";
}

/** The stable URL: /{lang}/{category}/{id}-{slug}. */
export const entityPath = (lang: Locale, categoryId: string, entity: WithSlugs) => `/${lang}/${categoryId}/${entity.id}-${entitySlug(entity, lang)}`;

/** Reads the id out of the "{id}-{slug}" part of the address. Null when it does not start with a 24-character id. */
export function entityIdFromParam(param: string): string | null {
  const decoded = decodeURIComponent(param);
  const id = decoded.slice(0, 24).toLowerCase();
  return ID.test(id) && (decoded.length === 24 || decoded[24] === "-") ? id : null;
}
