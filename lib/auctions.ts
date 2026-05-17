/**
 * Auction state for an artist's SovereignAuctionHouse.
 *
 * The page is single-source: only auctions on this artist's house. We resolve
 * the house once via the factory (`houseOf(artist)`) and cache it for the
 * process lifetime — it doesn't change.
 *
 * Past auctions are read by scanning `AuctionCreated` + `AuctionEnded` events
 * on the house contract from the factory deploy block forward. No indexer.
 *
 * Caching: server-side `unstable_cache` with sensible revalidate windows.
 * Bigints are stringified at the cache boundary because Next's cache layer
 * JSON-serializes everything.
 */
import "server-only"
import { unstable_cache } from "next/cache"
import { parseAbiItem, type Address } from "viem"
import { getClient, getLogsChunked } from "./rpc"
import {
  sovereignAuctionHouseAbi,
  sovereignAuctionHouseFactoryAbi,
} from "./abi"
import { getConfig, ZERO_ADDRESS } from "./config"

// Hard deadline for any on-chain scan inside this module. Netlify's free
// tier kills functions at ~10s and the Pro tier at ~26s — we fire well
// before either so the RSC stream can flush the error boundary before the
// runtime cuts it. 7s gives ~3s headroom on the free tier.
const SCAN_DEADLINE_MS = 7_000
// Past-auction event enrichment gets a shorter budget than the outer scan
// so a slow/limited RPC degrades to minimal cards (caught by the caller)
// well before the outer deadline would fail the whole page.
const ENRICH_DEADLINE_MS = 4_500

function withDeadline<T>(
  label: string,
  work: Promise<T>,
  ms: number = SCAN_DEADLINE_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`[auctions] ${label} exceeded ${ms}ms`)),
      ms,
    )
  })
  return Promise.race([work, timeout]).finally(() => {
    if (timer !== null) clearTimeout(timer)
  })
}

const auctionCreatedEvent = parseAbiItem(
  "event AuctionCreated(uint256 indexed auctionId, uint256 indexed tokenId, address indexed tokenContract, uint256 duration, uint256 reservePrice, address tokenOwner)",
)
const auctionEndedEvent = parseAbiItem(
  "event AuctionEnded(uint256 indexed auctionId, address tokenOwner, address winner, uint256 sellerProceeds, uint256 protocolFee)",
)
const auctionCanceledEvent = parseAbiItem(
  "event AuctionCanceled(uint256 indexed auctionId)",
)
const auctionBidEvent = parseAbiItem(
  "event AuctionBid(uint256 indexed auctionId, address indexed bidder, uint256 amount, bool firstBid, bool extended)",
)

export type AuctionStatus = "live" | "upcoming" | "settled" | "cancelled"

export type AuctionSummary = {
  auctionId: string
  tokenContract: Address
  tokenId: string
  reservePrice: string // wei as decimal string
  duration: string // seconds
  /** Current high bid in wei. "0" if no bids. */
  amount: string
  bidder: Address
  endTime: string // unix seconds; "0" before first bid
  firstBidTime: string
  tokenOwner: Address
  status: AuctionStatus
  /** For settled auctions: final sale price in wei. Empty otherwise. */
  finalPrice?: string
  /** For settled auctions: winning bidder. Empty otherwise. */
  winner?: Address
}

export type BidEntry = {
  bidder: Address
  amount: string
  blockTime: number
  txHash: `0x${string}`
}

// ─── House resolution ───────────────────────────────────────────────────────

/**
 * Resolve the artist's SovereignAuctionHouse address. Returns null if the
 * artist hasn't deployed one yet — the page renders an empty state with a
 * link to the main app to deploy.
 *
 * Cached for 1 hour; the value almost never changes (an artist deploys
 * exactly one house, ever).
 *
 * Cache-keying note: the public function reads the artist address from
 * `getConfig()` and passes it through as an argument to the cached inner
 * function. `unstable_cache` hashes arguments into the cache key, so the
 * artist address ends up as part of the key. Without this, redeploying
 * the template against a different `NEXT_PUBLIC_ARTIST_ADDRESS` while
 * `.next/cache/` persisted would surface the *previous* artist's house
 * (stale cache hit on the same key).
 */
