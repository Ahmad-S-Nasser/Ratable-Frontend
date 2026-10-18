import { partXml } from "@/lib/sitemaps";

export const revalidate = 3600;

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const xml = /^[a-z]{2}-[a-z0-9-]+\.xml$/.test(name) ? await partXml(name) : null;
  if (!xml) return new Response("Not found", { status: 404 });
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8" } });
}
