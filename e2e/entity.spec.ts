import AxeBuilder from "@axe-core/playwright";
import { expect, request as pwRequest, test, type Page } from "@playwright/test";
import { API, WEB, createUser, makePlace, publishVerified, signInBrowser, uid, waitForApi, type TestUser } from "./support";

let admin: TestUser;
let place: { id: string; slugEn: string; slugAr: string; nameEn: string; nameAr: string };
const SECRET = "Hidden Hannah";
const NAMED = "Open Omar";

test.beforeAll(async () => {
  await waitForApi();
  admin = await createUser(["Admin"], "Site Admin");
  const suffix = uid();
  const nameEn = `Palm Hills ${suffix}`;
  const nameAr = `بالم هيلز ${suffix}`;
  const owner = await createUser([], "Place Adder");
  const id = await makePlace(owner, admin, nameEn, nameAr);

  // Five verified reviews so the "Security" criterion has a score (it needs 5 answers); one author is anonymous, one is named.
  for (let i = 0; i < 5; i++) {
    const reviewer = await createUser([], i === 0 ? SECRET : i === 1 ? NAMED : `Reader ${i}`);
    const res = await reviewer.api.post(`/api/entities/${id}/reviews`, {
      data: {
        answers: [
          { criterionId: "security", value: 4 },
          { criterionId: "noise", value: 2 },
        ],
        text: `Review number ${i} from a real resident`,
        isAnonymous: i !== 1 && i !== 2,
      },
    });
    expect(res.status()).toBe(201);
    await publishVerified(((await res.json()) as { id: string }).id);
  }
  const anon = await pwRequest.newContext({ baseURL: API });
  const entity = (await (await anon.get(`/api/entities/${id}`)).json()) as { slugs: Record<string, string> };
  await anon.dispose();
  place = { id, slugEn: entity.slugs.en, slugAr: entity.slugs.ar, nameEn, nameAr };
});

const entityUrl = (lang: "ar" | "en") => `${WEB}/${lang}/compounds/${place.id}-${lang === "ar" ? place.slugAr : place.slugEn}`;

test.describe("entity page for crawlers (JavaScript off)", () => {
  test.use({ javaScriptEnabled: false });

  test("answer-first summary, criteria table, FAQ and structured data", async ({ page }) => {
    await page.goto(entityUrl("en"));
    await expect(page.locator("h1")).toHaveText(place.nameEn);
    const summary = page.locator("#summary").locator("..");
    await expect(summary).toContainText("scores 3.0 out of 5 from 5 verified reviews");
    await expect(summary).toContainText("Strengths: Security");
    await expect(summary).toContainText("Weaknesses: Noise");
    await expect(summary).toContainText("Last updated:");
    await expect(page.locator("table tbody tr")).toHaveCount(7);
    await expect(page.locator("details")).toHaveCount(8);

    const blocks = (await page.locator("script[type='application/ld+json']").allTextContents()).flatMap((b) => JSON.parse(b) as Record<string, unknown>[]);
    const entity = blocks.find((b) => b["@type"] === "LocalBusiness")!;
    expect(entity).toBeTruthy();
    expect(entity.aggregateRating).toMatchObject({ ratingValue: 3, reviewCount: 5 });
    expect(blocks.some((b) => b["@type"] === "BreadcrumbList")).toBe(true);
    expect(blocks.some((b) => b["@type"] === "FAQPage")).toBe(true);
  });

  test("an anonymous author never appears in the HTML, JSON-LD or meta tags", async ({ page }) => {
    for (const lang of ["en", "ar"] as const) {
      await page.goto(entityUrl(lang));
      const html = await page.content();
      expect(html).not.toContain(SECRET);
      expect(html).not.toContain("Hannah");
      // The named author does appear, and anonymous reviews are labelled generically in the structured data.
      expect(html).toContain(NAMED);
      expect(html).toContain('"name":"Anonymous"');
    }
  });

  test("metadata: canonical, hreflang, indexable", async ({ page }) => {
    await page.goto(entityUrl("ar"));
    expect(await page.locator("link[rel=canonical]").getAttribute("href")).toContain(`/ar/compounds/${place.id}-`);
    const alternates = await page.locator("link[rel=alternate][hreflang]").evaluateAll((l) => l.map((x) => x.getAttribute("hreflang")));
    expect(alternates).toEqual(expect.arrayContaining(["ar-EG", "ar-SA", "ar-AE", "en"]));
    const robots = await page.locator("meta[name=robots]").getAttribute("content");
    expect(robots).toContain("index");
    expect(robots).not.toContain("noindex");
  });

  test("a wrong slug is redirected permanently to the current address", async ({ request }) => {
    const response = await request.get(`${WEB}/en/compounds/${place.id}-an-old-name`, { maxRedirects: 0 });
    expect([301, 308]).toContain(response.status());
    expect(response.headers().location).toContain(`/en/compounds/${place.id}-${place.slugEn}`);
  });

  test("the sitemap lists the place with a real lastmod", async ({ request }) => {
    const xml = await (await request.get(`${WEB}/sitemap.xml`)).text();
    expect(xml).toContain(`/en/compounds/${place.id}-${place.slugEn}`);
    expect(xml).toMatch(/<lastmod>20\d\d-\d\d-\d\dT/);
  });

  test("the category lists the place with its verified score, and search finds it", async ({ page }) => {
    await page.goto(`${WEB}/en/compounds`);
    await expect(page.locator("h1")).toHaveText("Compounds");
    await expect(page.getByRole("link", { name: place.nameEn })).toBeVisible();
    await expect(page.locator("article", { hasText: place.nameEn })).toContainText("5 verified reviews");
    await page.goto(`${WEB}/en/search?q=${encodeURIComponent(place.nameEn)}`);
    await expect(page.getByRole("link", { name: place.nameEn })).toBeVisible();
    expect(await page.locator("meta[name=robots]").getAttribute("content")).toContain("noindex");
  });

  test("an unknown place or category is a 404", async ({ request }) => {
    expect((await request.get(`${WEB}/en/compounds/000000000000000000000000-nothing`)).status()).toBe(404);
    expect((await request.get(`${WEB}/en/no-such-category`)).status()).toBe(404);
  });
});

