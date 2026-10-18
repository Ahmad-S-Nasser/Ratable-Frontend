import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { WEB, createUser, signInBrowser, uid, waitForApi, type TestUser } from "./support";

let admin: TestUser;

test.beforeAll(async () => {
  await waitForApi();
  admin = await createUser(["Admin"], "P11 Admin");
});

const header = "category,name_ar,name_en,alt_names,address,city,country,lat,lng,google_place_id,phone,whatsapp,website,external_ids,fields\n";

test.describe("seed import in the console", () => {
  test("a check writes nothing, the import needs that check, and a second run merges instead of duplicating", async ({ page }) => {
    const name = `Seeded Compound ${uid()}`;
    const file = header + `compounds,,${name},,Ring Road,Giza,Egypt,30.0123,31.0456,,,,,,\n` + `boats,,Not a category,,,,,30.0,31.0,,,,,,\n`;
    await signInBrowser(page, admin);
    await page.goto(`${WEB}/en/console/import`);
    await expect(page.getByRole("heading", { level: 1, name: "Import places" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Import", exact: true })).toBeDisabled();

    await page.getByLabel("Or paste the file here").fill(file);
    await page.getByLabel("Batch name (optional)").fill("e2e-pilot");
    await page.getByRole("button", { name: "Check (writes nothing)" }).click();
    const report = page.getByTestId("import-report");
    await expect(report).toContainText("Check result: nothing was written");
    await expect(report).toContainText("Created: 1");
    await expect(report).toContainText("Skipped: 1");
    await expect(report.locator('tr[data-outcome="skipped"]')).toContainText("Unknown or inactive category");

    // Editing the text drops the check, so what is imported is always what was checked.
    await page.getByLabel("Or paste the file here").fill(file + " ");
    await expect(page.getByRole("button", { name: "Import", exact: true })).toBeDisabled();
    await page.getByLabel("Or paste the file here").fill(file);
    await page.getByRole("button", { name: "Check (writes nothing)" }).click();
    await expect(page.getByRole("button", { name: "Import", exact: true })).toBeEnabled();
    const search = async () => ((await (await admin.api.get(`/api/entities/search?q=${encodeURIComponent(name)}`)).json()) as { id: string }[]).filter(() => true);
    expect((await search()).length).toBe(0);                          // the check wrote nothing

    await page.getByRole("button", { name: "Import", exact: true }).click();
    await expect(report).toContainText("Import finished");
    await expect(report).toContainText("Created: 1");
    const created = await search();
    expect(created).toHaveLength(1);

    // The same file again: the place is merged into itself, nothing is duplicated.
    await page.getByRole("button", { name: "Check (writes nothing)" }).click();
    await expect(report).toContainText("Merged: 1");
    await expect(report).toContainText("Created: 0");
    await expect(report.locator('tr[data-outcome="merged"]')).toContainText("no change");
    expect(await search()).toHaveLength(1);

    // The place is public and seeded places appear in the audit log.
    await page.goto(`${WEB}/en/compounds/${created[0].id}-x`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(name);
    await page.goto(`${WEB}/en/console/audit`);
    await expect(page.getByText("Places imported").first()).toBeVisible();
  });

  test("a file with a bad format shows a clear error, and a moderator has no import page", async ({ page }) => {
    await signInBrowser(page, admin);
    await page.goto(`${WEB}/en/console/import`);
    await page.getByLabel("Or paste the file here").fill("[ not json");
    await page.getByRole("button", { name: "Check (writes nothing)" }).click();
    // The text starts with [ so it is read as JSON.
    await expect(page.getByText("The JSON could not be read.")).toBeVisible();

    const moderator = await createUser(["Moderator"], "P11 Moderator");
    await signInBrowser(page, moderator);
    await page.goto(`${WEB}/en/console`);
    await expect(page.getByRole("link", { name: "Import places" })).toHaveCount(0);
  });

  for (const lang of ["ar", "en"] as const) {
    for (const theme of ["light", "dark"] as const) {
      test(`the import page has no contrast problems: ${lang} ${theme}`, async ({ page }) => {
        await signInBrowser(page, admin);
        await page.emulateMedia({ colorScheme: theme });
        await page.goto(`${WEB}/${lang}/console/import`);
        await page.getByLabel(lang === "en" ? "Or paste the file here" : "أو الصق الملف هنا").fill(header + "compounds,,Contrast Place,,,Giza,Egypt,30.0,31.0,,,,,,\n");
        await page.getByRole("button", { name: lang === "en" ? "Check (writes nothing)" : "افحص (لا يكتب شيئاً)" }).click();
        await expect(page.getByTestId("import-report")).toBeVisible();
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
        await page.screenshot({ path: `test-results/screens/p11-${lang}-${theme}.png`, fullPage: true });
      });
    }
  }
});