const _getArtistHouseCached = unstable_cache(
  async (artistAddress: Address): Promise<Address | null> => {
    const { factoryAddress } = getConfig()
    const client = getClient()
    try {
      const house = await client.readContract({
        address: factoryAddress,
        abi: sovereignAuctionHouseFactoryAbi,
        functionName: "houseOf",
        args: [artistAddress],
      })
      if (house === ZERO_ADDRESS) return null
      return house as Address
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[auctions] houseOf failed", err)
      }
      return null
    }
  },
  ["artist-house-v2"],
  { revalidate: 60 * 60, tags: ["artist-house"] },
)

export async function getArtistHouse(): Promise<Address | null> {
  const { artistAddress } = getConfig()
  return _getArtistHouseCached(artistAddress)
}

// ─── Auction list (active + past) ───────────────────────────────────────────

/**
 * All auctions on the artist's house, newest first. Uses
 * `AuctionCreated` events as the master list, then a `multicall` against
 * the house's `auctions(id)` getter for current state, plus
 * `AuctionEnded`/`AuctionCanceled` to disambiguate settled vs. cancelled.
 *
 * Returns an empty list when no house exists. Failure modes (RPC error
 * mid-scan) return what we have so far rather than throwing — the index
 * page degrades gracefully.
 */
// See note on `getArtistHouse` above — passing artistAddress through as an
// argument so it becomes part of the cache key, even though we don't use it
// inside the body (we resolve via getArtistHouse, which has the same key).
const _getAllAuctionsCached = unstable_cache(
  async (artistAddress: Address): Promise<AuctionSummary[]> => {
    const house = await _getArtistHouseCached(artistAddress)
    if (!house) return []
    return withDeadline("getAllAuctions", fetchAllAuctionsForHouse(house))
  },
  ["all-auctions-v2"],
  // 10-min TTL — paired with the netlify/functions/warm-art-cache.mts
  // scheduled function that hits /art every 5 min to keep this populated,
  // and `revalidateTag("all-auctions")` from `app/actions.ts` for instant
  // refresh after bid/settle txs.
  { revalidate: 600, tags: ["all-auctions"] },
)

export async function getAllAuctions(): Promise<AuctionSummary[]> {
  const { artistAddress } = getConfig()
  return _getAllAuctionsCached(artistAddress)
}

async function fetchAllAuctionsForHouse(
  house: Address,
): Promise<AuctionSummary[]> {
  const client = getClient()

  // Master list comes from the contract's own counter, not an event scan.
  // `eth_call` has no block-range limits, so this works on any RPC —
  // including free/public nodes that cap or reject wide `eth_getLogs`
  // (which made the old log-scan approach hang ~100s and return nothing).
  const nextId = (await client.readContract({
    address: house,
    abi: sovereignAuctionHouseAbi,
    functionName: "nextAuctionId",
  })) as bigint
  if (nextId === 0n) return []

  const ids = Array.from({ length: Number(nextId) }, (_, i) => BigInt(i))

  // Current on-chain state for every auctionId via multicall (1 batched
  // eth_call per 100). Live/upcoming auctions return a full struct; the
  // contract deletes storage on settle/cancel, so those come back zeroed
  // (tokenOwner == 0) — we enrich those from events, best-effort, below.
  const BATCH = 100
  const liveAuctions: AuctionSummary[] = []
  const pastIds: bigint[] = []

  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH)
    const results = await client
      .multicall({
        contracts: batch.map((id) => ({
          address: house,
          abi: sovereignAuctionHouseAbi,
          functionName: "auctions" as const,
          args: [id] as const,
        })),
        allowFailure: true,
      })
      .catch(() => [])

    batch.forEach((id, idx) => {
      const idStr = id.toString()
      const r = results[idx]
      if (r && r.status === "success" && r.result) {
        const [
          tId,
          tContract,
          firstBidTime,
          amount,
          rPrice,
          tOwner,
          endTime,
          bidder,
          dur,
        ] = r.result as readonly [
          bigint, Address, bigint, bigint, bigint, Address, bigint, Address, bigint,
        ]
        if (tOwner !== ZERO_ADDRESS) {
          // firstBidTime 0 → not started; otherwise live (incl. ended-but-
          // not-settled, so visitors can still trigger settlement).
          const status: AuctionStatus = firstBidTime === 0n ? "upcoming" : "live"
          liveAuctions.push({
            auctionId: idStr,
            tokenContract: tContract,
            tokenId: tId.toString(),
            reservePrice: rPrice.toString(),
            duration: dur.toString(),
            amount: amount.toString(),
            bidder,
            endTime: endTime.toString(),
            firstBidTime: firstBidTime.toString(),
            tokenOwner: tOwner,
            status,
          })
          return
        }
      }
      // Zeroed struct or failed read → settled/cancelled (storage deleted).
      pastIds.push(id)
    })
  }

  // Past auctions need event data (token contract/id, final price, winner)
  // since their storage is gone. This is the only path that still touches
  // `eth_getLogs`; it's best-effort and time-boxed so a slow/limited RPC
  // degrades to minimal cards instead of failing the whole page. The
  // common case (all auctions still live) skips this entirely.
  let pastAuctions: AuctionSummary[] = []
  if (pastIds.length > 0) {
    pastAuctions = await withDeadline(
      "enrichPastAuctions",
      enrichPastAuctions(house, pastIds),
      ENRICH_DEADLINE_MS,
    ).catch(() =>
      pastIds.map((id) => buildPastSummary(
        id.toString(), ZERO_ADDRESS as Address, "0", "0", "0",
        ZERO_ADDRESS as Address, undefined, false,
      )),
    )
  }

  const auctions = [...liveAuctions, ...pastAuctions]
  // Newest first — auctionIds are assigned sequentially by the contract.
  auctions.sort((a, b) => Number(BigInt(b.auctionId) - BigInt(a.auctionId)))
  return auctions
}

