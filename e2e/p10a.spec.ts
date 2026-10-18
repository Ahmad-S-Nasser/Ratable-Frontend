import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { API, WEB, createUser, grantPlan, makeOwner, makePlace, publishVerified, setContact, signInBrowser, uid, waitForApi, writeReview, type TestUser } from "./support";

let admin: TestUser;

test.beforeAll(async () => {
  await waitForApi();
  admin = await createUser(["Admin"], "P10a Admin");
});

const PHONE = "+20 100 765 4321";
const DIGITS = "1007654321";

/** A service provider (a category that gates contact) with details stored on it and an owner. */
async function provider(name: string) {
  const reader = await createUser([], "Mona Hassan", true);
  const owner = await createUser(["BusinessOwner"], "P10a Owner", true);
  const id = await makePlace(reader, admin, name, "", 31.64, 30.1, "service-providers");
  await setContact(id, { phone: PHONE, whatsApp: "+201007654321", links: ["https://provider.example/work"] });
  await makeOwner(owner, id);
  return { reader, owner, id };
}

const providerCriteria = { answers: [{ criterionId: "quality", value: 5 }] };
const page_ = (id: string, lang = "en") => `${WEB}/${lang}/service-providers/${id}-x`;

test.describe("a locked profile", () => {
  test("hides contact in the page and the API, and offers Request contact", async ({ page }) => {
    const { id } = await provider(`Locked Plumber ${uid()}`);
    await page.goto(page_(id));
    await expect(page.getByTestId("contact-locked")).toBeVisible();
    const html = await page.content();
    expect(html).not.toContain(DIGITS);
    expect(html).not.toContain("provider.example");

    const api = await (await page.request.get(`${API}/api/entities/${id}`)).text();
    expect(api).not.toContain(DIGITS);
    expect(api).not.toContain("provider.example");

    // A visitor is asked to sign in before sending a request.
    await expect(page.getByRole("link", { name: "Sign in" }).last()).toBeVisible();
  });

  test("contact typed into a review is removed from the page while the profile is locked", async ({ page }) => {
    const { id, reader } = await provider(`Review Plumber ${uid()}`);
    const review = await writeReview(reader, id, `Excellent work, call him on 0100 765 4321 or @plumber_ahmed`, providerCriteria);
    await publishVerified(review);
    await page.goto(page_(id));
    await expect(page.getByText(/Excellent work/)).toBeVisible();
    expect(await page.content()).not.toContain("4321");
    expect(await page.content()).not.toContain("@plumber_ahmed");
  });

  test("a signed-in reader sends a request, sees it waiting, and the provider sees only a count", async ({ page }) => {
    const { id, owner } = await provider(`Request Plumber ${uid()}`);
    const asker = await createUser([], "Hind Asker", true);
    await signInBrowser(page, asker);
    await page.goto(page_(id));
    const form = page.getByTestId("request-form");
    await form.getByLabel("What do you need?").fill("A leaking kitchen tap");
    await form.getByLabel("When? (optional)").fill("This week");
    // A test account has no phone number to share, so sharing is refused clearly; then the reader chooses to be reached through Ratable.
    await form.getByLabel(/share my number with this provider only/).check();
    await form.getByRole("button", { name: "Send the request" }).click();
    await expect(page.getByText(/no phone number to share/)).toBeVisible();
    await form.getByLabel(/Through Ratable/).check();
    await form.getByRole("button", { name: "Send the request" }).click();
    await expect(page.getByTestId("request-sent")).toBeVisible();

    await page.getByRole("link", { name: "See my requests" }).click();
    await expect(page.getByTestId("request-status")).toHaveText("Waiting for an answer");
    await expect(page.getByText("A leaking kitchen tap")).toBeVisible();
    await expect(page.getByText("Through Ratable").first()).toBeVisible();

    // The provider, without the plan, sees how many people asked, and an upgrade message with the same number.
    await signInBrowser(page, owner);
    await page.goto(`${WEB}/en/business/dashboard`);
    await expect(page.getByTestId("requests-locked")).toContainText("1 people sent you a request");
    await expect(page.getByTestId("nudge-waiting")).toContainText("1 people asked to contact you");
    expect(await page.content()).not.toContain("A leaking kitchen tap");
    expect(await page.content()).not.toContain("Hind Asker");

    // Dismissed, it stays away.
    await page.getByTestId("nudge-waiting").getByRole("button", { name: "Dismiss" }).click();
    await expect(page.getByTestId("nudge-waiting")).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId("nudge-waiting")).toHaveCount(0);
  });
});

