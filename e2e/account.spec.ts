import AxeBuilder from "@axe-core/playwright";
import crypto from "node:crypto";
import { expect, request as pwRequest, test, type Page } from "@playwright/test";
import { MongoClient } from "mongodb";
import { API, WEB, createUser, makePlace, signInBrowser, uid, waitForApi, writeReview, type TestUser } from "./support";

let admin: TestUser;
let place: { id: string; slugEn: string };

// A 1x1 PNG: enough for the file checks. The proof flow does not look at the picture itself here.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test.beforeAll(async () => {
  await waitForApi();
  admin = await createUser(["Admin"], "Account Admin");
  const owner = await createUser([], "Account Owner");
  const id = await makePlace(owner, admin, `Account Heights ${uid()}`, `أكونت ${uid()}`);
  const anon = await pwRequest.newContext({ baseURL: API });
  const entity = (await (await anon.get(`/api/entities/${id}`)).json()) as { slugs: Record<string, string> };
  await anon.dispose();
  place = { id, slugEn: entity.slugs.en };
});

/** Sets the sign-in code of the newest open challenge to a known value, as the API would have hashed it (the code itself is never stored). */
async function setKnownCode(code: string) {
  const client = new MongoClient("mongodb://localhost:27017");
  await client.connect();
  try {
    const challenges = client.db("ratable_e2e").collection("otp_challenges");
    const latest = await challenges.find({ consumedAt: null }).sort({ createdAt: -1 }).limit(1).next();
    expect(latest).toBeTruthy();
    const key = Buffer.from(process.env.E2E_HASH_KEY!, "base64");
    const hash = crypto.createHmac("sha256", key).update(`otp:${latest!._id.toString()}:${code}`).digest("hex").toUpperCase();
    await challenges.updateOne({ _id: latest!._id }, { $set: { codeHash: hash } });
  } finally {
    await client.close();
  }
}

const phone = () => `+2010${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;

async function signInThroughTheForm(page: Page, next = "/en/me") {
  await page.goto(`${WEB}/en/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Phone number").fill(phone());
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByLabel("Code")).toBeVisible();
  await setKnownCode("123456");
}

test.describe("sign in with a phone code", () => {
  test("a visitor signs in and lands where they were going, then updates the profile and signs out", async ({ page }) => {
    await signInThroughTheForm(page);
    await page.getByLabel("Code").fill("123456");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(`${WEB}/en/me`);
    await expect(page.getByRole("heading", { name: "My account", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "My account" }).first()).toBeVisible(); // the header changed too
    await expect(page.getByText("Phone not verified")).toBeVisible();
    await expect(page.getByText("You have not written any reviews yet.")).toBeVisible();

    await page.getByLabel("Display name").fill("Nour Reader");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status")).toContainText("Saved.");

    // The cookie is httpOnly: the page cannot read it.
    expect(await page.evaluate(() => document.cookie)).not.toContain("ratable_session");

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByText("Sign in to see your account.")).toBeVisible();
  });

  test("a wrong code is explained and can be retried", async ({ page }) => {
    await signInThroughTheForm(page);
    await page.getByLabel("Code").fill("000000");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.locator("form [role=alert]")).toContainText("The code is not correct.");
    await page.getByLabel("Code").fill("123456");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(`${WEB}/en/me`);
  });

  test("an invalid number is explained", async ({ page }) => {
    await page.goto(`${WEB}/en/sign-in`);
    await page.getByLabel("Phone number").fill("12345678");
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.locator("form [role=alert]")).toContainText("not valid");
  });

  test("the next address can never leave the site", async ({ page }) => {
    await signInThroughTheForm(page, "https://evil.example/steal");
    await page.getByLabel("Code").fill("123456");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(`${WEB}/en`);
  });

  test("Arabic: right to left, with Arabic wording", async ({ page }) => {
    await page.goto(`${WEB}/ar/sign-in`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("تسجيل الدخول");
    await expect(page.getByLabel("رقم الهاتف")).toBeVisible();
  });
});

