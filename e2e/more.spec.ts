import AxeBuilder from "@axe-core/playwright";
import { expect, request as pwRequest, test, type Page } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
import { API, WEB, createUser, makePlace, publishVerified, signInBrowser, uid, waitForApi, type TestUser } from "./support";

let admin: TestUser;
const places: { id: string; slugEn: string; nameEn: string }[] = [];
const reviewIds: string[] = [];
const COMMENTER = "Secret Commenter";

async function slugOf(id: string) {
  const anon = await pwRequest.newContext({ baseURL: API });
  const entity = (await (await anon.get(`/api/entities/${id}`)).json()) as { slugs: Record<string, string> };
  await anon.dispose();
  return entity.slugs.en;
}

async function mongo<T>(run: (db: ReturnType<MongoClient["db"]>) => Promise<T>) {
  const client = new MongoClient("mongodb://localhost:27017");
  await client.connect();
  try {
    return await run(client.db("ratable_e2e"));
  } finally {
    await client.close();
  }
}

test.beforeAll(async () => {
  await waitForApi();
  admin = await createUser(["Admin"], "More Admin");
  const owner = await createUser([], "Owner");
  for (const n of ["Alpha", "Beta"]) {
    const nameEn = `${n} Heights ${uid()}`;
    const id = await makePlace(owner, admin, nameEn, `${n} ${uid()}`);
    places.push({ id, slugEn: await slugOf(id), nameEn });
  }
  // Alpha has 5 verified reviews of different scores; the first is later edited so it has a public history.
  for (let i = 0; i < 5; i++) {
    const reviewer = await createUser([], `Reviewer ${i}`);
    const res = await reviewer.api.post(`/api/entities/${places[0].id}/reviews`, {
      data: { answers: [{ criterionId: "security", value: i + 1 }], text: `Alpha review ${i + 1}`, isAnonymous: false },
    });
    const id = ((await res.json()) as { id: string }).id;
    await publishVerified(id);
    reviewIds.push(id);
    if (i === 0) {
      const edit = await reviewer.api.put(`/api/reviews/${id}`, {
        data: { answers: [{ criterionId: "security", value: 1 }], text: "Alpha review 1 (edited)", isAnonymous: false },
      });
      expect(edit.status()).toBe(200);
      await publishVerified(id); // moderation approved the edit
    }
  }
  // One unverified review, so the "verified only" filter has something to hide.
  const loose = await createUser([], "Loose Reviewer");
  const res = await loose.api.post(`/api/entities/${places[0].id}/reviews`, { data: { answers: [{ criterionId: "security", value: 5 }], text: "Unverified opinion", isAnonymous: false } });
  const looseId = ((await res.json()) as { id: string }).id;
  await mongo((db) => db.collection("reviews").updateOne({ _id: new ObjectId(looseId) }, { $set: { status: "Published" } }));
  // Beta needs a score for the comparison.
  for (let i = 0; i < 5; i++) {
    const reviewer = await createUser([], `Beta Reviewer ${i}`);
    const r = await reviewer.api.post(`/api/entities/${places[1].id}/reviews`, { data: { answers: [{ criterionId: "security", value: 5 }], text: `Beta review ${i}`, isAnonymous: false } });
    await publishVerified(((await r.json()) as { id: string }).id);
  }
});

const alpha = (lang = "en", query = "") => `${WEB}/${lang}/compounds/${places[0].id}-${places[0].slugEn}${query}`;

