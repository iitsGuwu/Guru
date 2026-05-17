import { Suspense } from "react"
import Link from "next/link"
import { ArtistHero } from "@/components/ArtistHero"
import { AuctionCard } from "@/components/AuctionCard"
import { CatalogCard } from "@/components/CatalogCard"
import { AuctionRealtimeWatcher } from "@/components/AuctionRealtimeWatcher"
import { Footer } from "@/components/Footer"
import { ConnectButton } from "@/components/ConnectButton"
import { PendingRefundsBanner } from "@/components/PendingRefundsBanner"
import { getArtistHouse } from "@/lib/auctions"
import { getCatalog } from "@/lib/catalog"
import { getArtistDisplayName } from "@/lib/artist"
import { checkConfig } from "@/lib/config"
import type { Metadata } from "next"

// Force-dynamic so we don't try to scan the chain at build time (cold log
// scans on public RPCs routinely exceed Next's 60s static-export timeout).
// `lib/auctions.ts` wraps the RPC reads in `unstable_cache` so subsequent
// requests within the cache TTL are still cheap.
export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  // Must not throw on a misconfigured deploy — otherwise the whole route
  // 500s before the page's graceful ConfigErrorState can render.
  if (!checkConfig().ok) {
    return { title: "Art" }
  }
  const name = await getArtistDisplayName()
  return {
    title: `Art`,
    description: `The full on-chain catalog of ${name} — every piece across their collections, with live auctions where pieces are listed.`,
  }
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

      {/* Catalog streams in once the on-chain reads complete. */}
      <Suspense fallback={<GridFallback />}>
        <CatalogGrid />
      </Suspense>

      <Footer />
    </div>
  )
}

async function CatalogGrid() {
  // Preflight: a missing/invalid NEXT_PUBLIC_ARTIST_ADDRESS is a permanent
  // deploy misconfiguration. Render a specific, actionable message instead
  // of letting getConfig() throw into the generic retry boundary.
  const cfg = checkConfig()
  if (!cfg.ok) {
    console.error(`[/art] configuration error: ${cfg.reason}`)
    return <ConfigErrorState reason={cfg.reason} />
  }

  let items: Awaited<ReturnType<typeof getCatalog>>
  let house: Awaited<ReturnType<typeof getArtistHouse>>
  try {
    ;[items, house] = await Promise.all([getCatalog(), getArtistHouse()])
  } catch (err) {
    // Surface the real cause in Netlify's function logs — Next.js strips
    // Server Component error messages from the production error boundary.
    console.error("[/art] catalog load failed:", err)
    throw err
  }

  const liveCount = items.filter(
    (i) => i.auction && i.auction.status !== "cancelled",
  ).length

  if (items.length === 0) {
    return (
      <div className="space-y-4">
        {house ? <PendingRefundsBanner houseAddress={house} /> : null}
        {house ? <AuctionRealtimeWatcher houseAddress={house} /> : null}
        <EmptyState />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {house ? <PendingRefundsBanner houseAddress={house} /> : null}
      {house ? <AuctionRealtimeWatcher houseAddress={house} /> : null}
      <p className="font-mono text-xs text-fg-muted">
        {items.length} {items.length === 1 ? "work" : "works"}
        {liveCount > 0 ? ` · ${liveCount} on auction` : ""}
      </p>
      <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 [&>*]:mb-6 [&>*]:break-inside-avoid">
        {items.map((item) =>
          item.auction ? (
            <AuctionCard
              key={`${item.contract}:${item.tokenId}`}
              auction={item.auction}
            />
          ) : (
            <CatalogCard
              key={`${item.contract}:${item.tokenId}`}
              item={item}
            />
          ),
        )}
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
        Loading gallery…
      </p>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="border border-white/15 p-12 text-center">
      <p className="font-mono text-sm text-fg-muted">
        No works found — check the configured collection contracts.
      </p>
    </div>
  )
}

function ConfigErrorState({ reason }: { reason: string }) {
  return (
    <div className="border border-status-sold/40 bg-status-sold/5 p-12 text-center space-y-2">
      <p className="font-gothic text-sm tracking-[0.2em] uppercase">
        Site not configured
      </p>
      <p className="font-mono text-sm text-fg-muted max-w-md mx-auto">
        {reason}
      </p>
    </div>
  )
}
