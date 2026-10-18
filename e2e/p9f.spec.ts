import AxeBuilder from "@axe-core/playwright";
import { expect, request as pwRequest, test, type Page } from "@playwright/test";
import { API, WEB, createUser, makePlace, publishVerified, signInBrowser, uid, waitForApi, type TestUser } from "./support";

let admin: TestUser;
let owner: TestUser;

test.beforeAll(async () => {
  await waitForApi();
  admin = await createUser(["Admin"], "P9f Admin");
  owner = await createUser([], "P9f Owner");
});

async function slugsOf(id: string) {
  const anon = await pwRequest.newContext({ baseURL: API });
  const entity = (await (await anon.get(`/api/entities/${id}`)).json()) as { slugs: Record<string, string> };
  await anon.dispose();
  return entity.slugs;
}

/** A place with `count` verified reviews that all score `score`, optionally with a verdict. Names are public; the reviewers are anonymous unless named. */
async function placeWith(opts: { name: string; count: number; score: number; verdict?: string; category?: string; fields?: Record<string, string>; anonymous?: boolean; reviewerName?: string }) {
  const category = opts.category ?? "compounds";
  let id: string;
  if (opts.fields) {
    const created = await owner.api.post("/api/entities", {
      data: { nameEn: opts.name, nameAr: `${opts.name} ع`, categoryId: category, longitude: 31.2357, latitude: 30.0444, city: "Cairo", fields: opts.fields },
    });
    expect(created.status()).toBe(201);
    id = ((await created.json()) as { id: string }).id;
    expect((await admin.api.post(`/api/moderation/entities/${id}/approve`)).status()).toBe(200);
  } else {
    id = await makePlace(owner, admin, opts.name, `${opts.name} ع`);
  }
  const criterion = category === "compounds" ? "security" : "taste";
  for (let i = 0; i < opts.count; i++) {
    const reviewer = await createUser([], opts.reviewerName ?? `Reviewer ${uid()}`);
    const res = await reviewer.api.post(`/api/entities/${id}/reviews`, {
      data: { answers: [{ criterionId: criterion, value: opts.score }], text: `Review ${i}`, isAnonymous: opts.anonymous ?? false, verdict: opts.verdict ?? null },
    });
    expect(res.status()).toBe(201);
    await publishVerified(((await res.json()) as { id: string }).id);
  }
  return { id, slugs: await slugsOf(id) };
}

test.describe("verdicts", () => {
  test("a verdict shows once five verified reviewers chose one, and unverified votes never count", async ({ browser }) => {
    const name = `Verdict Villas ${uid()}`;
    const place = await placeWith({ name, count: 5, score: 4, verdict: "worth" });
    // Twenty public but unverified "not worth it" votes: no effect on the verdict or the score.
    for (let i = 0; i < 3; i++) {
      const reviewer = await createUser([], `Loose ${uid()}`);
      const res = await reviewer.api.post(`/api/entities/${place.id}/reviews`, { data: { answers: [{ criterionId: "security", value: 1 }], verdict: "not_worth" } });
      const id = ((await res.json()) as { id: string }).id;
      // Published but left unverified.
      const { MongoClient, ObjectId } = await import("mongodb");
      const client = new MongoClient("mongodb://localhost:27017");
      await client.connect();
      await client.db("ratable_e2e").collection("reviews").updateOne({ _id: new ObjectId(id) }, { $set: { status: "Published" } });
      await client.close();
    }

    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`${WEB}/en/compounds/${place.id}-${place.slugs.en}`);
    await expect(page.getByTestId("verdict")).toHaveText("Worth it");
    await expect(page.getByText("100% of 5 verified reviewers")).toBeVisible();
    await expect(page.locator("header").getByText("4.0").first()).toBeVisible(); // the score is the average of the verified scores only
    await page.goto(`${WEB}/ar/compounds/${place.id}-${place.slugs.ar}`);
    await expect(page.getByTestId("verdict")).toHaveText("يستاهل");
    await context.close();

    // The card in the category list carries the same sticker, and the order is by score.
    const list = await (await (await pwRequest.newContext({ baseURL: API })).get("/api/categories/compounds/places?limit=50")).json();
    const card = (list.places as { name: { en: string }; verdict: { kind: string } | null; overall: number }[]).find((p) => p.name.en === name)!;
    expect(card.verdict?.kind).toBe("worth");
    expect(card.overall).toBe(4);
  });

  test("fewer than five verified votes show no sticker", async ({ page }) => {
    const place = await placeWith({ name: `Quiet Quarters ${uid()}`, count: 4, score: 5, verdict: "worth" });
    await page.goto(`${WEB}/en/compounds/${place.id}-${place.slugs.en}`);
    await expect(page.getByTestId("verdict")).toHaveCount(0);
  });

  test("the review form offers a verdict, keeps it on edit, and it can be cleared", async ({ page }) => {
    const place = await placeWith({ name: `Form Flats ${uid()}`, count: 1, score: 4 });
    const reader = await createUser([], "Verdict Reader");
    await signInBrowser(page, reader);
    await page.goto(`${WEB}/en/compounds/${place.id}-${place.slugs.en}/review`);
    await page.getByRole("group", { name: "Security" }).getByLabel("5 out of 5").check({ force: true });
    await page.getByLabel("Hidden gem").check({ force: true });
    await page.getByRole("button", { name: "Publish review" }).click();
    await expect(page.getByRole("status").first()).toContainText("Your review was received");
    const mine = async () => ((await (await reader.api.get(`/api/me/reviews?entityId=${place.id}`)).json()) as { verdict: string | null }[])[0].verdict;
    expect(await mine()).toBe("hidden_gem");

    await page.goto(`${WEB}/en/compounds/${place.id}-${place.slugs.en}/review`);
    await expect(page.getByLabel("Hidden gem")).toBeChecked();
    await page.getByLabel("No verdict").check({ force: true });
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status").first()).toContainText("Your review was received");
    expect(await mine()).toBeNull();
  });
});