/**
 * Best-effort enrichment of settled/cancelled auctions from events. Bounded
 * by the module scan deadline via the caller; on any failure the caller
 * falls back to minimal cards so the page still renders the live auctions.
 */
async function enrichPastAuctions(
  house: Address,
  pastIds: bigint[],
): Promise<AuctionSummary[]> {
  const { factoryDeployBlock } = getConfig()
  const client = getClient()
  const latest = await client.getBlockNumber()

  const [created, ended, cancelled] = await Promise.all([
    getLogsChunked({
      address: house,
      event: auctionCreatedEvent,
      fromBlock: factoryDeployBlock,
      toBlock: latest,
    }),
    getLogsChunked({
      address: house,
      event: auctionEndedEvent,
      fromBlock: factoryDeployBlock,
      toBlock: latest,
    }),
    getLogsChunked({
      address: house,
      event: auctionCanceledEvent,
      fromBlock: factoryDeployBlock,
      toBlock: latest,
    }),
  ])

  const createdByAuctionId = new Map<string, (typeof created)[number]>()
  for (const log of created) {
    const id = log.args.auctionId
    if (id !== undefined) createdByAuctionId.set(id.toString(), log)
  }
  const settledById = new Map<
    string,
    { winner: Address; sellerProceeds: bigint; protocolFee: bigint }
  >()
  for (const log of ended) {
    const id = log.args.auctionId
    if (id === undefined) continue
    settledById.set(id.toString(), {
      winner: (log.args.winner ?? ZERO_ADDRESS) as Address,
      sellerProceeds: (log.args.sellerProceeds ?? 0n) as bigint,
      protocolFee: (log.args.protocolFee ?? 0n) as bigint,
    })
  }
  const cancelledIds = new Set<string>()
  for (const log of cancelled) {
    const id = log.args.auctionId
    if (id !== undefined) cancelledIds.add(id.toString())
  }

  return pastIds.map((id) => {
    const idStr = id.toString()
    const c = createdByAuctionId.get(idStr)?.args
    return buildPastSummary(
      idStr,
      (c?.tokenContract ?? ZERO_ADDRESS) as Address,
      c?.tokenId?.toString() ?? "0",
      (c?.reservePrice ?? 0n).toString(),
      (c?.duration ?? 0n).toString(),
      (c?.tokenOwner ?? ZERO_ADDRESS) as Address,
      settledById.get(idStr),
      cancelledIds.has(idStr),
    )
  })
}

