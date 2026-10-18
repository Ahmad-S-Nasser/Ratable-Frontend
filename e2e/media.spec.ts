import AxeBuilder from "@axe-core/playwright";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { expect, request as pwRequest, test } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
import { API, WEB, createUser, makePlace, publishVerified, signInBrowser, uid, waitForApi, type TestUser } from "./support";

// Where the API (started by the Playwright config) keeps media: relative to its content root, src/Api.
const MEDIA_ROOT = path.resolve(__dirname, "../../Ratable-Backend/src/Api/App_Data/e2e-media");

let admin: TestUser;
let place: { id: string; slugEn: string; nameEn: string };

// A JPEG with a recognisable EXIF segment (GPS and device), a real scan and an end marker.
const exif = Buffer.from("Exif\0\0GPSLatitude=30.0444;Make=SecretPhone");
const JPEG_WITH_EXIF = Buffer.concat([
  Buffer.from([0xff, 0xd8]),
  Buffer.from([0xff, 0xe1, (exif.length + 2) >> 8, (exif.length + 2) & 0xff]),
  exif,
  Buffer.from([0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0x33, 0xff, 0xd9]),
]);
// A tiny real JPEG for the seeded posters (1x1 pixel).
const POSTER = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64",
);

const ffmpegInstalled = (() => {
  try {
    execSync(process.platform === "win32" ? "where ffmpeg" : "which ffmpeg", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

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
  admin = await createUser(["Admin"], "Media Admin");
  const owner = await createUser([], "Media Owner");
  const nameEn = `Media Heights ${uid()}`;
  const id = await makePlace(owner, admin, nameEn, `ميديا ${uid()}`);
  const anon = await pwRequest.newContext({ baseURL: API });
  const entity = (await (await anon.get(`/api/entities/${id}`)).json()) as { slugs: Record<string, string> };
  await anon.dispose();
  place = { id, slugEn: entity.slugs.en, nameEn };
});

const entityUrl = (query = "") => `${WEB}/en/compounds/${place.id}-${place.slugEn}${query}`;

async function review(user: TestUser, text: string, anonymous: boolean) {
  const res = await user.api.post(`/api/entities/${place.id}/reviews`, { data: { answers: [{ criterionId: "security", value: 5 }], text, isAnonymous: anonymous } });
  expect(res.status()).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

/** Puts an approved video straight into the database and the private folder, the way the pipeline would have left it (ffmpeg is not needed for this). */
async function seedPublishedVideo(reviewId: string, userId: string, protectedForAnonymous: boolean, transcript: string) {
  const key = crypto.randomBytes(16).toString("hex");
  const folder = path.join(MEDIA_ROOT, key.slice(0, 2), key);
  fs.mkdirSync(path.join(folder, "stream"), { recursive: true });
  fs.writeFileSync(path.join(folder, "poster.jpg"), POSTER);
  fs.writeFileSync(path.join(folder, "stream", "index.m3u8"), "#EXTM3U\nv0.m3u8\n");
  fs.writeFileSync(path.join(folder, "stream", "v0.m3u8"), "#EXTM3U\nv0_seg_000.ts\n");
  fs.writeFileSync(path.join(folder, "stream", "v0_seg_000.ts"), Buffer.from([0x47, 0, 0, 0]));
  const id = new ObjectId();
  await mongo((db) =>
    db.collection("media_items").insertOne({
      _id: id, reviewId, userId, kind: "Video", contentType: "video/mp4", declaredBytes: 1000, receivedBytes: 1000, status: "Published", storageKey: key,
      durationSeconds: 21, width: 720, height: 1280, posterFile: "poster.jpg", hasStream: true, candidateFrames: 0, cover: "Auto", coverFrameIndex: 0,
      analysis: { status: "Completed", facesFound: 0, childrenFound: 0, platesFound: 0, concerns: [] }, regions: [],
      protectedForAnonymous, blurApplied: false, voiceChanged: protectedForAnonymous,
      captions: { ar: `نص عربي ${transcript}`, en: transcript }, attempts: 0, createdAt: new Date(), updatedAt: new Date(), decidedAt: new Date(),
    }),
  );
  return id.toHexString();
}

test.describe("public videos and photos", () => {
  let named: TestUser;
  let anonymousProtected: TestUser;
  let anonymousUnprotected: TestUser;
  const ids: Record<string, string> = {};

  test.beforeAll(async () => {
    named = await createUser([], "Named Nour");
    anonymousProtected = await createUser([], "Hidden Hana");
    anonymousUnprotected = await createUser([], "Exposed Eman");
    ids.named = await review(named, "Named review with a video", false);
    ids.protected = await review(anonymousProtected, "Anonymous review with a protected video", true);
    ids.unprotected = await review(anonymousUnprotected, "Anonymous review whose video was not protected", true);
    for (const id of Object.values(ids)) await publishVerified(id);
    ids.v1 = await seedPublishedVideo(ids.named, named.id, false, "great gates and clean streets");
    ids.v2 = await seedPublishedVideo(ids.protected, anonymousProtected.id, true, "quiet at night");
    ids.v3 = await seedPublishedVideo(ids.unprotected, anonymousUnprotected.id, false, "UNPROTECTED-SECRET-WORDS");
  });

  test.use({ javaScriptEnabled: false });

  test("the entity page shows videos with their text, and an unprotected video of an anonymous review is not there", async ({ page }) => {
    await page.goto(entityUrl());
    const html = await page.content();
    expect(html).toContain("great gates and clean streets");
    expect(html).toContain("quiet at night");
    expect(html).not.toContain("UNPROTECTED-SECRET-WORDS");
    expect(html).not.toContain(ids.v3);
    expect(await page.locator("video").count()).toBe(2);
    await expect(page.locator("#videos ~ ul a")).toHaveCount(2);

    // Nobody anonymous is named anywhere on the page, the structured data included.
    expect(html).not.toContain("Hidden Hana");
    expect(html).not.toContain("Exposed Eman");
    expect(html).toContain("Named Nour");
  });

  test("structured data has a VideoObject with the transcript and no author", async ({ page }) => {
    await page.goto(entityUrl());
    const blocks = (await page.locator("script[type='application/ld+json']").allTextContents()).flatMap((b) => JSON.parse(b) as Record<string, unknown>[]);
    const videos = blocks.filter((b) => b["@type"] === "VideoObject");
    expect(videos).toHaveLength(2);
    for (const v of videos) {
      expect(v.transcript).toBeTruthy();
      expect(v.duration).toBe("PT0M21S");
      expect(String(v.contentUrl)).toContain("/api/media/");
      expect(v).not.toHaveProperty("author");
      expect(v).not.toHaveProperty("creator");
    }
    expect(videos.map((v) => v.transcript)).toEqual(expect.arrayContaining(["great gates and clean streets", "quiet at night"]));
  });

  test("the Video filter keeps only reviews with video", async ({ page }) => {
    await page.goto(entityUrl("?media=video"));
    await expect(page.locator("#reviews ~ ul > li article")).toHaveCount(2);
    await page.goto(entityUrl("?media=photos"));
    await expect(page.locator("#reviews ~ ul > li article")).toHaveCount(0);
    expect(await page.locator("link[rel=canonical]").getAttribute("href")).not.toContain("?");
  });

  test("the feed lists the approved videos with a card to each place", async ({ page }) => {
    await page.goto(`${WEB}/en/feed`);
    await expect(page.locator("h1")).toHaveCount(1);
    expect(await page.locator("video").count()).toBeGreaterThanOrEqual(2);
    const link = page.getByRole("link", { name: new RegExp(place.nameEn) }).first();
    await expect(link).toHaveAttribute("href", new RegExp(`/en/compounds/${place.id}-`));
    const html = await page.content();
    expect(html).not.toContain("UNPROTECTED-SECRET-WORDS");
    expect(html).not.toContain("Hidden Hana");
    expect(await page.locator("meta[name=robots]").getAttribute("content")).not.toContain("noindex");
  });

  test("approved files are streamed, anything else in the folder is not", async ({ request }) => {
    expect((await request.get(`${WEB}/api/media/${ids.v1}/poster`)).status()).toBe(200);
    const playlist = await request.get(`${API}/api/media/${ids.v1}/stream/index.m3u8`);
    expect(playlist.status()).toBe(200);
    expect(playlist.headers()["content-type"]).toContain("mpegurl");
    expect((await request.get(`${API}/api/media/${ids.v1}/stream/v0_seg_000.ts`)).status()).toBe(200);
    expect((await request.get(`${API}/api/media/${ids.v1}/stream/upload.part`)).status()).toBe(404);
    // The unprotected video of an anonymous review is hidden at the file level too.
    expect((await request.get(`${API}/api/media/${ids.v3}/poster`)).status()).toBe(404);
    expect((await request.get(`${API}/api/media/${ids.v3}/stream/index.m3u8`)).status()).toBe(404);
  });
});

test.describe("accessibility of the media screens", () => {
  const wcag = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
  for (const lang of ["ar", "en"] as const) {
    for (const theme of ["light", "dark"] as const) {
      test(`feed and entity page with videos: ${lang} ${theme}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: theme });
        for (const url of [`${WEB}/${lang}/feed`, `${WEB}/${lang}/compounds/${place.id}-${place.slugEn}`]) {
          await page.goto(url);
          await page.waitForLoadState("networkidle");
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(600);
          const results = await new AxeBuilder({ page }).withTags(wcag).analyze();
          expect(results.violations.map((v) => `${url} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
          await page.screenshot({ path: `test-results/screens/media-${lang}-${theme}-${url.includes("feed") ? "feed" : "entity"}.png`, fullPage: true });
        }
      });
    }
  }
});

test.describe("uploading", () => {
  test("a photo goes through the form, loses its location, waits for a person, and a moderator approves it in the console", async ({ page }) => {
    const reader = await createUser([], "Photo Poster");
    await signInBrowser(page, reader);
    await page.goto(`${entityUrl()}/review`);
    await page.getByRole("group", { name: "Security" }).getByLabel("5 out of 5").check({ force: true });
    await page.getByLabel("Choose files").first().setInputFiles({ name: "my-private-holiday-photo.jpg", mimeType: "image/jpeg", buffer: JPEG_WITH_EXIF });
    await page.getByRole("button", { name: "Publish review" }).click();
    await expect(page.getByRole("status").first()).toContainText("Your review was received");

    // The photo uploads in the background and then waits for a person.
    await expect(page.getByTestId("media-status-PendingModeration")).toBeVisible({ timeout: 30_000 });
    const mine = (await (await reader.api.get("/api/me/media")).json()) as { id: string; reviewId: string }[];
    expect(mine).toHaveLength(1);
    const files = fs.readdirSync(path.join(MEDIA_ROOT, ...(await storageFolder(mine[0].id))));
    expect(files).toEqual(["image.jpg"]); // the original upload, with its name and metadata, is gone
    expect(files.join("")).not.toContain("holiday");

    // Not public yet.
    const anon = await pwRequest.newContext({ baseURL: API });
    expect((await anon.get(`/api/media/${mine[0].id}/image`)).status()).toBe(404);

    // A moderator approves it from the console.
    await publishVerified(mine[0].reviewId);
    const modPage = await page.context().newPage();
    await signInBrowser(modPage, admin);
    await modPage.goto(`${WEB}/en/console/media`);
    const card = modPage.getByTestId("media-item").filter({ has: modPage.locator("img") }).first();
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Approve" }).click();
    await expect(modPage.getByText("Decision saved.")).toBeVisible();

    // Now it is public, and the stored picture has no GPS or device data.
    const image = await anon.get(`/api/media/${mine[0].id}/image`);
    expect(image.status()).toBe(200);
    const bytes = (await image.body()).toString("latin1");
    expect(bytes).not.toContain("GPS");
    expect(bytes).not.toContain("SecretPhone");
    await anon.dispose();

    await page.goto(entityUrl());
    await expect(page.getByText(/1 photos?/)).toBeVisible();
    await expect(page.locator(`img[src='/api/media/${mine[0].id}/image']`)).toHaveCount(1);
  });

  test("a renamed file is refused with a clear message", async ({ page }) => {
    const reader = await createUser([], "Renamer");
    const id = await review(reader, "A review that will get a bad file", false);
    await signInBrowser(page, reader);
    await page.goto(`${WEB}/en/me/media/${id}`);
    await page.getByLabel("Choose files").setInputFiles({ name: "holiday.mp4", mimeType: "video/mp4", buffer: Buffer.from("MZ not a video at all, only text pretending") });
    await expect(page.locator("[role=alert]").filter({ hasText: "file type is not suitable" })).toBeVisible({ timeout: 20_000 });
    expect(((await (await reader.api.get(`/api/me/media?reviewId=${id}`)).json()) as { status: string }[])[0].status).toBe("Rejected");
  });

  test("a video upload that cannot be processed here says so instead of waiting for ever", async ({ page }) => {
    test.skip(ffmpegInstalled, "ffmpeg is installed on this machine, so the video would really be processed");
    const reader = await createUser([], "Video Poster");
    const id = await review(reader, "A review with a video", false);
    await signInBrowser(page, reader);
    await page.goto(`${WEB}/en/me/media/${id}`);
    const mp4 = Buffer.alloc(4096);
    Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]).copy(mp4);
    await page.getByLabel("Choose files").setInputFiles({ name: "clip.mp4", mimeType: "video/mp4", buffer: mp4 });
    await expect(page.getByTestId("media-status-Failed")).toBeVisible({ timeout: 40_000 });
    await expect(page.getByText("Video processing is not available right now")).toBeVisible();
  });

  test("the limits are explained: only one video per review", async ({ page }) => {
    const reader = await createUser([], "Limit Reader");
    const id = await review(reader, "A review for the limit test", false);
    const mp4 = Buffer.alloc(2048);
    Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]).copy(mp4);
    for (let i = 0; i < 1; i++) {
      const res = await reader.api.post(`/api/reviews/${id}/media`, { data: { kind: "Video", contentType: "video/mp4", sizeBytes: mp4.length } });
      expect(res.status()).toBe(201);
    }
    await signInBrowser(page, reader);
    await page.goto(`${WEB}/en/me/media/${id}`);
    await page.getByLabel("Choose files").setInputFiles({ name: "second.mp4", mimeType: "video/mp4", buffer: mp4 });
    await expect(page.locator("[role=alert]").filter({ hasText: "limit of this kind" })).toBeVisible({ timeout: 20_000 });
  });
});

async function storageFolder(mediaId: string): Promise<[string, string]> {
  const item = await mongo((db) => db.collection("media_items").findOne({ _id: new ObjectId(mediaId) }));
  const key = item!.storageKey as string;
  return [key.slice(0, 2), key];
}