const settle = async (page: Page) => {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
};

const wcag = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const describeViolations = (violations: { id: string; nodes: { target: unknown[] }[] }[]) =>
  violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);

test.describe("contrast in both themes and languages", () => {
  for (const lang of ["ar", "en"] as const) {
    for (const theme of ["light", "dark"] as const) {
      test(`entity page ${lang} ${theme}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: theme });
        await page.goto(entityUrl(lang));
        await settle(page);
        const results = await new AxeBuilder({ page }).withTags(wcag).analyze();
        expect(describeViolations(results.violations)).toEqual([]);
        await page.screenshot({ path: `test-results/screens/entity-${lang}-${theme}.png`, fullPage: true });
      });
    }
  }
});

test.describe("the review flow", () => {
  const cases = [
    { lang: "ar", theme: "dark", dir: "rtl", star: "5 من 5", submit: "انشر التقييم", save: "احفظ التعديل", done: "وصل تقييمك", group: "الأمن" },
    { lang: "en", theme: "light", dir: "ltr", star: "5 out of 5", submit: "Publish review", save: "Save changes", done: "Your review was received", group: "Security" },
  ] as const;

  for (const c of cases) {
    test(`${c.lang} ${c.dir} ${c.theme}: sign-in is asked, then write, then edit`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: c.theme });
      const url = `${entityUrl(c.lang)}/review`;

      // A visitor is asked to sign in.
      await page.goto(url);
      await expect(page.locator("html")).toHaveAttribute("dir", c.dir);
      await expect(page.locator("a[href*='/sign-in']")).toBeVisible();

      // A signed-in reader writes a review.
      const reader = await createUser([], "Fresh Reviewer");
      await signInBrowser(page, reader);
      await page.goto(url);
      await expect(page.getByRole("switch")).toBeChecked(); // compounds are anonymous by default
      await page.getByRole("group", { name: c.group }).getByLabel(c.star).check({ force: true });
      await page.getByRole("textbox").fill("A calm place with good security.");
      await page.getByRole("button", { name: c.submit }).click();
      await expect(page.getByRole("status")).toContainText(c.done);

      const mine = (await (await reader.api.get(`/api/me/reviews?entityId=${place.id}`)).json()) as {
        status: string;
        isAnonymous: boolean;
        answers: { criterionId: string; score: number }[];
      }[];
      expect(mine).toHaveLength(1);
      expect(mine[0].status).toBe("PendingModeration");
      expect(mine[0].isAnonymous).toBe(true);
      expect(mine[0].answers).toMatchObject([{ criterionId: "security", score: 5 }]);
      // Not public yet.
      const anon = await pwRequest.newContext({ baseURL: API });
      const publicList = (await (await anon.get(`/api/entities/${place.id}/reviews`)).json()) as { text: string }[];
      await anon.dispose();
      expect(publicList.some((r) => r.text === "A calm place with good security.")).toBe(false);

      // Opening the form again edits the same review: prefilled, one review per account.
      await page.goto(url);
      await expect(page.getByRole("textbox")).toHaveValue("A calm place with good security.");
      await page.getByRole("textbox").fill("Updated: still calm, better gates.");
      await page.getByRole("switch").click();
      await page.getByRole("button", { name: c.save }).click();
      await expect(page.getByRole("status")).toContainText(c.done);
      const after = (await (await reader.api.get(`/api/me/reviews?entityId=${place.id}`)).json()) as { revisionNumber: number; isAnonymous: boolean }[];
      expect(after).toHaveLength(1);
      expect(after[0].revisionNumber).toBe(2);
      expect(after[0].isAnonymous).toBe(false);
    });

    test(`${c.lang} ${c.theme}: the form passes the contrast check`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: c.theme });
      const reader = await createUser([], "Contrast Reader");
      await signInBrowser(page, reader);
      await page.goto(`${entityUrl(c.lang)}/review`);
      await expect(page.getByRole("button", { name: c.submit })).toBeVisible();
      await settle(page);
      const results = await new AxeBuilder({ page }).withTags(wcag).analyze();
      expect(describeViolations(results.violations)).toEqual([]);
      await page.screenshot({ path: `test-results/screens/review-${c.lang}-${c.theme}.png`, fullPage: true });
    });
  }
});
