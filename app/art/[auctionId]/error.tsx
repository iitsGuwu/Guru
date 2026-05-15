"use client"

import { useEffect } from "react"
import Link from "next/link"

/**
 * Route-segment error boundary for /art/[auctionId]. Same purpose as
 * /art/error.tsx — catches RSC stream aborts (e.g. Netlify function timeout
 * during the bid-history scan) so the page recovers gracefully instead of
 * looping React on the broken stream.
 */
export default function AuctionError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[/art/[auctionId] error boundary]", error)
    }
  }, [error])

  return (
    <div className="relative z-10 mx-auto max-w-[2000px] px-6 py-8 md:py-12 space-y-12">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/art"
          className="font-mono text-sm hover-trigger opacity-60 hover:opacity-100 transition-opacity inline-block"
        >
          ← B A C K
        </Link>
      </div>

      <div className="border border-white/15 p-12 text-center space-y-4 max-w-xl mx-auto">
        <p className="font-gothic text-sm tracking-[0.2em] uppercase">
          Auction load failed
        </p>
        <p className="font-mono text-xs text-fg-muted leading-relaxed">
          We couldn&rsquo;t fetch this auction&rsquo;s on-chain state in time.
          Retry below, or head back to the gallery.
        </p>
        <button
          type="button"
          onClick={reset}
          className="text-xs font-mono uppercase tracking-wider px-4 py-2 bg-fg text-bg hover:opacity-80 transition-opacity"
        >
          Retry
        </button>
      </div>
    </div>
  )
}
