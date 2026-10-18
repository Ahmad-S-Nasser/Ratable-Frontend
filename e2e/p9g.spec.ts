import AxeBuilder from "@axe-core/playwright";
import { expect, request as pwRequest, test, type Page } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
import { API, WEB, createUser, publishVerified, signInBrowser, uid, waitForApi, type TestUser } from "./support";

let admin: TestUser;
let owner: TestUser;

test.beforeAll(async () => {
  await waitForApi();
  admin = await createUser(["Admin"], "P9g Admin");
  owner = await createUser([], "P9g Owner");
});

async function mongo<T>(run: (db: ReturnType<MongoClient["db"]>) => Promise<T>) {
  const client = new MongoClient("mongodb://localhost:27017");
  await client.connect();
  try {
    return await run(client.db("ratable_e2e"));
  } finally {
    await client.close();
  }
}

/** A place in central Cairo (about `km` kilometres north of the middle), rated by verified reviewers who all gave `score`. */
async function cairoPlace(name: string, km: number, score: number, reviewers = 1) {
  const created = await owner.api.post("/api/entities", {
    data: { nameEn: name, nameAr: `${name} ع`, categoryId: "compounds", longitude: 31.2357, latitude: 30.0444 + km * 0.009, city: "Cairo" },
  });
  expect(created.status()).toBe(201);
  const id = ((await created.json()) as { id: string }).id;
  expect((await admin.api.post(`/api/moderation/entities/${id}/approve`)).status()).toBe(200);
  for (let i = 0; i < reviewers; i++) {
    const reviewer = await createUser([], `Nearby Reviewer ${uid()}`);
    const res = await reviewer.api.post(`/api/entities/${id}/reviews`, { data: { answers: [{ criterionId: "security", value: score }], text: "Nearby review", isAnonymous: false } });
    await publishVerified(((await res.json()) as { id: string }).id);
  }
  const anon = await pwRequest.newContext({ baseURL: API });
  const entity = (await (await anon.get(`/api/entities/${id}`)).json()) as { slugs: Record<string, string> };
  await anon.dispose();
  return { id, slugs: entity.slugs };
}

test.describe("onboarding", () => {
  test("the first visit shows the splash and four steps with Skip, dots and one lime button; the last needs 3 interests and a city", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } }); // a first-time visitor
    const page = await context.newPage();
    await page.goto(`${WEB}/en`);
    await expect(page).toHaveURL(`${WEB}/en/welcome`);
    await expect(page.getByTestId("splash")).toBeVisible();

    await expect(page.getByRole("heading", { level: 1, name: "Real people" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Skip" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Step 1 of 4" }).locator("li")).toHaveCount(4);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "A clear verdict" })).toBeVisible();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Points and badges" })).toBeVisible();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Pick your interests and city" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Skip" })).toBeVisible(); // Skip is always there

    const start = page.getByRole("button", { name: "Start" });
    await expect(start).toBeDisabled();
    await page.getByLabel("Compounds").check({ force: true });
    await page.getByLabel("Hotels and resorts").check({ force: true });
    await expect(start).toBeDisabled(); // two interests, no city
    await page.getByLabel("Restaurants and cafes").check({ force: true });
    await expect(start).toBeDisabled(); // three interests, no city
    await page.getByLabel("Your city").selectOption("cairo");
    await expect(start).toBeEnabled();
    await start.click();

    await expect(page).toHaveURL(`${WEB}/en`);
    expect(await page.evaluate(() => localStorage.getItem("ratable-onboarded"))).toBe("1");
    expect(JSON.parse(await page.evaluate(() => localStorage.getItem("ratable-prefs") ?? "{}"))).toMatchObject({ area: "cairo" });
    await page.reload();
    await expect(page).toHaveURL(`${WEB}/en`); // not asked again
    await context.close();
  });

  test("Skip goes straight to the home page and is remembered", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto(`${WEB}/ar`);
    await expect(page).toHaveURL(`${WEB}/ar/welcome`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await page.getByRole("button", { name: "تخطّي" }).click({ timeout: 10_000 });
    await expect(page).toHaveURL(`${WEB}/ar`);
    await page.reload();
    await expect(page).toHaveURL(`${WEB}/ar`);
    await context.close();
  });

  test("for a signed-in person the choices are saved to the profile, and nothing is asked for permission", async ({ browser }) => {
    const reader = await createUser([], "Onboarding Reader");
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    const prompts: string[] = [];
    page.on("dialog", (d) => prompts.push(d.message()));
    await signInBrowser(page, reader);
    await page.goto(`${WEB}/en/welcome`);
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Next", exact: true }).click({ timeout: 10_000 });
    for (const interest of ["Compounds", "Cars", "Appliances"]) await page.getByLabel(interest).check({ force: true });
    await page.getByLabel("Your city").selectOption("giza");
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page).toHaveURL(`${WEB}/en`);

    const me = (await (await reader.api.get("/api/me")).json()) as { profile: { interests: string[]; areaId: string } };
    expect(me.profile.areaId).toBe("giza");
    expect(me.profile.interests.sort()).toEqual(["appliances", "cars", "compounds"]);
    expect(prompts).toEqual([]);
    await context.close();
  });

  test("without JavaScript the home page is complete and nobody is sent anywhere", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`${WEB}/en`);
    await expect(page).toHaveURL(`${WEB}/en`);
    await expect(page.locator("h1")).toHaveCount(1);
    await context.close();
  });
});

