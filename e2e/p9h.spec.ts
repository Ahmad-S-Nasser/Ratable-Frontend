import AxeBuilder from "@axe-core/playwright";
import crypto from "node:crypto";
import { expect, request as pwRequest, test, type Page } from "@playwright/test";
import { API, WEB, createUser, makePlace, publishVerified, signInBrowser, uid, waitForApi, type TestUser } from "./support";

const SECRET = "e2e-whatsapp-secret";
let admin: TestUser;
let owner: TestUser;

test.beforeAll(async () => {
  await waitForApi();
  admin = await createUser(["Admin"], "P9h Admin");
  owner = await createUser([], "P9h Owner");
});

const digits = () => `2014${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;

/** What WhatsApp sends to Ratable's webhook when someone messages the number, signed with the app secret. */
async function whatsAppMessage(from: string, text: string) {
  const body = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ from, text: { body: text } }] } }] }] });
  const signature = "sha256=" + crypto.createHmac("sha256", SECRET).update(body).digest("hex");
  const ctx = await pwRequest.newContext({ baseURL: API });
  const response = await ctx.post("/api/webhooks/whatsapp", { data: body, headers: { "content-type": "application/json", "x-hub-signature-256": signature } });
  await ctx.dispose();
  return response;
}

async function startVerification(page: Page, phone: string, lang = "en") {
  await page.goto(`${WEB}/${lang}/me/verify`);
  await page.getByRole("button", { name: lang === "en" ? "Verify via WhatsApp" : "وثّق عبر واتساب" }).click();
  // A phone-only sign-in account has its number already; a test account has none, so the screen asks for it.
  await page.getByLabel(lang === "en" ? "Your phone number" : "رقم هاتفك").fill(phone);
  await page.getByRole("button", { name: lang === "en" ? "Verify via WhatsApp" : "وثّق عبر واتساب" }).click();
}

test.describe("sign-in options", () => {
  test("only the phone form is shown when no provider is set up", async ({ page }) => {
    await page.goto(`${WEB}/en/sign-in`);
    await expect(page.getByLabel("Phone number")).toBeVisible();
    await expect(page.getByTestId("external-sign-in")).toHaveCount(0);
  });

  test("Google and Apple appear when set up, load their scripts only on a press, and the API checks the token", async ({ page }) => {
    await page.route("**/api/auth/providers", (route) => route.fulfill({ json: { phone: true, googleClientId: "g-client", appleClientId: "a-client" } }));
    const loaded: string[] = [];
    await page.route("https://accounts.google.com/gsi/client", (route) => {
      loaded.push("google");
      return route.fulfill({
        contentType: "text/javascript",
        body: "window.google={accounts:{id:{initialize(o){window.__cb=o.callback},prompt(){window.__cb({credential:'fake-google-token'})}}}};",
      });
    });
    let posted: unknown = null;
    await page.route("**/api/auth/external", (route) => {
      posted = route.request().postDataJSON();
      return route.fulfill({ json: { user: { id: "1", roles: ["User"], profile: {}, phoneVerified: false } } });
    });

    await page.goto(`${WEB}/en/sign-in?next=${encodeURIComponent("/en/categories")}`);
    await expect(page.getByTestId("external-sign-in")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Apple" })).toBeVisible();
    expect(loaded).toEqual([]); // nothing from Google was loaded by looking at the page

    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(page).toHaveURL(`${WEB}/en/categories`);
    expect(posted).toEqual({ provider: "google", idToken: "fake-google-token", client: "web" });
  });

  test("a token the API refuses shows a clear message and signs nobody in", async ({ page }) => {
    await page.route("**/api/auth/providers", (route) => route.fulfill({ json: { phone: true, googleClientId: "g-client", appleClientId: null } }));
    await page.route("https://accounts.google.com/gsi/client", (route) =>
      route.fulfill({ contentType: "text/javascript", body: "window.google={accounts:{id:{initialize(o){window.__cb=o.callback},prompt(){window.__cb({credential:'forged'})}}}};" }),
    );
    await page.route("**/api/auth/external", (route) => route.fulfill({ status: 401, json: { error: "invalid_token" } }));
    await page.goto(`${WEB}/en/sign-in`);
    await expect(page.getByRole("button", { name: "Continue with Apple" })).toHaveCount(0); // Apple is not set up here
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(page.getByTestId("external-sign-in").getByRole("alert")).toContainText("We could not verify your account");
    await expect(page).toHaveURL(`${WEB}/en/sign-in`);
  });

  test("when the provider script cannot be loaded the phone form is still there", async ({ page }) => {
    await page.route("**/api/auth/providers", (route) => route.fulfill({ json: { phone: true, googleClientId: "g-client", appleClientId: null } }));
    await page.route("https://accounts.google.com/gsi/client", (route) => route.abort());
    await page.goto(`${WEB}/en/sign-in`);
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(page.getByTestId("external-sign-in").getByRole("alert")).toContainText("could not load sign-in");
    await expect(page.getByLabel("Phone number")).toBeVisible();
  });
});

test.describe("Verify via WhatsApp", () => {
  test("a visitor is asked to sign in", async ({ page }) => {
    await page.goto(`${WEB}/en/me/verify`);
    await expect(page.locator("a[href*='/sign-in']")).toBeVisible();
  });

  test("the whole flow: offer, code, a wrong sender is ignored, the right message verifies, and the account shows the mark", async ({ page }) => {
    const user = await createUser([], "WhatsApp Reader");
    await signInBrowser(page, user);
    const number = digits();
    await startVerification(page, `+${number}`);

    const waiting = page.getByTestId("verify-waiting");
    await expect(waiting).toBeVisible();
    const code = (await page.getByTestId("verify-code").innerText()).trim();
    expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const link = waiting.getByRole("link", { name: "Open WhatsApp" });
    expect(await link.getAttribute("href")).toBe(`https://wa.me/201099999999?text=${encodeURIComponent(`Ratable ${code}`)}`);
    await expect(waiting).toContainText("same number you are verifying");
    await expect(waiting).toContainText("expires in 10 minutes");
    expect(await page.content()).not.toContain(number); // the number is not shown back

    // Somebody else sends the code: nothing happens.
    expect((await whatsAppMessage("201999000999", `Ratable ${code}`)).status()).toBe(200);
    await page.waitForTimeout(3500);
    await expect(waiting).toBeVisible();
    expect(((await (await user.api.get("/api/me")).json()) as { phoneVerified: boolean }).phoneVerified).toBe(false);

    // The owner of the number sends it: the waiting screen turns into the result by itself.
    expect((await whatsAppMessage(number, `Ratable ${code}`)).status()).toBe(200);
    await expect(page.getByTestId("verify-done")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("verify-done")).toContainText("never on an anonymous one");
    expect(((await (await user.api.get("/api/me")).json()) as { phoneVerified: boolean }).phoneVerified).toBe(true);

    await page.goto(`${WEB}/en/me`);
    await expect(page.getByText("Verified account")).toBeVisible();
    await expect(page.getByText("Phone not verified")).toHaveCount(0);
  });

  test("a code that arrives twice works once, and a webhook without the right signature is refused", async () => {
    const ctx = await pwRequest.newContext({ baseURL: API });
    const bad = await ctx.post("/api/webhooks/whatsapp", { data: "{}", headers: { "content-type": "application/json", "x-hub-signature-256": "sha256=" + "0".repeat(64) } });
    expect(bad.status()).toBe(401);
    expect((await ctx.post("/api/webhooks/whatsapp", { data: "{}", headers: { "content-type": "application/json" } })).status()).toBe(401);
    const check = await ctx.get("/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=e2e-verify-token&hub.challenge=777");
    expect(await check.text()).toBe("777");
    await ctx.dispose();
  });

  test("a virtual number is blocked, a number of another account is refused, and the alternative route says when it is unavailable", async ({ page }) => {
    const user = await createUser([], "Blocked Reader");
    await signInBrowser(page, user);
    await startVerification(page, "+201555123456");
    await expect(page.locator("[role=alert]").filter({ hasText: "This number cannot be used" })).toBeVisible();

    // Another account already verified a number.
    const first = await createUser([], "First Owner");
    const second = await createUser([], "Second Owner");
    const number = digits();
    const started = await first.api.post("/api/me/phone/verify/start", { data: { phone: `+${number}` } });
    const code = ((await started.json()) as { code: string }).code;
    await whatsAppMessage(number, `Ratable ${code}`);
    expect(((await (await first.api.get("/api/me")).json()) as { phoneVerified: boolean }).phoneVerified).toBe(true);

    await signInBrowser(page, second);
    await startVerification(page, `+${number}`);
    await expect(page.locator("[role=alert]").filter({ hasText: "belongs to another account" })).toBeVisible();

    // No code provider is set up in this environment.
    await page.getByLabel("Your phone number").fill(`+${digits()}`); // a number nobody owns, so the only problem left is the missing provider
    await page.getByRole("button", { name: /Send me a code instead/ }).first().click();
    await expect(page.locator("[role=alert]").filter({ hasText: "not available right now" })).toBeVisible();
  });
});

