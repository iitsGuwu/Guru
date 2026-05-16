"use client"

import { useEffect } from "react"
import Link from "next/link"

/**
 * Route-segment error boundary for /art. Catches RSC-stream aborts (typical
 * cause: the auction scan exceeded the Netlify function timeout) and renders
 * a graceful retry instead of looping React forever on the broken stream.
 */
export default function ArtError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Always log (prod included). Next.js strips the message from the
    // production digest, so this browser-console line + the server-side
    // "[/art] auction scan failed:" log in the Netlify function are the only
    // ways to see why this fired. The digest correlates the two.
    console.error("[/art error boundary] digest:", error.digest ?? "(none)", error)
  }, [error])

  return (
    <div className="relative z-10 mx-auto max-w-[2000px] px-6 py-8 md:py-12 space-y-12">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/"
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
          The on-chain scan didn&rsquo;t complete. If a retry doesn&rsquo;t clear
          it, check the Netlify function log for the line starting
          &ldquo;[/art] auction scan failed&rdquo; — that has the real cause.
        </p>
        <button
          type="button"
          onClick={reset}
          className="text-xs font-mono uppercase tracking-wider px-4 py-2 bg-fg text-bg hover:opacity-80 transition-opacity"
        >
          Retry
        </button>
        {error.digest ? (
          <p className="font-mono text-[10px] text-fg-muted/60 pt-2">
            ref: {error.digest}
          </p>
        ) : null}
      </div>
    </div>
  )
}
