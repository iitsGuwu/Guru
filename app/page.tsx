'use client'

import { useState } from 'react'
import Link from 'next/link'
import GlitchGrid from './components/GlitchGrid'

export default function Home() {
  const [miscOpen, setMiscOpen] = useState(false)

  return (
    <>
      <main className="relative z-10 min-h-screen flex items-center justify-center overflow-hidden p-6">
        <div className="flex flex-col items-center justify-center gap-16 w-full max-w-2xl mx-auto">

          <div className="text-center select-none">
            <h1
              className="text-6xl md:text-9xl font-title tracking-wider opacity-90 glitch terminal-text"
              data-text="i i t s G u r u"
            >
              i i t s G u r u
            </h1>
          </div>

          <nav className="flex flex-col gap-4 w-full max-w-md">

            <Link
              href="/art"
              className="nav-btn group flex items-center justify-between border border-white/20 p-4 hover:border-white/60 hover:bg-white/5 transition-all duration-300 hover-trigger"
            >
              <span className="font-gothic text-lg md:text-xl tracking-[0.2em] uppercase">Creations</span>
              <span className="font-mono text-xs text-term opacity-0 group-hover:opacity-70 transition-opacity duration-300 terminal-text">
                /art gallery
              </span>
            </Link>

            <Link
              href="/community"
              className="nav-btn group flex items-center justify-between border border-white/20 p-4 hover:border-white/60 hover:bg-white/5 transition-all duration-300 hover-trigger"
            >
              <span className="font-gothic text-lg md:text-xl tracking-[0.2em] uppercase">Builds</span>
              <span className="font-mono text-xs text-term opacity-0 group-hover:opacity-70 transition-opacity duration-300 terminal-text">
                /community
              </span>
            </Link>

            <a
              href="https://x.com/iitsGuru"
              target="_blank"
              rel="noopener noreferrer"
              className="nav-btn group flex items-center justify-between border border-white/20 p-4 hover:border-white/60 hover:bg-white/5 transition-all duration-300 hover-trigger"
            >
              <span className="font-gothic text-lg md:text-xl tracking-[0.2em] uppercase">X / Twitter</span>
              <span className="font-mono text-xs text-term opacity-0 group-hover:opacity-70 transition-opacity duration-300 terminal-text">
                @iitsGuru
              </span>
            </a>

            <div
              className="border border-white/20 transition-all duration-300"
              style={{
                borderColor: miscOpen ? 'rgba(255,255,255,0.6)' : undefined,
                background: miscOpen ? 'rgba(255,255,255,0.05)' : undefined,
              }}
            >
              <button
                onClick={() => setMiscOpen(!miscOpen)}
                aria-expanded={miscOpen}
                className="nav-btn w-full flex items-center justify-between p-4 hover:bg-white/5 transition-all duration-300 hover-trigger"
              >
                <span className="font-gothic text-lg md:text-xl tracking-[0.2em] uppercase">Miscellaneous</span>
                <span
                  className="font-mono text-xs text-term terminal-text transition-transform duration-300"
                  style={{ transform: miscOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
                  aria-hidden
                >
                  {'>'}
                </span>
              </button>

              <div
                className="overflow-hidden transition-all duration-500 ease-in-out"
                style={{ maxHeight: miscOpen ? '200px' : '0px', opacity: miscOpen ? 1 : 0 }}
              >
                <div className="border-t border-white/10 px-4 py-3 flex flex-col gap-3">
                  <a
                    href="https://affil.trezor.io/aff_c?offer_id=133&aff_id=31924"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group/sub flex items-center justify-between hover-trigger"
                  >
                    <span className="font-mono text-sm tracking-wider opacity-60 group-hover/sub:opacity-100 transition-opacity">TREZOR</span>
                    <span className="font-mono text-[10px] text-term terminal-text opacity-0 group-hover/sub:opacity-70 transition-opacity">Cold Storage ↗</span>
                  </a>
                  <a
                    href="https://manifold.xyz/@guru-526fad17/contract/832188656/3"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group/sub flex items-center justify-between hover-trigger"
                  >
                    <span className="font-mono text-sm tracking-wider opacity-60 group-hover/sub:opacity-100 transition-opacity">MANIFOLD</span>
                    <span className="font-mono text-[10px] text-term terminal-text opacity-0 group-hover/sub:opacity-70 transition-opacity">Smart Contracts ↗</span>
                  </a>
                </div>
              </div>
            </div>

          </nav>
        </div>
      </main>

      <GlitchGrid />
    </>
  )
}