test.describe("rewards", () => {
  test("My level shows the rank, the next one, the streak, badges, missions and the reasons, and the rank-up moment appears once", async ({ browser }) => {
    const reader = await createUser([], "Level Reader");
    await reader.api.get("/api/me/rewards"); // the first look records the starting rank
    await mongo((db) =>
      db.collection("contribution_events").insertMany([
        { userId: new ObjectId(reader.id), action: "written_review", points: 100, reason: "written_review", reference: "e2e-1", rootReference: "e2e-1", createdAt: new Date() },
        { userId: new ObjectId(reader.id), action: "photo", points: 5, reason: "photo", reference: "e2e-2", rootReference: "e2e-1", createdAt: new Date() },
      ]),
    );
    const context = await browser.newContext();
    await context.addInitScript(() => localStorage.setItem("ratable-onboarded", "1"));
    const page = await context.newPage();
    await signInBrowser(page, reader);
    await page.goto(`${WEB}/en/me/level`);

    await expect(page.getByRole("dialog", { name: "Rank up!" })).toBeVisible();
    await expect(page.getByRole("dialog")).toContainText("You reached Reviewer.");
    await page.getByRole("button", { name: "Great" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await expect(page.getByTestId("rank-name")).toHaveText("Reviewer");
    await expect(page.getByTestId("points-total")).toHaveText("105 points");
    await expect(page.getByText("395 points to reach Expert")).toBeVisible();
    await expect(page.getByTestId("streak")).toHaveText("1 weeks in a row");
    await expect(page.getByText("First words")).toBeVisible();
    await expect(page.getByText("Write two reviews this week")).toBeVisible();
    await expect(page.locator("section[aria-labelledby=recent]").getByText("Written review")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("dialog")).toHaveCount(0); // announced once
    await context.close();
  });

  test("My level asks a visitor to sign in", async ({ page }) => {
    await page.goto(`${WEB}/en/me/level`);
    await expect(page.locator("a[href*='/sign-in']")).toBeVisible();
  });

  test("How points work shows the real numbers and the rules, without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`${WEB}/en/points`);
    const config = (await (await (await pwRequest.newContext({ baseURL: API })).get("/api/rewards/config")).json()) as { points: Record<string, number> };
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(Object.keys(config.points).length);
    await expect(rows.filter({ hasText: "A published written review" })).toContainText("+10");
    await expect(rows.filter({ hasText: "A published video" })).toContainText("+20");
    await expect(rows.filter({ hasText: "helpful" })).toContainText("up to 20 points a day");
    await expect(page.getByText("Explorer")).toBeVisible();
    await expect(page.getByText("from 2,000 points")).toBeVisible();
    await expect(page.getByText("Points never change how much your review counts")).toBeVisible();
    await expect(page.getByText("No points are given for being positive or negative.")).toBeVisible();
    await page.goto(`${WEB}/ar/points`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("table tbody tr")).toHaveCount(Object.keys(config.points).length);
    await context.close();
  });

  test("after saving a review the person sees what they will earn, with the same words and numbers as the rules", async ({ page }) => {
    const place = await cairoPlace(`After Posting ${uid()}`, 5, 4);
    const reader = await createUser([], "Posting Reader");
    await signInBrowser(page, reader);
    await page.goto(`${WEB}/en/compounds/${place.id}-${place.slugs.en}/review`);
    await page.getByRole("group", { name: "Security" }).getByLabel("5 out of 5").check({ force: true });
    await page.getByRole("textbox").fill("A calm place with good security and tidy streets.");
    await page.getByLabel("Choose files").first().setInputFiles({ name: "p.jpg", mimeType: "image/jpeg", buffer: Buffer.from([0xff, 0xd8, 0xff, 0xda, 0, 2, 1, 2, 0xff, 0xd9]) });
    await page.getByRole("button", { name: "Publish review" }).click();
    const moment = page.getByTestId("after-posting");
    await expect(moment).toContainText("Written review: +10");
    await expect(moment).toContainText("Photo: +5");
    await expect(moment).toContainText("never change a score");
    await expect(moment).toContainText("Your level now: Explorer (0 points)");
  });

  test("a helpful vote counts publicly, belongs to the voter only, and earns the author 2 points", async ({ page, browser }) => {
    const place = await cairoPlace(`Helpful Place ${uid()}`, 6, 4);
    const author = await createUser([], "Helpful Author");
    const res = await author.api.post(`/api/entities/${place.id}/reviews`, { data: { answers: [{ criterionId: "security", value: 5 }], text: "A very useful review for neighbours", isAnonymous: false } });
    await publishVerified(((await res.json()) as { id: string }).id);
    const before = ((await (await author.api.get("/api/me/rewards")).json()) as { points: number }).points;

    // A visitor sees the button as a link to sign in.
    const anon = await browser.newContext();
    await anon.addInitScript(() => localStorage.setItem("ratable-onboarded", "1"));
    const visitor = await anon.newPage();
    await visitor.goto(`${WEB}/en/compounds/${place.id}-${place.slugs.en}`);
    await expect(visitor.locator("article", { hasText: "A very useful review" }).locator("..").getByRole("link", { name: "Helpful" })).toHaveAttribute("href", /sign-in/);
    await anon.close();

    const voter = await createUser([], "Helpful Voter");
    await signInBrowser(page, voter);
    await page.goto(`${WEB}/en/compounds/${place.id}-${place.slugs.en}`);
    const block = page.locator("li", { has: page.locator("article", { hasText: "A very useful review" }) });
    await block.getByRole("button", { name: "Helpful" }).click();
    await expect(block.getByRole("button", { name: "Marked helpful" })).toHaveAttribute("aria-pressed", "true");
    await expect(block.getByTestId("helpful-count")).toHaveText("1 found this helpful");
    await page.reload();
    await expect(block.getByRole("button", { name: "Marked helpful" })).toHaveAttribute("aria-pressed", "true"); // remembered for this person

    const after = ((await (await author.api.get("/api/me/rewards")).json()) as { points: number }).points;
    expect(after - before).toBe(2);
    // The author's own review has the button too, but the API refuses it: no voting for yourself.
    expect((await author.api.put(`/api/reviews/${(await (await author.api.get(`/api/me/reviews?entityId=${place.id}`)).json())[0].id}/helpful`)).status()).toBe(400);
  });
});

test.describe("nearby", () => {
  let near: { id: string };
  const names = { near: `Near Low ${uid()}`, mid: `Mid High ${uid()}`, far: `Far High ${uid()}`, outside: `Outside ${uid()}` };

  test.beforeAll(async () => {
    near = await cairoPlace(names.near, 0.4, 3);
    await cairoPlace(names.mid, 2, 5);
    await cairoPlace(names.far, 4, 5);
    await cairoPlace(names.outside, 12, 5);
  });

  test("with no choice made, the screen explains why it asks and offers an area instead", async ({ page }) => {
    await page.goto(`${WEB}/en/nearby`);
    const permission = page.getByTestId("permission-screen");
    await expect(permission).toContainText("We do not store it or link it to your account");
    await expect(permission.getByRole("button", { name: "Allow location" })).toBeVisible();
    expect(await page.locator("meta[name=robots]").getAttribute("content")).toContain("noindex");
  });

  test("an area is chosen from the picker, results stay inside the distance, ordered by score then distance, with a map and an empty state", async ({ page }) => {
    await page.goto(`${WEB}/en/nearby`);
    await page.getByRole("button", { name: "Choose an area" }).first().click();
    const picker = page.getByRole("dialog", { name: "Choose an area" });
    await picker.getByLabel("Search for a city or an area").fill("cairo");
    await expect(picker.getByRole("button", { name: "New Cairo" })).toBeVisible();
    await picker.getByRole("button", { name: "Cairo", exact: true }).click();

    // 5 km (the default): the 0.4, 2 and 4 km places, not the 12 km one.
    await expect(page.getByTestId("nearby-count")).toContainText("places within 5 km");
    const list = page.locator("main ol").first();
    await expect(list.locator("article", { hasText: names.outside })).toHaveCount(0);
    const order = await list.locator("article h3").allInnerTexts();
    const own = order.filter((n) => Object.values(names).includes(n));
    expect(own).toEqual([names.mid, names.far, names.near]); // score 5 (nearest first), then the lower score

    await page.getByRole("button", { name: "25 km" }).click();
    await expect(list.locator("article", { hasText: names.outside })).toHaveCount(1);
    await page.getByRole("button", { name: "1 km" }).click();
    await expect(list.locator("article", { hasText: names.mid })).toHaveCount(0);
    await expect(list.locator("article", { hasText: names.near })).toHaveCount(1);

    await page.getByRole("button", { name: "Map" }).click();
    await expect(page.getByRole("img", { name: "Map of nearby places" })).toBeVisible();
    expect(await page.getByTestId("map-dot").count()).toBeGreaterThanOrEqual(1);

    // An area with nothing rated in it says so.
    await page.getByRole("button", { name: /From Cairo/ }).click();
    await page.getByRole("dialog").getByLabel("Search for a city or an area").fill("muscat");
    await page.getByRole("dialog").getByRole("button", { name: "Muscat" }).click();
    await expect(page.getByTestId("nearby-empty")).toContainText("No rated places within 1 km");
  });

  test("the device location is asked only when the person allows it, travels in a header and is kept nowhere", async ({ browser }) => {
    const context = await browser.newContext({ permissions: ["geolocation"], geolocation: { latitude: 30.0444, longitude: 31.2357 } });
    const page = await context.newPage();
    const seen: { url: string; header?: string }[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/places")) seen.push({ url: r.url(), header: r.headers()["x-visitor-location"] });
    });
    await page.goto(`${WEB}/en/nearby`);
    expect(seen).toHaveLength(0); // nothing is asked or sent before the button
    await page.getByRole("button", { name: "Allow location" }).click();
    await expect(page.getByTestId("nearby-count")).toBeVisible({ timeout: 15_000 });
    expect(seen[0].header).toMatch(/^30\.0444\d*,31\.2357\d*$/);
    expect(seen[0].url).not.toMatch(/lat|lng|30\.04/);
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + document.cookie);
    expect(stored).not.toContain("30.04");
    expect(await page.locator("article h3", { hasText: near.id }).count()).toBe(0);
    await context.close();
  });

  test("when the device location is refused, the screen says so and the area choice still works", async ({ browser }) => {
    const context = await browser.newContext(); // no geolocation permission is granted
    const page = await context.newPage();
    await page.goto(`${WEB}/en/nearby`);
    await page.getByRole("button", { name: "Allow location" }).click();
    await expect(page.getByTestId("permission-screen").getByRole("status")).toContainText("We could not get your location", { timeout: 20_000 });
    await page.getByTestId("permission-screen").getByRole("button", { name: "Choose an area" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cairo", exact: true }).click();
    await expect(page.getByTestId("nearby-count")).toBeVisible();
    await context.close();
  });

  test("Arabic: right to left, with Arabic area names", async ({ page }) => {
    await page.goto(`${WEB}/ar/nearby?area=cairo`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("button", { name: /من القاهرة/ })).toBeVisible();
    await expect(page.getByTestId("nearby-count")).toBeVisible();
  });
});

const wcag = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
}