test.describe("collections", () => {
  let top: { id: string; slugs: Record<string, string> };

  test.beforeAll(async () => {
    top = await placeWith({ name: `List Leader ${uid()}`, count: 3, score: 5 });
    await placeWith({ name: `List Runner ${uid()}`, count: 3, score: 3 });
  });

  test("a list is server-rendered with the rule, an updated date, the nobody-pays line and structured data", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`${WEB}/en/lists/L01-top-compounds`);
    await expect(page.locator("h1")).toHaveText("Top compounds");
    await expect(page.getByText("Nobody pays to appear in this list or to rank higher.")).toBeVisible();
    await expect(page.getByText(/Places appear with at least 3 verified reviews/)).toBeVisible();
    await expect(page.getByText(/Last updated:/)).toBeVisible();
    await expect(page.locator("main ol > li").filter({ hasText: "List Leader" })).toHaveCount(1);
    const blocks = (await page.locator("script[type='application/ld+json']").allTextContents()).flatMap((b) => JSON.parse(b) as Record<string, unknown>[]);
    const itemList = blocks.find((b) => b["@type"] === "ItemList") as { itemListElement: { name: string; url: string }[] };
    const leader = itemList.itemListElement.find((e) => e.name.includes("List Leader"))!;
    expect(leader.url).toContain(`/en/compounds/${top.id}-`);
    expect(blocks.some((b) => b["@type"] === "BreadcrumbList")).toBe(true);
    expect(await page.locator("link[rel=canonical]").getAttribute("href")).toContain("/en/lists/L01-top-compounds");
    // hreflang points at each language's real address (its own slug), not at one that redirects.
    const ar = await page.locator("link[rel=alternate][hreflang=ar-EG]").getAttribute("href");
    expect(decodeURIComponent(ar ?? "")).toContain("/ar/lists/L01-أفضل-الكمبوندات");
    await context.close();
  });

  test("an old slug or the other language's slug is redirected permanently", async ({ request }) => {
    const wrong = await request.get(`${WEB}/en/lists/L01-old-name`, { maxRedirects: 0 });
    expect([301, 308]).toContain(wrong.status());
    expect(wrong.headers().location).toContain("/en/lists/L01-top-compounds");
    const arabic = await request.get(`${WEB}/ar/lists/L01-top-compounds`, { maxRedirects: 0 });
    expect([301, 308]).toContain(arabic.status());
    expect(decodeURIComponent(arabic.headers().location)).toContain("/ar/lists/L01-أفضل-الكمبوندات");
    expect((await request.get(`${WEB}/en/lists/L99-nothing`)).status()).toBe(404);
  });

  test("the index lists them and the sitemap carries them", async ({ page, request }) => {
    await page.goto(`${WEB}/ar/lists`);
    await expect(page.locator("h1")).toHaveText("قوائم مختارة");
    await expect(page.locator("main ul a")).toHaveCount(4);
    const part = await (await request.get(`${WEB}/sitemaps/en-static.xml`)).text();
    expect(part).toContain("/en/lists/L01-top-compounds");
    expect(part).toContain("/en/lists</loc>");
  });

  test("a list with an area keeps to it, and shows the price band", async ({ page }) => {
    const name = `Cairo Kitchen ${uid()}`;
    await placeWith({ name, count: 3, score: 5, category: "restaurants-cafes", fields: { priceBand: "$$" } });
    await page.goto(`${WEB}/en/lists/L02-top-restaurants-in-cairo`);
    const card = page.locator("article", { hasText: name });
    await expect(card).toBeVisible();
    await expect(card).toContainText("Price: $$");
    await expect(page.getByText(/in Cairo/).first()).toBeVisible();
  });
});

