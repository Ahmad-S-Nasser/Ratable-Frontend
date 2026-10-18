import { getCategories } from "@/lib/api/server";
import { absoluteUrl } from "@/lib/site";

/**
 * An optional llms.txt (a plain summary of the site for language models). Whether it helps is unproven, so it is off unless LLMS_TXT=1.
 * It lists only public facts: what the site is, how scores work, and the categories.
 */
export async function GET() {
  if (process.env.LLMS_TXT !== "1") return new Response("Not found", { status: 404 });
  const categories = await getCategories();
  const lines = [
    "# Ratable (ريتابل)",
    "",
    "> A review platform for Egypt and the Gulf. Scores use verified reviews only; nothing a business pays for changes a score or a ranking.",
    "",
    "## How scores work",
    `- [Methodology](${absoluteUrl("/en/methodology")}): verified reviews only, at least 5 answers per criterion, one review per account.`,
    "",
    "## Categories",
    ...(categories.ok ? categories.data.map((c) => `- [${c.name.en ?? c.id}](${absoluteUrl(`/en/${c.id}`)}): best-of list at ${absoluteUrl(`/en/${c.id}/best`)}`) : []),
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
