import AxeBuilder from "@axe-core/playwright";
import { expect, request as pwRequest, test, type Page } from "@playwright/test";
import { API, WEB, createUser, makeOwner, makePlace, signInBrowser, uid, waitForApi, writeReview, type TestUser } from "./support";

let admin: TestUser;
let moderator: TestUser;

test.beforeAll(async () => {
  await waitForApi();
  admin = await createUser(["Admin"], "Console Admin");
  moderator = await createUser(["Moderator"], "Console Moderator");
});

const open = async (page: Page, path: string, lang = "en") => page.goto(`${WEB}/${lang}/console${path}`);
const publicReviews = async (entityId: string) => {
  const anon = await pwRequest.newContext({ baseURL: API });
  const list = (await (await anon.get(`/api/entities/${entityId}/reviews`)).json()) as { id: string; text: string; underReview: boolean }[];
  await anon.dispose();
  return list;
};

test.describe("access", () => {
  test("a visitor is asked to sign in and a reader without a role gets no access", async ({ page }) => {
    await open(page, "");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByLabel("Phone number")).toBeVisible();

    const reader = await createUser([], "Just a Reader");
    await signInBrowser(page, reader);
    await open(page, "");
    await expect(page.getByRole("heading", { name: "No access" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Reviews and comments" })).toHaveCount(0);
  });

  test("a moderator sees the moderation pages but not the admin ones, even by address", async ({ page }) => {
    await signInBrowser(page, moderator);
    await open(page, "");
    await expect(page.getByRole("link", { name: "Reviews and comments" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Audit log" })).toHaveCount(0);

    await open(page, "/audit");
    await expect(page.getByRole("heading", { name: "No access" })).toBeVisible();
  });

  test("the console opens without any error in the browser", async ({ page }) => {
    const problems: string[] = [];
    page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") problems.push(m.text().slice(0, 300)); });
    page.on("pageerror", (e) => problems.push(e.message));
    await signInBrowser(page, admin);
    for (const path of ["", "/reviews", "/entities", "/proofs", "/reports", "/disputes", "/audit", "/users", "/ai", "/lookup"]) {
      await open(page, path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.waitForLoadState("networkidle");
    }
    expect(problems).toEqual([]);
  });

  test("signing out ends the session", async ({ page }) => {
    const staff = await createUser(["Moderator"]);
    await signInBrowser(page, staff);
    await open(page, "");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    expect((await staff.api.get("/api/me")).status()).toBe(401);
  });
});

test.describe("reviews and comments queue", () => {
  test("a moderator reads a waiting review, sees why, and publishes it", async ({ page }) => {
    const reader = await createUser([], "Reader " + uid());
    const place = await makePlace(reader, admin, "Publish Place " + uid());
    const text = "The lifts are slow in the evening " + uid();
    const review = await writeReview(reader, place, text, { isAnonymous: true });
    expect((await publicReviews(place)).length).toBe(0);

    await signInBrowser(page, moderator);
    await open(page, "/reviews");
    const card = page.getByTestId("case").filter({ hasText: text });
    await expect(card).toBeVisible();
    await expect(card).toContainText("The AI could not check it.");
    await expect(card).toContainText("Posted anonymously");
    await expect(card).not.toContainText("Reader");                // never who wrote it
    await card.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("Published", { exact: true })).toBeVisible();
    await expect(card).toHaveCount(0);

    expect((await publicReviews(place)).map((r) => r.id)).toContain(review);
  });

  test("hiding needs a reason, the review disappears and the author is told why", async ({ page }) => {
    const reader = await createUser([], "Reader " + uid());
    const place = await makePlace(reader, admin, "Hide Place " + uid());
    const text = "Call me on 0100 000 0000 for details " + uid();
    await writeReview(reader, place, text);

    await signInBrowser(page, moderator);
    await open(page, "/reviews");
    const card = page.getByTestId("case").filter({ hasText: text });
    await card.getByRole("button", { name: "Hide" }).click();
    const submit = card.getByRole("button", { name: "Hide" });
    await expect(submit).toBeDisabled();                           // no reason yet
    await card.getByLabel("Reason").fill("Contains a phone number");
    await submit.click();
    await expect(card).toHaveCount(0);

    expect((await publicReviews(place)).length).toBe(0);
    const mine = (await (await reader.api.get("/api/me/reviews")).json()) as { status: string; moderationReason: string }[];
    expect(mine[0].status).toBe("Hidden");
    expect(mine[0].moderationReason).toBe("Contains a phone number");
  });

  test("an edited review shows what changed", async ({ page }) => {
    const reader = await createUser([], "Reader " + uid());
    const place = await makePlace(reader, admin, "Edit Place " + uid());
    const first = "First version of my review " + uid();
    const review = await writeReview(reader, place, first);
    const second = "Second and different version " + uid();
    const edited = await reader.api.put(`/api/reviews/${review}`, { data: { answers: [{ criterionId: "security", value: 2 }], text: second } });
    expect(edited.status()).toBe(200);

    await signInBrowser(page, moderator);
    await open(page, "/reviews?kind=review");
    const card = page.getByTestId("case").filter({ hasText: second });
    await expect(card).toContainText("Before the edit");
    await expect(card).toContainText(first);
    await expect(card).toContainText("Version 2");
    await expect(page.getByTestId("case").filter({ hasText: first }).filter({ hasNotText: second })).toHaveCount(0); // the old version's case is gone
  });

  test("two moderators at once: the second one is told it was already decided and the list refreshes", async ({ page }) => {
    const reader = await createUser([], "Reader " + uid());
    const place = await makePlace(reader, admin, "Race Place " + uid());
    const text = "Both of us look at this " + uid();
    await writeReview(reader, place, text);

    await signInBrowser(page, moderator);
    await open(page, "/reviews");
    const card = page.getByTestId("case").filter({ hasText: text });
    await expect(card).toBeVisible();
    const queue = (await (await admin.api.get("/api/moderation/cases")).json()) as { items: { id: string; content: { text: string } }[] };
    const id = queue.items.find((i) => i.content.text === text)!.id;
    await admin.api.post(`/api/moderation/cases/${id}/publish`);   // someone else decides first

    await card.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("Someone has already decided this. The list was refreshed.")).toBeVisible();
    await expect(page.getByTestId("case").filter({ hasText: text })).toHaveCount(0);
  });

  test("the queue can be filtered to comments", async ({ page }) => {
    const reader = await createUser([], "Reader " + uid());
    const commenter = await createUser([], "Commenter " + uid());
    const place = await makePlace(reader, admin, "Comment Place " + uid());
    const review = await writeReview(reader, place, "A review to comment on " + uid());
    await admin.api.post(`/api/moderation/cases/${(await caseIdFor(review))}/publish`);
    const comment = "A comment waiting for a person " + uid();
    expect((await commenter.api.post(`/api/reviews/${review}/comments`, { data: { text: comment } })).status()).toBe(201);

    await signInBrowser(page, moderator);
    await open(page, "/reviews?kind=comment");
    await expect(page.getByTestId("case").filter({ hasText: comment })).toBeVisible();
    await expect(page.getByTestId("case").filter({ hasText: "A review to comment on" })).toHaveCount(0);
    await page.getByRole("tab", { name: "All" }).click();
    await expect(page).not.toHaveURL(/kind=/);
  });
});

async function caseIdFor(contentId: string): Promise<string> {
  const queue = (await (await admin.api.get("/api/moderation/cases?limit=100")).json()) as { items: { id: string; contentId: string }[] };
  return queue.items.find((i) => i.contentId === contentId)!.id;
}

test.describe("new places", () => {
  test("a duplicate candidate can be merged into the existing place and the old link redirects", async ({ page }) => {
    const reader = await createUser([], "Reader " + uid());
    const tag = uid();
    const existing = await makePlace(reader, admin, `Palm Residence ${tag}`);
    const submitted = await reader.api.post("/api/entities", { data: { nameEn: `palm  residence ${tag}`, categoryId: "compounds", longitude: 31.641, latitude: 30.101, city: "Cairo" } });
    const dupId = ((await submitted.json()) as { id: string }).id;

    await signInBrowser(page, moderator);
    await open(page, "/entities");
    const card = page.getByTestId("entity").filter({ hasText: `palm  residence ${tag}`.replace(/\s+/g, " ") });
    await expect(card).toBeVisible();
    const candidate = card.getByTestId("candidate");
    await expect(candidate).toContainText(`Palm Residence ${tag}`);
    await expect(candidate).toContainText("100% name match");
    await candidate.getByRole("button", { name: "Merge into this" }).click();
    await card.getByRole("button", { name: "Confirm" }).click();
    await expect(card).toHaveCount(0);

    const anon = await pwRequest.newContext({ baseURL: API, maxRedirects: 0 });
    const old = await anon.get(`/api/entities/${dupId}`);
    expect(old.status()).toBe(301);
    expect(old.headers()["location"]).toBe(`/api/entities/${existing}`);
    await anon.dispose();
  });

  test("a new place can be approved and then it is public; a bad one is rejected with a reason", async ({ page }) => {
    const reader = await createUser([], "Reader " + uid());
    const good = `Approve Me ${uid()}`;
    const bad = `Reject Me ${uid()}`;
    const goodId = ((await (await reader.api.post("/api/entities", { data: { nameEn: good, categoryId: "compounds", longitude: 30.5, latitude: 29.5 } })).json()) as { id: string }).id;
    await reader.api.post("/api/entities", { data: { nameEn: bad, categoryId: "compounds", longitude: 33.5, latitude: 27.5 } });

    await signInBrowser(page, moderator);
    await open(page, "/entities");
    const goodCard = page.getByTestId("entity").filter({ hasText: good });
    await expect(goodCard).toContainText("No similar place nearby.");
    await goodCard.getByRole("button", { name: "Approve and publish" }).click();
    await expect(goodCard).toHaveCount(0);
    expect((await (await pwRequest.newContext({ baseURL: API })).get(`/api/entities/${goodId}`)).status()).toBe(200);

    const badCard = page.getByTestId("entity").filter({ hasText: bad });
    await badCard.getByRole("button", { name: "Reject" }).click();
    await badCard.getByLabel("Reason").fill("Not a real compound");
    await badCard.getByRole("button", { name: "Reject" }).click();
    await expect(badCard).toHaveCount(0);
  });
});

test.describe("reports and disputes", () => {
  test("a reported review can be dismissed", async ({ page }) => {
    const author = await createUser([], "Author " + uid());
    const reporter = await createUser([], "Reporter " + uid());
    const place = await makePlace(author, admin, "Report Place " + uid());
    const text = "A review that someone reports " + uid();
    const review = await writeReview(author, place, text);
    await admin.api.post(`/api/moderation/cases/${await caseIdFor(review)}/publish`);
    expect((await reporter.api.post("/api/reports", { data: { targetType: "Review", targetId: review, reason: "spam", details: "looks like an advert" } })).status()).toBe(201);

    await signInBrowser(page, moderator);
    await open(page, "/reports");
    const card = page.getByTestId("report").filter({ hasText: text });
    await expect(card).toContainText("Reports: 1");
    await expect(card).toContainText("looks like an advert");
    await card.getByRole("button", { name: "Dismiss" }).click();
    await expect(card).toHaveCount(0);
    expect((await publicReviews(place)).map((r) => r.id)).toContain(review);
  });

  test("a disputed review stays visible with a label until a moderator keeps or hides it", async ({ page }) => {
    const author = await createUser([], "Author " + uid());
    const business = await createUser(["BusinessOwner"], "Business " + uid());
    const place = await makePlace(author, admin, "Dispute Place " + uid());
    const text = "The management never answers " + uid();
    await makeOwner(business, place);
    const review = await writeReview(author, place, text);
    await admin.api.post(`/api/moderation/cases/${await caseIdFor(review)}/publish`);
    expect((await business.api.post(`/api/reviews/${review}/disputes`, { data: { reason: "This review describes another compound entirely" } })).status()).toBe(201);
    expect((await publicReviews(place))[0].underReview).toBe(true);

    await signInBrowser(page, moderator);
    await open(page, "/disputes");
    const card = page.getByTestId("dispute").filter({ hasText: text });
    await expect(card).toContainText("This review describes another compound entirely");
    await card.getByRole("button", { name: "Keep the review" }).click();
    await expect(card).toHaveCount(0);
    expect((await publicReviews(place))[0].underReview).toBe(false);
  });
});

test.describe("administration", () => {
  test("the audit log shows decisions and can be filtered", async ({ page }) => {
    const reader = await createUser([], "Reader " + uid());
    const place = await makePlace(reader, admin, "Audit Place " + uid());
    const review = await writeReview(reader, place, "Something to audit " + uid());
    await admin.api.post(`/api/moderation/cases/${await caseIdFor(review)}/publish`);

    await signInBrowser(page, admin);
    await open(page, "/audit");
    await expect(page.getByTestId("audit-table")).toContainText("Published");
    await page.getByLabel("Action starts with").fill("entity.");
    await page.getByRole("button", { name: "Apply" }).click();
    const rows = page.getByTestId("audit-table").locator("tbody tr");
    await expect(rows.first()).toContainText("Place approved");
    await expect(page.getByTestId("audit-table")).not.toContainText("moderation.published");
    await page.getByRole("button", { name: "Clear" }).click();
    await expect(page.getByTestId("audit-table")).toContainText("moderation.published");
  });

  test("an account can be suspended with a reason and then it is signed out", async ({ page }) => {
    const target = await createUser([], "Target " + uid());
    await signInBrowser(page, admin);
    await open(page, "/users");
    const card = page.getByTestId("user").filter({ hasText: target.id });
    await expect(card).toBeVisible();
    await expect(card).not.toContainText("+20");                    // no phone numbers anywhere
    await card.getByRole("button", { name: "Suspend" }).click();
    await card.getByLabel("Reason").fill("Repeated abuse");
    await card.getByRole("button", { name: "Suspend" }).click();
    await expect.poll(async () => (await target.api.get("/api/me")).status()).toBe(401);
  });

  test("the author look-up needs a reason and shows who wrote an anonymous review", async ({ page }) => {
    const author = await createUser([], "Hidden " + uid());
    const place = await makePlace(author, admin, "Lookup Place " + uid());
    const review = await writeReview(author, place, "An anonymous review to look up " + uid(), { isAnonymous: true });

    await signInBrowser(page, admin);
    await open(page, "/lookup");
    await page.getByLabel("Id of the review or comment").fill(review);
    const run = page.getByRole("button", { name: "Look up" });
    await expect(run).toBeDisabled();
    await page.getByLabel("Reason", { exact: true }).fill("Court order 2026/55 about this review");
    await run.click();
    await expect(page.getByTestId("lookup-result")).toContainText(author.id);
    await expect(page.getByTestId("lookup-result")).not.toContainText("+20");
  });

  test("the AI spend page loads", async ({ page }) => {
    await signInBrowser(page, admin);
    await open(page, "/ai");
    await expect(page.getByRole("heading", { name: "AI spend" })).toBeVisible();
    await expect(page.getByText("Daily cap", { exact: true })).toBeVisible();
  });
});

test.describe("language, theme and layout", () => {
  test("Arabic is right to left and the language and theme can be switched", async ({ page }) => {
    await signInBrowser(page, admin);
    await open(page, "", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "نظرة عامة" })).toBeVisible();
    await expect(page.locator("aside")).toBeVisible();

    await page.getByRole("link", { name: "English" }).click();
    await expect(page).toHaveURL(/\/en\/console/);
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");

    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.getByRole("button", { name: /^(Dark|Light)$/ }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark"); // remembered
    await page.getByRole("button", { name: /^(Dark|Light)$/ }).click();
  });

  test("on a phone the page does not scroll sideways and the menu opens", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const reader = await createUser([], "Reader " + uid());
    const place = await makePlace(reader, admin, "Phone Place " + uid());
    await writeReview(reader, place, "A long review to check wrapping on a small screen " + uid());
    await signInBrowser(page, moderator);
    await open(page, "/reviews");
    await expect(page.getByTestId("case").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.getByRole("button", { name: "Menu" }).click();
    await expect(page.getByRole("link", { name: "Reports" })).toBeVisible();
  });

  for (const lang of ["en", "ar"]) {
    for (const theme of ["light", "dark"]) {
      test(`no accessibility violations on the overview and the queue (${lang}, ${theme})`, async ({ page }) => {
        const reader = await createUser([], "Reader " + uid());
        const place = await makePlace(reader, admin, `Axe Place ${uid()}`, lang === "ar" ? `مكان ${uid()}` : "");
        await writeReview(reader, place, lang === "ar" ? "الأسانسير بطيء جدا في المساء " + uid() : "The lifts are slow in the evening " + uid());
        await signInBrowser(page, admin);
        await page.addInitScript((t) => window.localStorage.setItem("ratable-console-theme", t), theme);
        for (const path of ["", "/reviews"]) {
          await open(page, path, lang);
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
          if (path === "/reviews") await expect(page.getByTestId("case").first()).toBeVisible();
          // Let the styles, fonts and colour transitions settle first: axe reads colours at one instant.
          await page.waitForLoadState("networkidle");
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(500);
          const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
          expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
        }
      });
    }
  }
});