test.describe("near me", () => {
  test("distances appear only after the visitor shares a location, travel in a header and are kept nowhere", async ({ browser }) => {
    const name = `Near Nile ${uid()}`;
    await placeWith({ name, count: 3, score: 5 });
    const context = await browser.newContext({ permissions: ["geolocation"], geolocation: { latitude: 30.06, longitude: 31.23 } });
    const page = await context.newPage();
    const requests: { url: string; header: string | undefined }[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/categories/compounds/places") || r.url().includes("/api/collections/")) requests.push({ url: r.url(), header: r.headers()["x-visitor-location"] });
    });
    await page.goto(`${WEB}/en/lists/L01-top-compounds`);
    const card = page.locator("article", { hasText: name });
    await expect(card).not.toContainText(" km"); // nothing before the visitor asks
    expect(requests).toHaveLength(0);

    await page.getByRole("button", { name: "Distance from me" }).click();
    await expect(card).toContainText(" km");
    expect(requests).toHaveLength(1);
    expect(requests[0].header).toMatch(/^30\.06\d*,31\.23\d*$/);
    expect(requests[0].url).not.toMatch(/lat=|lng=|30\.06/); // not in the address, so not in access logs

    // Nothing is stored in the browser either.
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + document.cookie);
    expect(stored).not.toContain("30.06");
    await context.close();
  });

  test("when the visitor says no, the list still works and says so", async ({ browser }) => {
    const context = await browser.newContext(); // no geolocation permission
    const page = await context.newPage();
    await page.goto(`${WEB}/en/lists/L01-top-compounds`);
    await context.grantPermissions([], { origin: WEB });
    await page.getByRole("button", { name: "Distance from me" }).click();
    await expect(page.getByRole("status").filter({ hasText: /could not get your location/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("article").first()).toBeVisible();
    await context.close();
  });
});

test.describe("anonymity on cards and lists", () => {
  test("an anonymous reviewer is never named on a card, a list or the entity page", async ({ browser }) => {
    const place = await placeWith({ name: `Quiet Court ${uid()}`, count: 3, score: 5, anonymous: true, reviewerName: "Hidden Hala" });
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    for (const url of [`/en/lists/L01-top-compounds`, `/en/compounds`, `/en/compounds/${place.id}-${place.slugs.en}`, `/en/compounds/best`]) {
      await page.goto(`${WEB}${url}`);
      expect(await page.content(), url).not.toContain("Hidden Hala");
    }
    await context.close();
  });
});

test.describe("themes", () => {
  test("with no stated preference the consumer pages are dark, and the account page has the switch", async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: "no-preference" });
    await context.addInitScript(() => localStorage.setItem("ratable-onboarded", "1"));
    const page = await context.newPage();
    await page.goto(`${WEB}/en`);
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(15, 17, 20)");

    const reader = await createUser([], "Theme Reader");
    await signInBrowser(page, reader);
    await page.goto(`${WEB}/en/me`);
    const group = page.getByRole("group", { name: "Theme" }).last();
    await group.getByRole("button", { name: "Light" }).click();
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(250, 248, 244)");
    await page.reload();
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(250, 248, 244)");
    await context.close();
  });

  test("a device that asks for light gets light", async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: "light" });
    await context.addInitScript(() => localStorage.setItem("ratable-onboarded", "1"));
    const page = await context.newPage();
    await page.goto(`${WEB}/ar`);
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(250, 248, 244)");
    await context.close();
  });
});

const wcag = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
}

test.describe("contrast in both themes and languages", () => {
  for (const lang of ["ar", "en"] as const) {
    for (const theme of ["light", "dark"] as const) {
      test(`lists, category cards and account: ${lang} ${theme}`, async ({ page }) => {
        const reader = await createUser([], "Contrast Person");
        await signInBrowser(page, reader);
        await page.emulateMedia({ colorScheme: theme });
        const listPath = lang === "ar" ? "/ar/lists" : "/en/lists";
        for (const path of [listPath, `/${lang}/lists/L01-${lang === "ar" ? encodeURIComponent("أفضل-الكمبوندات") : "top-compounds"}`, `/${lang}/compounds`, `/${lang}/me`]) {
          await page.goto(`${WEB}${path}`);
          await settle(page);
          const results = await new AxeBuilder({ page }).withTags(wcag).analyze();
          expect(results.violations.map((v) => `${path} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
          await page.screenshot({ path: `test-results/screens/p9f-${lang}-${theme}-${path.split("/").slice(2).join("-") || "home"}.png`.replace(/%[0-9A-F]{2}/g, ""), fullPage: true });
        }
      });
    }
  }
});
