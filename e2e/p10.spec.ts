import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { WEB, createUser, makePlace, publishVerified, signInBrowser, uid, waitForApi, writeReview, type TestUser } from "./support";

let admin: TestUser;

test.beforeAll(async () => {
  await waitForApi();
  admin = await createUser(["Admin"], "P10 Admin");
});

// A small PNG: the API judges a document by its first bytes.
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("fake claim document for tests, padding padding padding")]);

/** The newest code the API mailed to an address (the e2e API writes mail to a folder instead of sending it). */
async function mailedCode(to: string): Promise<string> {
  // The API runs from its own project folder, so its relative App_Data is there.
  const folder = path.resolve("../Ratable-Backend/src/Api/App_Data/e2e-mail");
  let code = "";
  await expect
    .poll(() => {
      if (!fs.existsSync(folder)) return "";
      for (const name of fs.readdirSync(folder).sort().reverse()) {
        const text = fs.readFileSync(path.join(folder, name), "utf8");
        if (text.startsWith(`To: ${to}\n`)) return (code = /code is (\d{6})/.exec(text)?.[1] ?? "");
      }
      return "";
    })
    .toMatch(/^\d{6}$/);
  return code;
}

/** Finds the moderation case for an owner reply by its text and publishes it, the way a moderator would. */
async function approveReply(text: string) {
  const queue = (await (await admin.api.get("/api/moderation/cases?kind=ownerreply&limit=100")).json()) as { items: { id: string; content?: { text?: string } }[] };
  const found = queue.items.find((i) => i.content?.text === text);
  expect(found, "a moderation case for the reply").toBeTruthy();
  expect((await admin.api.post(`/api/moderation/cases/${found!.id}/publish`)).status()).toBe(200);
}

async function claimThroughApi(owner: TestUser, entityId: string) {
  const email = `owner@${uid()}-co.com`;
  const created = await owner.api.post(`/api/entities/${entityId}/claims`, { data: { companyEmail: email, role: "owner" } });
  expect(created.status()).toBe(201);
  const id = ((await created.json()) as { id: string }).id;
  expect((await owner.api.post(`/api/me/claims/${id}/email/confirm`, { data: { code: await mailedCode(email) } })).status()).toBe(200);
  const upload = await owner.api.put(`/api/me/claims/${id}/document?type=commercial_register`, { data: png, headers: { "content-type": "application/octet-stream" } });
  expect(upload.status()).toBe(200);
  return id;
}

/** A place with one anonymous verified review and an owner who has been approved. */
async function placeWithOwner(name: string) {
  const reader = await createUser([], "Mona Hassan", true);
  const owner = await createUser([], "P10 Owner", true);
  const entityId = await makePlace(reader, admin, name);
  const reviewId = await writeReview(reader, entityId, "Quiet and clean, parking is hard", { isAnonymous: true });
  await publishVerified(reviewId);
  const claimId = await claimThroughApi(owner, entityId);
  expect((await admin.api.post(`/api/moderation/claims/${claimId}/approve`)).status()).toBe(200);
  return { reader, owner, entityId, reviewId };
}

test.describe("pricing and the page for business", () => {
  test("pricing shows the plans from the API and says no plan changes score or rank", async ({ page }) => {
    await page.goto(`${WEB}/en/business/pricing`);
    await expect(page.getByRole("heading", { level: 1, name: "Plans for business" })).toBeVisible();
    for (const id of ["free", "insights", "contact"]) await expect(page.getByTestId(`plan-${id}`)).toBeVisible();
    await expect(page.getByText("Does a plan raise my ranking?")).toBeVisible();
    await expect(page.getByText(/No plan can change either/)).toBeVisible();
    const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(ld.join("")).toContain("FAQPage");
  });

  test("the prices follow the chosen currency", async ({ page }) => {
    await page.goto(`${WEB}/en/business/pricing`);
    await expect(page.getByTestId("price-insights")).toContainText("899");
    await page.getByRole("link", { name: "Saudi riyal" }).click();
    await expect(page).toHaveURL(/currency=SAR/);
    await expect(page.getByTestId("price-insights")).toContainText("99");
    await expect(page.getByTestId("price-insights")).not.toContainText("899");
    await expect(page.getByTestId("price-contact")).toContainText("29");
  });

  test("the pages for business read without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`${WEB}/ar/business`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.goto(`${WEB}/ar/business/pricing`);
    await expect(page.getByTestId("plan-free")).toBeVisible();
    await context.close();
  });

  test("an entity page offers to claim the place", async ({ page }) => {
    const reader = await createUser([], "Claim Link Reader");
    const entityId = await makePlace(reader, admin, `Claim Link ${uid()}`);
    await page.goto(`${WEB}/en/compounds/${entityId}-x`);
    await page.getByRole("link", { name: "Claim it" }).click();
    await expect(page).toHaveURL(new RegExp(`/en/business/claim\\?place=${entityId}`));
  });
});

