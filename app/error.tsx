"use client"

import Link from "next/link"
import { useEffect } from "react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="relative z-10 min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-6">
        <h1
          className="font-title text-5xl md:text-7xl tracking-wider glitch terminal-text"
          data-text="ERROR"
        >
          ERROR
        </h1>
        <p className="font-mono text-sm opacity-60">
          Something glitched on the way to that page.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="font-mono text-xs uppercase tracking-wider border border-white/20 px-3 py-2 hover:border-white/60 hover-trigger transition-colors"
          >
            Retry
          </button>
          <Link
            href="/"
            className="font-mono text-xs uppercase tracking-wider border border-white/20 px-3 py-2 hover:border-white/60 hover-trigger transition-colors"
          >
            ← Home
          </Link>
        </div>
      </div>
    </div>
  )
}
