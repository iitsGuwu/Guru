'use client'

import { useState } from 'react'
import Link from 'next/link'
import GlitchGrid from './components/GlitchGrid'
import { ScrambleText } from './components/ScrambleText'

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
              className="nav-btn group relative flex items-center justify-center p-4 hover:bg-white/5 transition-all duration-300 hover-trigger"
            >
              <ScrambleText
                text="Creations"
                className="font-gothic text-lg md:text-xl tracking-[0.2em] uppercase"
              />
              <span className="absolute right-4 font-mono text-xs text-term opacity-0 group-hover:opacity-70 transition-opacity duration-300 terminal-text">
                /art gallery
              </span>
            </Link>

            <Link
              href="/community"
              className="nav-btn group relative flex items-center justify-center p-4 hover:bg-white/5 transition-all duration-300 hover-trigger"
            >
              <ScrambleText
                text="Builds"
                className="font-gothic text-lg md:text-xl tracking-[0.2em] uppercase"
              />
              <span className="absolute right-4 font-mono text-xs text-term opacity-0 group-hover:opacity-70 transition-opacity duration-300 terminal-text">
                /community
              </span>
            </Link>

            <a
              href="https://x.com/iitsGuru"
              target="_blank"
              rel="noopener noreferrer"
              className="nav-btn group relative flex items-center justify-center p-4 hover:bg-white/5 transition-all duration-300 hover-trigger"
            >
              <ScrambleText
                text="X / Twitter"
                className="font-gothic text-lg md:text-xl tracking-[0.2em] uppercase"
              />
              <span className="absolute right-4 font-mono text-xs text-term opacity-0 group-hover:opacity-70 transition-opacity duration-300 terminal-text">
                @iitsGuru
              </span>
            </a>

            <div
              className="transition-all duration-300"
              style={{
                background: miscOpen ? 'rgba(255,255,255,0.05)' : undefined,
              }}
            >
              <button
                onClick={() => setMiscOpen(!miscOpen)}
                aria-expanded={miscOpen}
                className="nav-btn w-full relative flex items-center justify-center p-4 hover:bg-white/5 transition-all duration-300 hover-trigger"
              >
                <ScrambleText
                  text="Miscellaneous"
                  className="font-gothic text-lg md:text-xl tracking-[0.2em] uppercase"
                />
                <span
                  className="absolute right-4 font-mono text-xs text-term terminal-text transition-transform duration-300"
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
                <div className="px-4 py-3 flex flex-col gap-3">
                  <a
                    href="https://affil.trezor.io/aff_c?offer_id=133&aff_id=31924"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group/sub relative w-full flex items-center justify-center hover-trigger"
                  >
                    <ScrambleText
                      text="TREZOR WALLET AFFILIATE"
                      className="font-mono text-sm tracking-wider opacity-60 group-hover/sub:opacity-100 transition-opacity"
                    />
                    <span className="absolute right-0 font-mono text-[10px] text-term terminal-text opacity-0 group-hover/sub:opacity-70 transition-opacity">Cold Storage ↗</span>
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
