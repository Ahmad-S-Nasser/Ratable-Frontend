import type { CardLabels } from "@/components/site/PlaceCardView";
import type { Locale } from "@/i18n/config";
import type { getDictionary } from "@/i18n/get-dictionary";
import type { Category } from "@/lib/api/types";
import { pick } from "@/lib/pick";

type Dict = Awaited<ReturnType<typeof getDictionary>>;

/** The words a place card needs, in one place, so the category list, the collections and the search show cards the same way. */
export function cardLabels(dict: Dict, category: Category, lang: Locale): CardLabels {
  return {
    reviewsCount: dict.category.reviewsCount,
    unrated: dict.category.unrated,
    outOf: dict.entity.outOf,
    price: dict.lists.price,
    distance: dict.lists.distance,
    verdicts: { worth: dict.verdict.worth, not_worth: dict.verdict.not_worth, hidden_gem: dict.verdict.hidden_gem },
    criteria: Object.fromEntries(category.criteria.map((c) => [c.id, pick(c.label, lang, c.id)])),
  };
}
