import { Suspense } from "react"
import Link from "next/link"
import { ArtistHero } from "@/components/ArtistHero"
import { AuctionCard, bucketFor } from "@/components/AuctionCard"
import { AuctionRealtimeWatcher } from "@/components/AuctionRealtimeWatcher"
import { Footer } from "@/components/Footer"
import { ConnectButton } from "@/components/ConnectButton"
import { PendingRefundsBanner } from "@/components/PendingRefundsBanner"
import {
  getAllAuctions,
  getArtistHouse,
  type AuctionSummary,
} from "@/lib/auctions"
import { getTokenMetadata } from "@/lib/metadata"
import { getArtistDisplayName } from "@/lib/artist"
import type { Metadata } from "next"

// Force-dynamic so we don't try to scan the chain at build time (cold log
// scans on public RPCs routinely exceed Next's 60s static-export timeout).
// `lib/auctions.ts` wraps the RPC reads in `unstable_cache` so subsequent
// requests within the cache TTL are still cheap.
export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  const name = await getArtistDisplayName()
  return {
    title: `Art`,
    description: `On-chain creations by ${name} — live and past auctions pulled directly from the blockchain.`,
  }
}

const BUCKET_RANK: Record<ReturnType<typeof bucketFor>, number> = {
  active: 0,
  ending: 1,
  listed: 2,
  settled: 3,
  cancelled: 4,
}

function compareAuctions(a: AuctionSummary, b: AuctionSummary): number {
  const ra = BUCKET_RANK[bucketFor(a)]
  const rb = BUCKET_RANK[bucketFor(b)]
  if (ra !== rb) return ra - rb
  const ba = bucketFor(a)
  if (ba === "active" || ba === "ending") {
    return Number(a.endTime) - Number(b.endTime)
  }
  return Number(b.auctionId) - Number(a.auctionId)
}

export default async function ArtPage() {
  return (
    <div className="relative z-10 mx-auto max-w-[2000px] px-6 py-8 md:py-12 space-y-12">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/"
          className="font-mono text-sm hover-trigger opacity-60 hover:opacity-100 transition-opacity inline-block"
        >
          ← B A C K
        </Link>
        <ConnectButton />
      </div>

      {/* Hero streams in immediately — only needs ENS + house reads (cached 6h / 1h). */}
      <Suspense fallback={<HeroFallback />}>
        <ArtistHero />
      </Suspense>

      {/* Grid streams in once the chain scan completes. */}
      <Suspense fallback={<GridFallback />}>
        <AuctionGrid />
      </Suspense>

      <Footer />
    </div>
  )
}

async function AuctionGrid() {
  const [auctions, house] = await Promise.all([
    getAllAuctions(),
    getArtistHouse(),
  ])

  if (!house) return <NoHouseState />

  // Warm the token-metadata cache for all auctions in parallel so each
  // <AuctionCard> render hits the in-memory cache rather than firing a
  // fresh RPC + IPFS fetch.
  await Promise.all(
    auctions.map((a) => getTokenMetadata(a.tokenContract, a.tokenId)),
  )

  const sorted = [...auctions].sort(compareAuctions)
  const activeCount = auctions.filter((a) => {
    const b = bucketFor(a)
    return b === "active" || b === "ending"
  }).length

  if (sorted.length === 0) {
    return (
      <div className="space-y-4">
        <PendingRefundsBanner houseAddress={house} />
        <AuctionRealtimeWatcher houseAddress={house} />
        <EmptyState />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PendingRefundsBanner houseAddress={house} />
      <AuctionRealtimeWatcher houseAddress={house} />
      <p className="font-mono text-xs text-fg-muted">
        {auctions.length} {auctions.length === 1 ? "auction" : "auctions"}
        {activeCount > 0 ? ` · ${activeCount} live` : ""}
      </p>
      <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 [&>*]:mb-6 [&>*]:break-inside-avoid">
        {sorted.map((a) => (
          <AuctionCard key={a.auctionId} auction={a} />
        ))}
      </div>
    </div>
  )
}

function HeroFallback() {
  return (
    <div className="flex flex-col sm:flex-row items-start gap-6">
      <div className="h-20 w-20 shrink-0 rounded-full skeleton" />
      <div className="space-y-3 pt-2">
        <div className="h-8 w-48 skeleton" />
        <div className="h-3 w-28 skeleton" />
        <div className="h-3 w-64 skeleton" />
      </div>
    </div>
  )
}

function GridFallback() {
  return (
    <div className="border border-white/15 p-12 text-center">
      <p className="font-mono text-sm text-fg-muted animate-pulse">
        Loading auctions…
      </p>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="border border-white/15 p-12 text-center">
      <p className="font-mono text-sm text-fg-muted">
        No auctions yet — they&rsquo;ll appear here once they&rsquo;re created on-chain.
      </p>
    </div>
  )
}

function NoHouseState() {
  return (
    <div className="border border-white/15 p-12 text-center space-y-2">
      <p className="font-gothic text-sm tracking-[0.2em] uppercase">
        Auction house not deployed
      </p>
      <p className="font-mono text-sm text-fg-muted max-w-md mx-auto">
        This wallet hasn&rsquo;t deployed a Sovereign auction house yet. Once
        deployed, every auction created shows up here automatically.
      </p>
    </div>
  )
}
