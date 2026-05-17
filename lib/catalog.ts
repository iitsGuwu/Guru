/**
 * The artist's full catalog — every piece across their declared NFT
 * collections, not just the ones currently on auction.
 *
 * The SovereignAuctionHouse only knows tokens that were auctioned, so the
 * complete body of work is enumerated directly from each collection
 * contract: `totalSupply()` + `ownerOf(id)` + `tokenURI(id)` — all
 * `eth_call`, no `eth_getLogs`, so this is fast and reliable on any RPC
 * (free Alchemy / public nodes alike). Live auctions are overlaid by
 * matching (tokenContract, tokenId) so an auctioned piece links to its
 * bid page while everything else renders as a static gallery card.
 */
import "server-only"
import { unstable_cache } from "next/cache"
import { type Address } from "viem"
import { getClient } from "./rpc"
import { getConfig } from "./config"
import { getAllAuctions, type AuctionSummary } from "./auctions"
import { getTokenMetadata } from "./metadata"

const collectionAbi = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "ownerOf", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "address" }] },
] as const

export type CatalogItem = {
  contract: Address
  collectionName: string
  tokenId: string
  name: string
  image: string | null
  owner: Address | null
  /** Live/upcoming auction for this exact token, if any (cancelled excluded). */
  auction: AuctionSummary | null
}

async function fetchCatalog(): Promise<CatalogItem[]> {
  const { artContracts } = getConfig()
  if (artContracts.length === 0) return []
  const client = getClient()

  // Live/upcoming auctions indexed by tokenContract:tokenId for overlay.
  const auctions = await getAllAuctions().catch(() => [] as AuctionSummary[])
  const auctionByToken = new Map<string, AuctionSummary>()
  for (const a of auctions) {
    if (a.status === "cancelled") continue
    auctionByToken.set(`${a.tokenContract.toLowerCase()}:${a.tokenId}`, a)
  }

  const order = new Map(artContracts.map((a, i) => [a.toLowerCase(), i]))
  const items: CatalogItem[] = []

  for (const contract of artContracts) {
    let collectionName: string
    let total: bigint
    try {
      ;[collectionName, total] = (await Promise.all([
        client.readContract({ address: contract, abi: collectionAbi, functionName: "name" }),
        client.readContract({ address: contract, abi: collectionAbi, functionName: "totalSupply" }),
      ])) as [string, bigint]
    } catch {
      // Collection unreadable / no totalSupply — skip rather than fail page.
      continue
    }

    // These contracts mint sequentially from id 1. Probe each id; tolerate
    // gaps (burned / non-existent) by dropping ids that have neither an
    // owner nor metadata.
    const ids = Array.from({ length: Number(total) }, (_, i) => BigInt(i + 1))
    await Promise.all(
      ids.map(async (id) => {
        const idStr = id.toString()
        const [owner, meta] = await Promise.all([
          client
            .readContract({ address: contract, abi: collectionAbi, functionName: "ownerOf", args: [id] })
            .catch(() => null),
          getTokenMetadata(contract, idStr).catch(() => null),
        ])
        if (owner === null && !meta) return
        items.push({
          contract,
          collectionName,
          tokenId: idStr,
          name: meta?.name ?? `#${idStr}`,
          image: meta?.image ?? null,
          owner: (owner as Address) ?? null,
          auction: auctionByToken.get(`${contract.toLowerCase()}:${idStr}`) ?? null,
        })
      }),
    )
  }

  // Configured-collection order, then token id ascending.
  items.sort((x, y) => {
    const cx = order.get(x.contract.toLowerCase()) ?? 0
    const cy = order.get(y.contract.toLowerCase()) ?? 0
    if (cx !== cy) return cx - cy
    return Number(BigInt(x.tokenId) - BigInt(y.tokenId))
  })
  return items
}

export const getCatalog = unstable_cache(
  async (): Promise<CatalogItem[]> => fetchCatalog(),
  ["catalog-v1"],
  { revalidate: 600, tags: ["all-auctions", "token-metadata", "catalog"] },
)
