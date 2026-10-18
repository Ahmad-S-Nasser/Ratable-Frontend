import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

/**
 * The API calls this when pages changed (a review was approved, a place was edited). It refreshes those pages so readers and search
 * engines see the change, without waiting for the cache time. Not routed publicly in production; the secret is a second lock.
 */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || request.headers.get("x-revalidate-secret") !== secret) return new NextResponse(null, { status: 401 });

  const body = (await request.json().catch(() => null)) as { paths?: unknown } | null;
  const paths = Array.isArray(body?.paths) ? body.paths.filter((p): p is string => typeof p === "string" && /^\/(ar|en)(\/|$)/.test(p)).slice(0, 2000) : [];
  for (const path of paths) revalidatePath(path);
  // The sitemaps list every place, so they are refreshed with them.
  if (paths.length > 0) revalidatePath("/sitemap.xml");
  return NextResponse.json({ revalidated: paths.length });
}