test.describe("proof upload", () => {
  let reader: TestUser;
  let reviewId: string;

  test.beforeAll(async () => {
    reader = await createUser([], "Proof Reader");
    reviewId = await writeReview(reader, place.id, "I lived here for a year", { isAnonymous: false });
  });

  test("my account lists the review as unverified and leads to the proof screen", async ({ page }) => {
    await signInBrowser(page, reader);
    await page.goto(`${WEB}/en/me`);
    const card = page.locator("section#my-reviews ~ ul, section[aria-labelledby=my-reviews]").locator("li").first();
    await expect(card).toContainText("Unverified");
    await expect(card).toContainText("Being checked");
    await card.getByRole("link", { name: "Prove your experience" }).click();
    await expect(page).toHaveURL(new RegExp(`/en/me/proof/${reviewId}$`));
  });

  test("upload, keep with consent, then the decision, then delete the file", async ({ page }) => {
    await signInBrowser(page, reader);
    await page.goto(`${WEB}/en/me/proof/${reviewId}`);
    await expect(page.getByLabel("Type of proof")).toBeVisible();

    const submit = page.getByRole("button", { name: "Upload proof" });
    await page.getByLabel(/File \(photo/).setInputFiles({ name: "lease.png", mimeType: "image/png", buffer: PNG });
    await expect(submit).toBeDisabled(); // the declaration is required
    await page.getByLabel("I confirm this document is genuine").check();
    await expect(submit).toBeEnabled();

    // Keeping the file needs its own consent.
    await page.getByLabel("Keep the file for a limited time").check();
    await expect(submit).toBeDisabled();
    await page.getByLabel(/I agree to the file being kept/).check();
    await expect(submit).toBeEnabled();

    await submit.click();
    await expect(page.getByRole("status")).toContainText("Proof received");
    const item = page.locator("section[aria-labelledby=your-proofs] li").first();
    await expect(item).toContainText("Being checked");
    await expect(item).toContainText("File kept until");
    await expect(page.getByRole("button", { name: "Upload proof" })).toHaveCount(0); // one proof at a time

    // A moderator decides; the reader sees the result and may delete the kept file.
    const proofs = (await (await reader.api.get(`/api/me/proofs?reviewId=${reviewId}`)).json()) as { id: string }[];
    const approved = await admin.api.post(`/api/moderation/proofs/${proofs[0].id}/approve`);
    expect(approved.status()).toBe(200);
    await page.reload();
    await expect(page.locator("section[aria-labelledby=your-proofs] li").first()).toContainText("Accepted");
    await page.getByRole("button", { name: "Delete the file now" }).click();
    await expect(page.getByRole("status")).toContainText("The file was deleted.");
    await expect(page.getByRole("button", { name: "Delete the file now" })).toHaveCount(0);

    await page.goto(`${WEB}/en/me`);
    await expect(page.locator("section[aria-labelledby=my-reviews] li").first()).toContainText("Verified");
    await expect(page.getByRole("link", { name: "Prove your experience" })).toHaveCount(0);
  });

  test("another person's review is not reachable", async ({ page }) => {
    const other = await createUser([], "Somebody Else");
    await signInBrowser(page, other);
    await page.goto(`${WEB}/en/me/proof/${reviewId}`);
    await expect(page.getByText("This review is not in your account.")).toBeVisible();
  });

  test("an unreadable address is a 404", async ({ request }) => {
    expect((await request.get(`${WEB}/en/me/proof/not-an-id`)).status()).toBe(404);
  });
});

test.describe("installable app, errors and accessibility", () => {
  test("manifest, icons and service worker are served and linked", async ({ request, page }) => {
    const manifest = (await (await request.get(`${WEB}/manifest.webmanifest`)).json()) as { display: string; dir: string; icons: { src: string; purpose?: string }[] };
    expect(manifest.display).toBe("standalone");
    expect(manifest.dir).toBe("rtl");
    expect(manifest.icons.some((i) => i.purpose === "maskable")).toBe(true);
    for (const icon of manifest.icons) expect((await request.get(`${WEB}${icon.src}`)).status()).toBe(200);
    expect((await request.get(`${WEB}/sw.js`)).status()).toBe(200);
    expect((await request.get(`${WEB}/offline.html`)).status()).toBe(200);
    await page.goto(`${WEB}/en`);
    await expect(page.locator("link[rel=manifest]")).toHaveCount(1);
    await expect(page.locator("link[rel=apple-touch-icon]")).toHaveCount(1);
  });

  test("a missing page is a real 404 in both languages", async ({ page }) => {
    const response = await page.goto(`${WEB}/en/compounds/000000000000000000000000-missing`);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "الصفحة غير موجودة" })).toBeVisible();
  });

  const wcag = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
  for (const lang of ["ar", "en"] as const) {
    for (const theme of ["light", "dark"] as const) {
      test(`sign-in, account and proof screens pass the contrast check: ${lang} ${theme}`, async ({ page }) => {
        const reader = await createUser([], "A11y Reader");
        const reviewId = await writeReview(reader, place.id, "Accessibility check review", { isAnonymous: false });
        await signInBrowser(page, reader);
        await page.emulateMedia({ colorScheme: theme });
        for (const path of ["/sign-in", "/me", `/me/proof/${reviewId}`]) {
          await page.goto(`${WEB}/${lang}${path}`);
          await page.waitForLoadState("networkidle");
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(600);
          const results = await new AxeBuilder({ page }).withTags(wcag).analyze();
          expect(results.violations.map((v) => `${path} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
          await page.screenshot({ path: `test-results/screens/account-${lang}-${theme}-${path.split("/")[1]}.png`, fullPage: true });
        }
      });
    }
  }
});