test.describe("reviews: filters, history and comments", () => {
  test("verified-only and sort work without JavaScript, and the canonical stays on the base page", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(alpha());
    await expect(page.getByText("Unverified opinion")).toBeVisible();
    await page.goto(alpha("en", "?verified=1&sort=highest"));
    await expect(page.getByText("Unverified opinion")).toHaveCount(0);
    const texts = await page.locator("#reviews ~ ul > li article p[dir=auto]").allInnerTexts();
    expect(texts[0]).toBe("Alpha review 5");
    expect(await page.locator("link[rel=canonical]").getAttribute("href")).not.toContain("?");
    await context.close();
  });

  test("an edited review shows its dated earlier versions", async ({ page }) => {
    await page.goto(alpha());
    await page.getByText("Edit history").first().click();
    await expect(page.getByText("Version 1")).toBeVisible();
    await expect(page.getByText("Alpha review 1", { exact: true })).toBeVisible();
  });

  test("a comment is received, appears only after moderation, and an anonymous commenter is never named", async ({ page }) => {
    const commenter = await createUser([], COMMENTER);
    await signInBrowser(page, commenter);
    await page.goto(alpha());
    const box = page.getByRole("textbox", { name: "Write a comment" }).first();
    await box.fill("A helpful remark from a neighbour");
    await page.getByRole("switch", { name: "Anonymous comment" }).first().click();
    await page.getByRole("button", { name: "Send comment" }).first().click();
    await expect(page.getByRole("status").filter({ hasText: "received" })).toBeVisible();

    await page.reload();
    await expect(page.getByText("A helpful remark from a neighbour")).toHaveCount(0);

    await mongo((db) => db.collection("comments").updateMany({ text: "A helpful remark from a neighbour" }, { $set: { status: "Published" } }));
    await page.reload();
    await expect(page.getByText("A helpful remark from a neighbour")).toBeVisible();
    const html = await page.content();
    expect(html).not.toContain(COMMENTER);
  });
});

test.describe("compare, methodology, add a place", () => {
  test("the comparison is a real table with the better score marked", async ({ page }) => {
    await page.goto(`${WEB}/en/compare?a=${places[0].id}&b=${places[1].id}`);
    await expect(page.locator("h1")).toContainText(places[0].nameEn);
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toContainText("Overall score");
    await expect(page.locator("table tbody tr", { hasText: "Security" })).toContainText("5.0");
    expect(await page.locator("meta[name=robots]").getAttribute("content")).toContain("noindex");
    await page.goto(`${WEB}/en/compare?a=${places[0].id}`);
    await expect(page.getByText("The comparison is not possible")).toBeVisible();
  });

  test("the entity page offers a comparison form", async ({ page }) => {
    await page.goto(alpha());
    await page.getByLabel("Compare with another place").selectOption({ index: 0 });
    await page.getByRole("button", { name: "Comparison" }).click();
    await expect(page).toHaveURL(/\/en\/compare\?a=/);
  });

  for (const lang of ["ar", "en"] as const) {
    test(`methodology ${lang}: six rules, in the footer, accessible in both themes`, async ({ page }) => {
      await page.goto(`${WEB}/${lang}/methodology`);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("ol > li")).toHaveCount(6);
      await expect(page.locator(`footer a[href='/${lang}/methodology']`)).toBeVisible();
      for (const theme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme: theme });
        await settle(page);
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        expect(results.violations.map((v) => v.id)).toEqual([]);
      }
    });
  }

  test("adding a place: sign-in asked, then the place waits for a moderator", async ({ page }) => {
    await page.goto(`${WEB}/en/add`);
    await expect(page.locator("a[href*='/sign-in']")).toBeVisible();

    const reader = await createUser([], "Place Suggester");
    await signInBrowser(page, reader);
    const name = `Suggested Tower ${uid()}`;
    await page.goto(`${WEB}/en/add?category=compounds`);
    await expect(page.getByLabel("Category")).toHaveValue("compounds");
    await page.getByLabel("Name in English").fill(name);
    await page.getByLabel("City or area").fill("Cairo");
    await page.getByLabel("Latitude").fill("30.05");
    await page.getByLabel("Longitude").fill("31.23");
    await page.getByRole("button", { name: "Submit place" }).click();
    await expect(page.getByRole("status")).toContainText("Your request was received");
    const queue = (await (await admin.api.get("/api/moderation/entities")).json()) as { name: { en?: string } }[];
    expect(queue.some((q) => q.name.en === name)).toBe(true);
    // Not public until approved.
    const anon = await pwRequest.newContext({ baseURL: API });
    const found = (await (await anon.get(`/api/entities/search?q=${encodeURIComponent(name)}`)).json()) as unknown[];
    await anon.dispose();
    expect(found).toHaveLength(0);
  });

  test("adding a place without a location shows a clear message", async ({ page }) => {
    const reader = await createUser([], "No Location");
    await signInBrowser(page, reader);
    await page.goto(`${WEB}/en/add`);
    await page.getByLabel("Category").selectOption("compounds");
    await page.getByLabel("Name in English").fill("Nowhere Towers");
    await page.getByRole("button", { name: "Submit place" }).click();
    await expect(page.locator("form [role=alert]")).toContainText("Set the location");
  });
});

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
}