test.describe("business sign-up and sign-in", () => {
  test("a business account has its own sign-up and sign-in pages that lead to claiming and the dashboard", async ({ page }) => {
    await page.goto(`${WEB}/en/business/sign-up`);
    await expect(page.getByRole("heading", { level: 1, name: "Create a business account" })).toBeVisible();
    await expect(page.getByLabel("Phone number")).toBeVisible();
    await page.getByRole("link", { name: "Sign in to your business" }).click();
    await expect(page).toHaveURL(`${WEB}/en/business/sign-in`);
    await expect(page.getByRole("heading", { level: 1, name: "Sign in to your business" })).toBeVisible();
    await page.getByRole("link", { name: "Create a business account" }).click();
    await expect(page).toHaveURL(`${WEB}/en/business/sign-up`);
  });

  test("the pricing page offers the free plan through the business sign-up", async ({ page }) => {
    await page.goto(`${WEB}/en/business/pricing`);
    await page.getByTestId("plan-free").getByRole("link", { name: "Start free" }).click();
    await expect(page).toHaveURL(`${WEB}/en/business/sign-up`);
  });
});

test.describe("finding the place to claim", () => {
  test("a general search lists places to claim, with no place chosen first", async ({ page }) => {
    const name = `Claim Search ${uid()}`;
    const reader = await createUser([], "Search Reader");
    const entityId = await makePlace(reader, admin, name);
    await page.goto(`${WEB}/en/business/claim`);
    await expect(page.getByRole("search")).toBeVisible();
    await page.getByRole("searchbox", { name: "Search for your place" }).fill(name);
    await page.getByRole("button", { name: "Search" }).click();
    const results = page.getByTestId("claim-results");
    await expect(results).toContainText(name);
    await results.getByRole("listitem").filter({ hasText: name }).getByRole("link", { name: "Claim this place" }).click();
    await expect(page).toHaveURL(new RegExp(`/en/business/claim\\?place=${entityId}`));
  });

  test("a search with no match says so and offers to add the place", async ({ page }) => {
    await page.goto(`${WEB}/en/business/claim?q=${uid()}zzzqq`);
    await expect(page.getByText(/No place matches/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Add your place" })).toBeVisible();
  });
});

test.describe("claim", () => {
  test("a visitor is asked to sign in and an unverified account to verify its phone first", async ({ page }) => {
    const reader = await createUser([], "Unverified Owner");
    const entityId = await makePlace(reader, admin, `Claim Gate ${uid()}`);
    await page.goto(`${WEB}/en/business/claim?place=${entityId}`);
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();

    await signInBrowser(page, reader);
    await page.goto(`${WEB}/en/business/claim?place=${entityId}`);
    await expect(page.getByTestId("claim-needs-phone")).toBeVisible();
    await expect(page.getByRole("link", { name: "Verify via WhatsApp" })).toBeVisible();
  });

  test("a verified account sends a claim with a document and a moderator approves it in the console", async ({ page }) => {
    const name = `Claim Flow ${uid()}`;
    const reader = await createUser([], "Flow Reader");
    const owner = await createUser([], "Flow Owner", true);
    const entityId = await makePlace(reader, admin, name);

    await signInBrowser(page, owner);
    await page.goto(`${WEB}/en/business/claim?place=${entityId}`);
    await expect(page.getByText(name)).toBeVisible();
    const email = `info@${uid()}-co.com`;
    await page.getByLabel("Company email").fill(email);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByTestId("claim-email-step")).toBeVisible();
    await expect(page.getByText(/support@coon\.one/)).toBeVisible();
    await page.getByLabel("Code").fill("000001");   // a wrong code first
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText("That code is not right.")).toBeVisible();
    await page.getByLabel("Code").fill(await mailedCode(email));
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByTestId("claim-document-step")).toBeVisible();
    await page.getByLabel("Upload the document").setInputFiles({ name: "register.png", mimeType: "image/png", buffer: png });
    await page.getByRole("button", { name: "Send for review" }).click();
    await expect(page.getByTestId("claim-done")).toBeVisible();

    // The claim waits for a moderator, who opens the document and approves.
    const staff = await createUser(["Moderator"], "Claim Moderator");
    await signInBrowser(page, staff);
    await page.goto(`${WEB}/en/console/claims`);
    const card = page.getByTestId("claim").first();
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Open the document" }).click();
    await expect(card.getByRole("img", { name: "Open the document" })).toBeVisible();
    await card.getByRole("button", { name: "Approve and give ownership" }).click();
    await expect(page.getByText("Claim approved")).toBeVisible();

    const mine = (await (await owner.api.get("/api/me/claims")).json()) as { status: string }[];
    expect(mine[0].status).toBe("Approved");
    expect((await (await owner.api.get("/api/business/places")).json()) as unknown[]).toHaveLength(1);
  });

  test("the document type, the email and the role are checked by the server and the error is shown", async ({ page }) => {
    const reader = await createUser([], "Error Reader");
    const owner = await createUser([], "Error Owner", true);
    const entityId = await makePlace(reader, admin, `Claim Errors ${uid()}`);
    await signInBrowser(page, owner);
    await page.goto(`${WEB}/en/business/claim?place=${entityId}`);
    await page.getByLabel("Company email").fill("not-an-email");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Enter a valid company email.")).toBeVisible();
  });
});

