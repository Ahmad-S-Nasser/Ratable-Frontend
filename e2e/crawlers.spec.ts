import { expect, request as pwRequest, test } from "@playwright/test";
import { API, WEB, createUser, makePlace, publishVerified, uid, waitForApi } from "./support";
import { aiCrawlerName, searchCrawlers, trainingCrawlers } from "../src/lib/crawlers";
import { safeNext } from "../src/lib/safe-next";
import { entityIdFromParam } from "../src/lib/urls";

test.describe("pure helpers", () => {
  test("AI crawlers are recognised by name, ordinary browsers are not", () => {
    expect(aiCrawlerName("Mozilla/5.0 AppleWebKit/537.36 (compatible; GPTBot/1.1; +https://openai.com/gptbot)")).toBe("GPTBot");
    expect(aiCrawlerName("Mozilla/5.0 (compatible; Claude-SearchBot/1.0)")).toBe("Claude-SearchBot");
    expect(aiCrawlerName("Mozilla/5.0 (compatible; PerplexityBot/1.0)")).toBe("PerplexityBot");
    expect(aiCrawlerName("Mozilla/5.0 (Windows NT 10.0) Chrome/130 Safari/537.36")).toBeNull();
    expect(aiCrawlerName(null)).toBeNull();
  });

  test("a next address stays on the site", () => {
    expect(safeNext("/en/me", "ar")).toBe("/en/me");
    expect(safeNext("https://evil.example", "ar")).toBe("/ar");
    expect(safeNext("//evil.example", "en")).toBe("/en");
    expect(safeNext("/ar\\evil", "en")).toBe("/en");
    expect(safeNext("/other", "en")).toBe("/en");
    expect(safeNext(undefined, "ar")).toBe("/ar");
  });

  test("the id is read from the address and nothing else is trusted", () => {
    expect(entityIdFromParam("507f1f77bcf86cd799439011-some-name")).toBe("507f1f77bcf86cd799439011");
    expect(entityIdFromParam("507f1f77bcf86cd799439011")).toBe("507f1f77bcf86cd799439011");
    expect(entityIdFromParam("507f1f77bcf86cd79943901x-name")).toBeNull();
    expect(entityIdFromParam("507f1f77bcf86cd799439011name")).toBeNull();
    expect(entityIdFromParam("short")).toBeNull();
  });
});

test.describe("robots, keys and refresh", () => {
  test("robots.txt welcomes search and answer crawlers and keeps training crawlers out by default", async ({ request }) => {
    const text = await (await request.get(`${WEB}/robots.txt`)).text();
    for (const bot of searchCrawlers) expect(text).toContain(`User-Agent: ${bot}`);
    const training = text.split(/\n\n/).find((block) => block.includes("User-Agent: GPTBot"))!;
    for (const bot of trainingCrawlers) expect(training).toContain(`User-Agent: ${bot}`);
    expect(training).toContain("Disallow: /");
    expect(text).toContain("Disallow: /internal/");
    expect(text).toContain("Sitemap:");
  });

  test("the IndexNow key file and llms.txt are served when configured", async ({ request }) => {
    expect(await (await request.get(`${WEB}/indexnow-key.txt`)).text()).toBe("e2eindexnowkey123");
    const llms = await (await request.get(`${WEB}/llms.txt`)).text();
    expect(llms).toContain("# Ratable");
    expect(llms).toContain("/en/compounds/best");
  });

  test("the refresh address needs the secret and accepts only site paths", async ({ request }) => {
    expect((await request.post(`${WEB}/internal/revalidate`, { data: { paths: ["/en"] } })).status()).toBe(401);
    expect((await request.post(`${WEB}/internal/revalidate`, { data: { paths: ["/en"] }, headers: { "x-revalidate-secret": "wrong" } })).status()).toBe(401);
    const ok = await request.post(`${WEB}/internal/revalidate`, {
      data: { paths: ["/en", "/ar/compounds", "https://evil.example/x", "/api/secret"] },
      headers: { "x-revalidate-secret": "e2e-secret" },
    });
    expect(ok.status()).toBe(200);
    expect(await ok.json()).toEqual({ revalidated: 2 });
  });
});

test.describe("guide pages and trust pages", () => {
  let nameEn = "";
  test.beforeAll(async () => {
    await waitForApi();
    const admin = await createUser(["Admin"], "Guide Admin");
    const owner = await createUser([], "Guide Owner");
    nameEn = `Guide Gardens ${uid()}`;
    const id = await makePlace(owner, admin, nameEn, `جاردنز ${uid()}`);
    for (let i = 0; i < 5; i++) {
      const reviewer = await createUser([], `Guide Reviewer ${i}`);
      const r = await reviewer.api.post(`/api/entities/${id}/reviews`, { data: { answers: [{ criterionId: "security", value: 5 }], text: `Guide review ${i}`, isAnonymous: true } });
      await publishVerified(((await r.json()) as { id: string }).id);
    }
  });

  test("the best-of page ranks verified places, shows the method and the list as a table", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`${WEB}/en/compounds/best`);
    await expect(page.locator("h1")).toHaveText("Best Compounds");
    await expect(page.getByText("Nobody pays to appear here")).toBeVisible();
    await expect(page.locator("table tbody tr", { hasText: nameEn })).toContainText("5");
    await expect(page.getByText("List last updated")).toBeVisible();
    const blocks = (await page.locator("script[type='application/ld+json']").allTextContents()).flatMap((b) => JSON.parse(b) as Record<string, unknown>[]);
    expect(blocks.some((b) => b["@type"] === "ItemList")).toBe(true);
    expect(await page.locator("link[rel=canonical]").getAttribute("href")).toContain("/en/compounds/best");
    await page.goto(`${WEB}/ar/compounds/best`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await context.close();
  });

  test("an empty category's guide is not indexed and an unknown one is a 404", async ({ request, page }) => {
    await page.goto(`${WEB}/en/cars/best`);
    expect(await page.locator("meta[name=robots]").getAttribute("content")).toContain("noindex");
    expect((await request.get(`${WEB}/en/nope/best`)).status()).toBe(404);
  });

  for (const path of ["/methodology", "/methodology/verification", "/methodology/moderation"]) {
    test(`${path}: six numbered rules and links to the other two`, async ({ page }) => {
      await page.goto(`${WEB}/en${path}`);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("ol > li")).toHaveCount(6);
      await expect(page.getByRole("navigation", { name: "How we work" }).getByRole("link")).toHaveCount(3);
    });
  }

  test("every entity page links to the methodology", async ({ page }) => {
    const anon = await pwRequest.newContext({ baseURL: API });
    const found = (await (await anon.get(`/api/entities/search?q=${encodeURIComponent(nameEn)}`)).json()) as { id: string; slugs: Record<string, string> }[];
    await anon.dispose();
    await page.goto(`${WEB}/en/compounds/${found[0].id}-${found[0].slugs.en}`);
    await expect(page.locator("#summary").locator("..").getByRole("link", { name: "How we calculate and verify" })).toHaveAttribute("href", "/en/methodology");
  });
});
