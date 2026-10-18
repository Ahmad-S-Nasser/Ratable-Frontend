import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { WEB, waitForApi } from "./support";

test.beforeAll(async () => {
  await waitForApi();
});

const publicPages = ["", "/categories", "/methodology"];
const languages = ["ar", "en"] as const;

/** Waits for fonts, network and transitions, so the contrast check reads the final colours (same care as the console tests). */
async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
}

test.describe("public shell", () => {
  for (const lang of languages) {
    test(`${lang}: direction, one h1, skip link, footer lists every category`, async ({ page }) => {
      await page.goto(`${WEB}/${lang}`);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      await expect(page.locator("html")).toHaveAttribute("dir", lang === "ar" ? "rtl" : "ltr");
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("a[href='#main']")).toHaveCount(1);

      const footer = page.locator("footer");
      await expect(footer.getByRole("link")).toHaveCount(6 + 3 + 3 + 1); // every category, Nearby, Lists, All categories, methodology, points, add a place and For business
      await expect(footer.locator(`a[href='/${lang}/categories']`)).toBeVisible();
    });
  }

  test("the language switch keeps the page and the theme", async ({ page }) => {
    await page.goto(`${WEB}/en/categories`);
    await page.getByRole("button", { name: "Dark" }).click();
    await page.getByRole("link", { name: /العربية/ }).click();
    await expect(page).toHaveURL(`${WEB}/ar/categories`);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });

  test("the theme follows the device until the visitor chooses", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(`${WEB}/en`);
    const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(await background()).toBe("rgb(15, 17, 20)");

    await page.getByRole("button", { name: "Light" }).click();
    expect(await background()).toBe("rgb(250, 248, 244)");
    await page.reload();
    expect(await background()).toBe("rgb(250, 248, 244)");

    await page.getByRole("button", { name: "Device" }).click();
    expect(await background()).toBe("rgb(15, 17, 20)");
  });

  test("the logo is ink on light and lime on dark", async ({ page }) => {
    await page.goto(`${WEB}/en`);
    await page.getByRole("button", { name: "Light" }).click();
    await expect(page.locator("header img[src*='mark-ink']")).toBeVisible();
    await expect(page.locator("header img[src*='mark-lime']")).toBeHidden();
    await page.getByRole("button", { name: "Dark" }).click();
    await expect(page.locator("header img[src*='mark-lime']")).toBeVisible();
    await expect(page.locator("header img[src*='mark-ink']")).toBeHidden();
  });

  test("home search is a plain form, so it works without JavaScript", async ({ page }) => {
    await page.goto(`${WEB}/en`);
    const form = page.getByRole("search");
    await expect(form).toHaveAttribute("action", "/en/search");
    // No method attribute means GET, which is what a search needs.
    expect(await form.getAttribute("method")).toBeNull();
  });

  test("phone width: no horizontal scroll", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    for (const lang of languages) {
      for (const path of publicPages) {
        await page.goto(`${WEB}/${lang}${path}`);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${lang}${path}`).toBeLessThanOrEqual(0);
      }
    }
    await context.close();
  });
});

test.describe("contrast and screenshots in both themes (WCAG 2.1 AA)", () => {
  for (const lang of languages) {
    for (const theme of ["light", "dark"] as const) {
      for (const path of publicPages) {
        test(`${lang} ${theme} ${path || "/"}`, async ({ page }) => {
          await page.emulateMedia({ colorScheme: theme });
          await page.goto(`${WEB}/${lang}${path}`);
          await settle(page);
          const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
          expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
          await page.screenshot({ path: `test-results/screens/${lang}-${theme}-${path.replace(/\//g, "") || "home"}.png`, fullPage: true });
        });
      }
    }
  }
});
