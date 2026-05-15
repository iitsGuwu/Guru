"use server"

import { revalidateTag } from "next/cache"

/**
 * Invalidate the auction-list + bid-history caches. Called from BidForm
 * after a bid/settle tx confirms so the server-rendered bid history and
 * auction state refresh on next render instead of waiting for the 10-min
 * `unstable_cache` TTL.
 */
export async function refreshAuctions() {
  revalidateTag("all-auctions")
}
