import type { MetadataRoute } from "next"

const BASE_URL = "https://iitsguru.com"

// Static index only. Auction detail pages are reachable from /art and
// will be crawled from there — enumerating them in the sitemap would
// require an on-chain log scan during build, which times out.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE_URL}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${BASE_URL}/art`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE_URL}/community`, changeFrequency: "weekly", priority: 0.7 },
  ]
}
