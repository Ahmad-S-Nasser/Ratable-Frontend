import crypto from "node:crypto";
import { expect, request as pwRequest, type APIRequestContext, type Page } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";

export const API = "http://localhost:5181";
export const WEB = "http://localhost:3101";
const MONGO = "mongodb://localhost:27017";

export const uid = () => crypto.randomBytes(5).toString("hex");

export type TestUser = { id: string; cookie: string; token: string; api: APIRequestContext };

/**
 * Creates an account and a session straight in the database (sign-in itself is covered elsewhere), and returns an API client that is signed in as it.
 * The session token is hashed exactly as the API hashes it, so the API accepts it.
 */
export async function createUser(roles: string[], displayName?: string): Promise<TestUser> {
  const client = new MongoClient(MONGO);
  await client.connect();
  try {
    const db = client.db("ratable_e2e");
    const id = new ObjectId();
    await db.collection("users").insertOne({
      _id: id, roles: ["User", ...roles], profile: displayName ? { displayName } : {}, logins: [], phoneVerified: false, status: "Active", createdAt: new Date(),
    });
    const token = crypto.randomBytes(32).toString("base64url");
    await db.collection("sessions").insertOne({
      tokenHash: crypto.createHash("sha256").update(token).digest("hex").toUpperCase(), userId: id, kind: "Web",
      createdAt: new Date(), expiresAt: new Date(Date.now() + 86_400_000),
    });
    const cookie = `ratable_session=${token}`;
    const api = await pwRequest.newContext({ baseURL: API, extraHTTPHeaders: { Cookie: cookie } });
    return { id: id.toHexString(), cookie, token, api };
  } finally {
    await client.close();
  }
}

/** The API seeds the categories a moment after it starts listening. */
export async function waitForApi() {
  const anon = await pwRequest.newContext({ baseURL: API });
  await expect.poll(async () => ((await (await anon.get("/api/categories")).json()) as unknown[]).length, { timeout: 60_000 }).toBe(6);
  await anon.dispose();
}

export async function signInBrowser(page: Page, user: TestUser) {
  await page.context().addCookies([{ name: "ratable_session", value: user.token, url: WEB }]);
}

/** A public place: submitted by a reader, approved by an admin. */
export async function makePlace(reader: TestUser, admin: TestUser, nameEn: string, nameAr = "", lon = 31.64, lat = 30.1): Promise<string> {
  const created = await reader.api.post("/api/entities", { data: { nameEn, nameAr, categoryId: "compounds", longitude: lon, latitude: lat, city: "Cairo" } });
  expect(created.status()).toBe(201);
  const id = ((await created.json()) as { id: string }).id;
  const approved = await admin.api.post(`/api/moderation/entities/${id}/approve`);
  expect(approved.status()).toBe(200);
  return id;
}

export async function writeReview(user: TestUser, entityId: string, text: string, extra: Record<string, unknown> = {}): Promise<string> {
  const response = await user.api.post(`/api/entities/${entityId}/reviews`, { data: { answers: [{ criterionId: "security", value: 4 }], text, ...extra } });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { id: string }).id;
}
