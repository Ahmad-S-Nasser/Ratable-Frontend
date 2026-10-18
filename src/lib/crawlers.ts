/**
 * Crawler policy. The names were checked in October 2026 against the vendors' published lists and a comparison of guides; check them again
 * before launch, because vendors add and rename crawlers.
 *
 * Search and answer-engine crawlers are always allowed: they send readers to Ratable and cite it.
 * Training crawlers follow one setting (ROBOTS_TRAINING_CRAWLERS = allow or disallow; the default is disallow until the owner decides).
 */
export const searchCrawlers = [
  "Googlebot",
  "Bingbot",
  "OAI-SearchBot", // OpenAI search
  "ChatGPT-User", // OpenAI, fetches a page when a person asks
  "Claude-SearchBot", // Anthropic search
  "Claude-User", // Anthropic, fetches a page when a person asks
  "PerplexityBot", // Perplexity search
  "Perplexity-User",
] as const;

export const trainingCrawlers = [
  "GPTBot", // OpenAI training
  "ClaudeBot", // Anthropic training
  "Google-Extended", // control token for Gemini training
  "CCBot", // Common Crawl
  "Applebot-Extended",
] as const;

export const allowTraining = () => (process.env.ROBOTS_TRAINING_CRAWLERS ?? "disallow").toLowerCase() === "allow";

/** Every AI-related crawler we log visits from (search, user fetches and training). Matching is by name inside the user agent. */
export const loggedCrawlers = [...searchCrawlers.filter((c) => c !== "Googlebot" && c !== "Bingbot"), ...trainingCrawlers];

export function aiCrawlerName(userAgent: string | null): string | null {
  if (!userAgent) return null;
  const lower = userAgent.toLowerCase();
  return loggedCrawlers.find((c) => lower.includes(c.toLowerCase())) ?? null;
}