test.describe("the verified-account mark", () => {
  test("it shows on a named review of a verified account and never on an anonymous one", async ({ page }) => {
    const id = await makePlace(owner, admin, `Mark Gardens ${uid()}`, `ماركس ${uid()}`);
    const named = await createUser([], "Marked Maya");
    const hidden = await createUser([], "Secret Samira");
    const plain = await createUser([], "Plain Paula");
    const reviews: Record<string, string> = {};
    for (const [key, user, anonymous] of [["named", named, false], ["hidden", hidden, true], ["plain", plain, false]] as const) {
      const res = await user.api.post(`/api/entities/${id}/reviews`, { data: { answers: [{ criterionId: "security", value: 5 }], text: `Review of ${key}`, isAnonymous: anonymous } });
      reviews[key] = ((await res.json()) as { id: string }).id;
      await publishVerified(reviews[key]);
    }
    for (const user of [named, hidden]) {
      const number = digits();
      const started = await user.api.post("/api/me/phone/verify/start", { data: { phone: `+${number}` } });
      await whatsAppMessage(number, `Ratable ${((await started.json()) as { code: string }).code}`);
    }
    const anon = await pwRequest.newContext({ baseURL: API });
    const slugs = ((await (await anon.get(`/api/entities/${id}`)).json()) as { slugs: Record<string, string> }).slugs;
    await anon.dispose();

    await page.goto(`${WEB}/en/compounds/${id}-${slugs.en}`);
    const marked = page.locator("article", { hasText: "Review of named" });
    await expect(marked.getByTestId("account-verified")).toHaveAttribute("aria-label", "Verified account");
    await expect(page.locator("article", { hasText: "Review of plain" }).getByTestId("account-verified")).toHaveCount(0); // named but not verified
    await expect(page.locator("article", { hasText: "Review of hidden" }).getByTestId("account-verified")).toHaveCount(0); // anonymous: no mark, no hint
    expect(await page.content()).not.toContain("Secret Samira");
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
      test(`sign-in, verify, waiting and verified screens: ${lang} ${theme}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: theme });
        const check = async (label: string) => {
          await settle(page);
          const results = await new AxeBuilder({ page }).withTags(wcag).analyze();
          expect(results.violations.map((v) => `${label} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
          await page.screenshot({ path: `test-results/screens/p9h-${lang}-${theme}-${label}.png`, fullPage: true });
        };

        await page.goto(`${WEB}/${lang}/sign-in`);
        await check("sign-in");

        const user = await createUser([], "Contrast Verifier");
        await signInBrowser(page, user);
        await page.goto(`${WEB}/${lang}/me/verify`);
        await page.getByTestId("verify-start").waitFor();
        await check("verify");

        await page.getByRole("button", { name: lang === "en" ? "Verify via WhatsApp" : "وثّق عبر واتساب" }).click();
        await page.getByLabel(lang === "en" ? "Your phone number" : "رقم هاتفك").fill(`+${digits()}`);
        await page.getByRole("button", { name: lang === "en" ? "Verify via WhatsApp" : "وثّق عبر واتساب" }).click();
        await page.getByTestId("verify-waiting").waitFor();
        await check("waiting");

        const verified = await createUser([], "Done Verifier");
        const number = digits();
        const started = await verified.api.post("/api/me/phone/verify/start", { data: { phone: `+${number}` } });
        await whatsAppMessage(number, `Ratable ${((await started.json()) as { code: string }).code}`);
        await signInBrowser(page, verified);
        await page.goto(`${WEB}/${lang}/me/verify`);
        await page.getByTestId("verify-done").waitFor();
        await check("verified");
      });
    }
  }
});