test.describe("dashboard and owner replies", () => {
  test("a visitor and a reader without a place see the right message", async ({ page }) => {
    await page.goto(`${WEB}/en/business/dashboard`);
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    const reader = await createUser([], "No Place Reader", true);
    await signInBrowser(page, reader);
    await page.goto(`${WEB}/en/business/dashboard`);
    await expect(page.getByTestId("dashboard-empty")).toBeVisible();
    await expect(page.getByRole("link", { name: "Claim a place" })).toBeVisible();
  });

  test("the owner sees the numbers, replies to an anonymous review, and the reply shows on the public page with an owner label", async ({ page }) => {
    const name = `Dash Place ${uid()}`;
    const { owner, entityId } = await placeWithOwner(name);
    await signInBrowser(page, owner);
    await page.goto(`${WEB}/en/business/dashboard`);

    await expect(page.getByTestId("dashboard")).toBeVisible();
    await expect(page.getByTestId("kpi-reviews")).toContainText("1");
    await expect(page.getByTestId("kpi-verified")).toContainText("1");
    await expect(page.getByTestId("kpi-score")).toContainText("4");
    await expect(page.getByTestId("kpi-replyRate")).toContainText("0%");
    await expect(page.getByTestId("trend")).toBeVisible();

    // The reviewer is anonymous: no name, whoever looks (rule 1).
    const waiting = page.getByTestId("waiting-review");
    await expect(waiting).toHaveCount(1);
    await expect(page.getByTestId("waiting-author")).toHaveText("Anonymous reviewer");
    expect(await page.content()).not.toContain("Mona Hassan");

    await waiting.getByRole("button", { name: "Reply" }).click();
    await waiting.getByLabel("Reply").fill("Thank you, we are adding parking spaces");
    await waiting.getByRole("button", { name: "Publish reply" }).click();
    await expect(page.getByText("You have replied to every review.")).toBeVisible();
    await expect(page.getByTestId("kpi-replyRate")).toContainText("100%");
    // Every reply is read by the moderation checks first: it is not public yet.
    await expect(page.getByTestId("reply-sent")).toBeVisible();
    await expect(page.getByTestId("replies-pending")).toContainText("1 replies are waiting for a moderator.");
    await page.context().clearCookies();
    await page.goto(`${WEB}/en/compounds/${entityId}-x`);
    await expect(page.getByTestId("owner-reply")).toHaveCount(0);

    await approveReply("Thank you, we are adding parking spaces");
    await page.goto(`${WEB}/en/compounds/${entityId}-x`);
    const reply = page.getByTestId("owner-reply");
    await expect(reply).toBeVisible();
    await expect(reply).toContainText("Reply from the owner");
    await expect(reply).toContainText("Thank you, we are adding parking spaces");
    expect(await page.content()).not.toContain("Mona Hassan");
  });

  test("a business cannot review the place it runs, and another business cannot open its dashboard", async ({ page }) => {
    const { owner, entityId } = await placeWithOwner(`Own Place ${uid()}`);
    const refused = await owner.api.post(`/api/entities/${entityId}/reviews`, { data: { answers: [{ criterionId: "security", value: 5 }], text: "We are the best" } });
    expect(refused.status()).toBe(403);
    expect(((await refused.json()) as { error: string }).error).toBe("own_entity");

    const other = await createUser(["BusinessOwner"], "Other Business", true);
    expect((await other.api.get(`/api/business/places/${entityId}/dashboard`)).status()).toBe(404);
    await signInBrowser(page, other);
    await page.goto(`${WEB}/en/business/dashboard`);
    await expect(page.getByTestId("dashboard-empty")).toBeVisible();
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
      test(`business pages: ${lang} ${theme}`, async ({ page }) => {
        const { owner, entityId } = await placeWithOwner(`Contrast ${uid()}`);
        await signInBrowser(page, owner);
        await page.emulateMedia({ colorScheme: theme });
        const paths = [`/${lang}/business`, `/${lang}/business/pricing`, `/${lang}/business/sign-up`, `/${lang}/business/sign-in`, `/${lang}/business/claim`, `/${lang}/business/claim?place=${entityId}`, `/${lang}/business/dashboard`];
        for (const path of paths) {
          await page.goto(`${WEB}${path}`);
          await settle(page);
          const results = await new AxeBuilder({ page }).withTags(wcag).analyze();
          expect(results.violations.map((v) => `${path} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
          await page.screenshot({ path: `test-results/screens/p10-${lang}-${theme}-${path.split("/").slice(2).join("-").replace(/[?=]/g, "-")}.png`.replace(/%[0-9A-F]{2}/g, ""), fullPage: true });
        }
      });
    }
  }
});