function buildPastSummary(
  auctionId: string,
  tokenContract: Address,
  tokenId: string,
  reservePrice: string,
  duration: string,
  tokenOwner: Address,
  settled: { winner: Address; sellerProceeds: bigint; protocolFee: bigint } | undefined,
  cancelled: boolean,
): AuctionSummary {
  if (cancelled) {
    return {
      auctionId,
      tokenContract,
      tokenId,
      reservePrice,
      duration,
      amount: "0",
      bidder: ZERO_ADDRESS as Address,
      endTime: "0",
      firstBidTime: "0",
      tokenOwner,
      status: "cancelled",
    }
  }
  if (settled) {
    return {
      auctionId,
      tokenContract,
      tokenId,
      reservePrice,
      duration,
      amount: (settled.sellerProceeds + settled.protocolFee).toString(),
      bidder: settled.winner,
      endTime: "0",
      firstBidTime: "0",
      tokenOwner,
      status: "settled",
      finalPrice: (settled.sellerProceeds + settled.protocolFee).toString(),
      winner: settled.winner,
    }
  }
  // No settle and no cancel events but storage deleted? Shouldn't happen, but
  // fall through as settled with zero data so the UI still has something.
  return {
    auctionId,
    tokenContract,
    tokenId,
    reservePrice,
    duration,
    amount: "0",
    bidder: ZERO_ADDRESS as Address,
    endTime: "0",
    firstBidTime: "0",
    tokenOwner,
    status: "settled",
  }
}

// ─── Single auction (for /auction/[id] detail page) ─────────────────────────

const _getAuctionByIdCached = unstable_cache(
  async (
    artistAddress: Address,
    auctionId: string,
  ): Promise<AuctionSummary | null> => {
    const all = await _getAllAuctionsCached(artistAddress)
    return all.find((a) => a.auctionId === auctionId) ?? null
  },
  ["auction-by-id-v2"],
  { revalidate: 60, tags: ["all-auctions"] },
)

export async function getAuctionById(
  auctionId: string,
): Promise<AuctionSummary | null> {
  const { artistAddress } = getConfig()
  return _getAuctionByIdCached(artistAddress, auctionId)
}

/**
 * Bid history for a single auction. Sorted newest first. Returns [] when
 * the auction has no bids or the scan fails.
 */
const _getBidHistoryCached = unstable_cache(
  async (artistAddress: Address, auctionId: string): Promise<BidEntry[]> => {
    return withDeadline(`getBidHistory(${auctionId})`, fetchBidHistory(artistAddress, auctionId))
  },
  ["bid-history-v2"],
  // 10-min TTL — refreshed on-demand via `revalidateTag("all-auctions")`
  // after bid/settle confirms in BidForm.
  { revalidate: 600, tags: ["all-auctions"] },
)

async function fetchBidHistory(
  artistAddress: Address,
  auctionId: string,
): Promise<BidEntry[]> {
    const house = await _getArtistHouseCached(artistAddress)
    if (!house) return []
    const { factoryDeployBlock } = getConfig()
    const client = getClient()
    const latest = await client.getBlockNumber().catch(() => null)
    if (latest === null) return []

    const logs = await getLogsChunked({
      address: house,
      event: auctionBidEvent,
      args: { auctionId: BigInt(auctionId) },
      fromBlock: factoryDeployBlock,
      toBlock: latest,
    })

    if (logs.length === 0) return []

    const uniqueBlocks = Array.from(
      new Set(logs.map((l) => l.blockNumber).filter((b): b is bigint => b !== null)),
    )
    const blockTimes = new Map<bigint, number>()
    await Promise.all(
      uniqueBlocks.map(async (bn) => {
        try {
          const block = await client.getBlock({ blockNumber: bn })
          blockTimes.set(bn, Number(block.timestamp))
        } catch {
          blockTimes.set(bn, 0)
        }
      }),
    )

    const entries: BidEntry[] = logs
      .filter(
        (l): l is typeof l & { blockNumber: bigint; transactionHash: `0x${string}` } =>
          l.blockNumber !== null && l.transactionHash !== null,
      )
      .map((l) => ({
        bidder: l.args.bidder as Address,
        amount: ((l.args.amount ?? 0n) as bigint).toString(),
        blockTime: blockTimes.get(l.blockNumber) ?? 0,
        txHash: l.transactionHash,
      }))
    entries.sort((a, b) => b.blockTime - a.blockTime)
    return entries
}

export async function getBidHistory(auctionId: string): Promise<BidEntry[]> {
  const { artistAddress } = getConfig()
  return _getBidHistoryCached(artistAddress, auctionId)
}