test.describe("contrast in both themes and languages", () => {
  for (const lang of ["ar", "en"] as const) {
    for (const theme of ["light", "dark"] as const) {
      test(`onboarding, level, points and nearby: ${lang} ${theme}`, async ({ browser }) => {
        const context = await browser.newContext({ colorScheme: theme });
        await context.addInitScript(() => localStorage.setItem("ratable-onboarded", "1"));
        const page = await context.newPage();
        const reader = await createUser([], "Contrast Person");
        await signInBrowser(page, reader);

        // Onboarding: each of the four steps.
        await page.goto(`${WEB}/${lang}/welcome`);
        await page.locator("h1").waitFor({ timeout: 10_000 });
        for (let i = 0; i < 4; i++) {
          await settle(page);
          const results = await new AxeBuilder({ page }).withTags(wcag).analyze();
          expect(results.violations.map((v) => `welcome step ${i + 1} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
          await page.screenshot({ path: `test-results/screens/p9g-${lang}-${theme}-welcome-${i + 1}.png`, fullPage: true });
          if (i < 3) await page.locator("footer button").last().click();
        }

        for (const path of ["/me/level", "/points", "/nearby?area=cairo"]) {
          await page.goto(`${WEB}/${lang}${path}`);
          await settle(page);
          const results = await new AxeBuilder({ page }).withTags(wcag).analyze();
          expect(results.violations.map((v) => `${path} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
          await page.screenshot({ path: `test-results/screens/p9g-${lang}-${theme}-${path.split("/")[1].split("?")[0]}.png`, fullPage: true });
        }
        await context.close();
      });
    }
  }
});
