import { expect, test } from "@playwright/test";
import { WEB, waitForApi } from "./support";

/**
 * The SEO and answer-engine checks, run with JavaScript turned off, so what a crawler sees is what is tested.
 * Every public page type is added to this list when it is built; the checks are the same for all of them.
 */
const pages = ["/ar", "/en", "/ar/categories", "/en/categories", "/ar/methodology", "/en/methodology"];

test.beforeAll(async () => {
  await waitForApi();
});

test.use({ javaScriptEnabled: false });

for (const path of pages) {
  test.describe(path, () => {
    test("one h1, title, description, canonical, hreflang, content", async ({ page }) => {
      await page.goto(`${WEB}${path}`);
      await expect(page.locator("h1")).toHaveCount(1);
      expect((await page.title()).length).toBeGreaterThan(10);
      expect(await page.locator("meta[name=description]").getAttribute("content")).toMatch(/.{30,}/);

      const lang = path.split("/")[1];
      const rest = path.replace(/^\/(ar|en)/, "");
      const canonical = await page.locator("link[rel=canonical]").getAttribute("href");
      expect(canonical).toMatch(new RegExp(`/${lang}${rest}$`));

      const alternates = await page.locator("link[rel=alternate][hreflang]").evaluateAll((links) => links.map((l) => l.getAttribute("hreflang")));
      expect(alternates).toEqual(expect.arrayContaining(["ar-EG", "ar-SA", "ar-AE", "en", "x-default"]));

      expect((await page.locator("main").innerText()).length).toBeGreaterThan(80);
    });

    test("JSON-LD is valid", async ({ page }) => {
      await page.goto(`${WEB}${path}`);
      const blocks = await page.locator("script[type='application/ld+json']").allTextContents();
      expect(blocks.length).toBeGreaterThan(0);
      for (const block of blocks) {
        const data = JSON.parse(block) as unknown;
        for (const item of Array.isArray(data) ? data : [data]) {
          expect((item as Record<string, unknown>)["@context"]).toBe("https://schema.org");
          expect(typeof (item as Record<string, unknown>)["@type"]).toBe("string");
        }
      }
    });
  });
}

test("the sign-in page says what to do when JavaScript is off", async ({ page }) => {
  await page.goto(`${WEB}/en/sign-in`);
  await expect(page.locator("h1")).toHaveCount(1);
  // Playwright treats <noscript> text as hidden, so read it as raw text.
  expect(await page.locator("noscript").first().textContent()).toContain("needs JavaScript");
  expect(await page.locator("meta[name=robots]").getAttribute("content")).toContain("noindex");
});

test("robots.txt welcomes crawlers and points to the sitemap", async ({ request }) => {
  const text = await (await request.get(`${WEB}/robots.txt`)).text();
  expect(text).toContain("Allow: /");
  expect(text).toContain("Sitemap:");
  expect(text).toContain("Disallow: /api/");
});

test("the sitemap index lists both languages, split by category", async ({ request }) => {
  const xml = await (await request.get(`${WEB}/sitemap.xml`)).text();
  expect(xml).toContain("/sitemaps/ar-static.xml");
  expect(xml).toContain("/sitemaps/en-static.xml");
  const part = await (await request.get(`${WEB}/sitemaps/en-static.xml`)).text();
  expect(part).toContain("/en/categories");
  expect(part).toContain("/en/methodology/verification");
  expect(part).toContain("/en/compounds/best");
  expect(part).toContain('hreflang="ar-EG"');
});

test("the Organization JSON-LD declares the Arabic name", async ({ page }) => {
  await page.goto(`${WEB}/en`);
  const text = (await page.locator("script[type='application/ld+json']").allTextContents()).join("");
  expect(text).toContain('"alternateName":"ريتابل"');
});
