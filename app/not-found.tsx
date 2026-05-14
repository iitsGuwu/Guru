import Link from "next/link"

export default function NotFound() {
  return (
    <div className="relative z-10 min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-6">
        <h1
          className="font-title text-6xl md:text-8xl tracking-wider glitch terminal-text"
          data-text="4 0 4"
        >
          4 0 4
        </h1>
        <p className="font-mono text-sm opacity-60">
          That artifact doesn&apos;t exist on this plane.
        </p>
        <Link
          href="/"
          className="inline-block font-mono text-xs uppercase tracking-wider border border-white/20 px-3 py-2 hover:border-white/60 hover-trigger transition-colors"
        >
          ← Return Home
        </Link>
      </div>
    </div>
  )
}