test.describe("a profile with the contact plan", () => {
  test("shows contact only after the Show contact call, and the owner then reads and answers requests", async ({ page }) => {
    const { id, owner } = await provider(`Plan Plumber ${uid()}`);
    const asker = await createUser([], "Hind Asker", true);
    expect((await asker.api.post(`/api/entities/${id}/contact-requests`, { data: { what: "Replace a bathroom mixer", when: "Friday", shareWhatsApp: false } })).status()).toBe(201);
    await grantPlan(admin, id);

    await page.goto(page_(id));
    expect(await page.content()).not.toContain(DIGITS);               // not in the page until it is asked for
    await page.getByTestId("show-contact").click();
    await expect(page.getByTestId("contact-list")).toContainText(PHONE);
    await expect(page.getByRole("link", { name: "https://provider.example/work" })).toHaveAttribute("rel", /nofollow/);

    await signInBrowser(page, owner);
    await page.goto(`${WEB}/en/business/dashboard`);
    await expect(page.getByTestId("stat-taps")).toContainText("1");
    const request = page.getByTestId("provider-request");
    await expect(request).toContainText("Replace a bathroom mixer");
    await expect(request).toContainText("Hind Asker");
    await request.getByRole("button", { name: "Reply" }).click();
    await request.getByLabel("Reply").fill("I can come on Friday at 10");
    await request.getByRole("button", { name: "Send the answer" }).click();
    await expect(request).toContainText("Answered");
    expect(await page.content()).not.toContain("nudge-");               // no upgrade messages for a plan owner

    await signInBrowser(page, asker);
    await page.goto(`${WEB}/en/me/requests`);
    await expect(page.getByTestId("request-status")).toHaveText("Answered");
    await expect(page.getByText("I can come on Friday at 10")).toBeVisible();
  });

  test("the owner saves contact details with checks", async ({ page }) => {
    const { id, owner } = await provider(`Editor Plumber ${uid()}`);
    await signInBrowser(page, owner);
    await page.goto(`${WEB}/en/business/dashboard`);
    await expect(page.getByLabel("Phone", { exact: true })).toHaveValue(PHONE);   // the saved details are loaded first
    await page.getByLabel("Phone", { exact: true }).fill("call me");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(/digits only/)).toBeVisible();
    await page.getByLabel("Phone", { exact: true }).fill("+20 122 000 1111");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    const stored = (await (await owner.api.get(`/api/business/places/${id}/contact`)).json()) as { phone: string };
    expect(stored.phone).toBe("+20 122 000 1111");
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
      test(`contact screens: ${lang} ${theme}`, async ({ page }) => {
        const { id, owner } = await provider(`Contrast Plumber ${uid()}`);
        const asker = await createUser([], "Hind Asker", true);
        await asker.api.post(`/api/entities/${id}/contact-requests`, { data: { what: "A leaking kitchen tap" } });
        await signInBrowser(page, asker);
        await page.emulateMedia({ colorScheme: theme });
        for (const path of [`/${lang}/service-providers/${id}-x`, `/${lang}/me/requests`]) {
          await page.goto(`${WEB}${path}`);
          await settle(page);
          const results = await new AxeBuilder({ page }).withTags(wcag).analyze();
          expect(results.violations.map((v) => `${path} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
          await page.screenshot({ path: `test-results/screens/p10a-${lang}-${theme}-${path.split("/").slice(2).join("-").replace(/%[0-9A-F]{2}/g, "")}.png`, fullPage: true });
        }
        await signInBrowser(page, owner);
        await page.goto(`${WEB}/${lang}/business/dashboard`);
        await settle(page);
        const results = await new AxeBuilder({ page }).withTags(wcag).analyze();
        expect(results.violations.map((v) => `dashboard ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
        await page.screenshot({ path: `test-results/screens/p10a-${lang}-${theme}-dashboard.png`, fullPage: true });
      });
    }
  }
});
