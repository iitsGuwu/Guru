/**
 * Scheduled function that pre-warms the /art Next.js cache.
 *
 * Runs every 5 minutes. Hits /art so Next.js executes the page render,
 * which writes the auction list into `unstable_cache` (10-min TTL). When
 * a real visitor lands on /art they hit the warm cache (~50ms) instead
 * of triggering a cold log scan that risks the function timeout.
 *
 * Free tier on Netlify allows 125k scheduled invocations/month;
 * 12 invocations/hour × 24 × 30 ≈ 8,640/month, well within the limit.
 */
export default async () => {
  const baseUrl = process.env.URL ?? process.env.DEPLOY_URL
  if (!baseUrl) {
    return new Response("No URL/DEPLOY_URL env var available", { status: 500 })
  }
  try {
    const res = await fetch(`${baseUrl}/art`, {
      headers: { "User-Agent": "Netlify-Scheduled-WarmUp" },
      signal: AbortSignal.timeout(25_000),
    })
    return new Response(`Warmed /art: HTTP ${res.status}`)
  } catch (err) {
    return new Response(`Warm failed: ${String(err)}`, { status: 500 })
  }
}

export const config = {
  schedule: "*/5 * * * *",
}
