'use client'

import Link from 'next/link'
import CustomCursor from '../components/CustomCursor'

const communityProjects = [
  {
    name: '$GOLO',
    url: 'https://gboy.golo.wtf',
    tagline: 'Deflationary Token',
    description: 'A deflationary token for $GBOY, built for the @neukoai ecosystem. Tracks live stats, burns, and supply metrics on the official dashboard.',
    stats: ['Deflationary Mechanism', 'Live Burns', 'Community Driven'],
  },
  {
    name: 'Harmie',
    url: 'https://harmie.xyz',
    tagline: 'Pageant Platform',
    description: 'A pageant for the 1-of-1 collection of Harmies, launched by Neuko and the Harmony project. Vote and celebrate the most charming Harmie.',
    stats: ['1/1 Collection', 'Community Voting', 'Harmony Project'],
  },
]

export default function CommunityPage() {
  return (
    <>
      <CustomCursor />

      <div className="scanlines"></div>
      <div className="crt-flicker"></div>

      <div className="min-h-screen p-6 md:p-12 max-w-5xl mx-auto space-y-12 relative z-10">

        {/* Navigation back */}
        <Link href="/" className="font-mono text-sm hover-trigger opacity-60 hover:opacity-100 transition-opacity inline-block">
          ← B A C K
        </Link>

        {/* Page Header */}
        <div className="space-y-4">
          <h1 className="text-4xl md:text-6xl font-gothic tracking-[0.2em] uppercase glitch terminal-text" data-text="Community Builds">
            Community Builds
          </h1>
          <p className="font-mono text-xs md:text-sm opacity-50 tracking-widest max-w-xl">
            Contributions to projects within web3.
            <br />
            Built by the community, for the community.
          </p>
        </div>

        {/* Project Tiles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {communityProjects.map((project) => (
            <a
              key={project.name}
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group border border-white/20 hover:border-white/60 p-6 md:p-8 transition-all duration-300 hover:bg-white/5 hover-trigger flex flex-col gap-6"
            >
              {/* Title Row */}
              <div className="flex items-baseline justify-between">
                <h2 className="font-gothic text-2xl md:text-3xl tracking-[0.15em] uppercase group-hover:text-white transition-colors">
                  {project.name}
                </h2>
                <span className="font-mono text-[10px] text-[#00ff00] terminal-text opacity-0 group-hover:opacity-70 transition-opacity tracking-widest">
                  {project.tagline} ↗
                </span>
              </div>

              {/* Description */}
              <p className="font-mono text-xs leading-relaxed opacity-50 group-hover:opacity-80 transition-opacity">
                {project.description}
              </p>

              {/* Stat Tags */}
              <div className="flex flex-wrap gap-2 mt-auto">
                {project.stats.map((stat) => (
                  <span
                    key={stat}
                    className="font-mono text-[10px] border border-white/10 px-2 py-1 tracking-wider opacity-40 group-hover:opacity-70 group-hover:border-white/30 transition-all"
                  >
                    {stat}
                  </span>
                ))}
              </div>
            </a>
          ))}
        </div>

      </div>
    </>
  )
}
