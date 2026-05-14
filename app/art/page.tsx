'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import CustomCursor from '../components/CustomCursor'

interface NFTToken {
  token: {
    tokenId: string
    name: string | null
    description: string | null
    image: string | null
    collection: {
      name: string | null
      id: string | null
    }
    lastSale?: {
      price?: {
        amount?: { decimal: number }
        currency?: { symbol: string }
      }
    }
  }
  market?: {
    floorAsk?: {
      price?: {
        amount?: { decimal: number }
        currency?: { symbol: string }
      }
    }
  }
}

const CREATOR_ADDRESS = '0x2296E706d9D677d950D338673108b830179F1146'

export default function ArtPage() {
  const [tokens, setTokens] = useState<NFTToken[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchTokens() {
      try {
        // Reservoir API — fetch tokens created by this address
        const res = await fetch(
          `https://api.reservoir.tools/tokens/v7?creator=${CREATOR_ADDRESS}&sortBy=tokenId&sortDirection=desc&limit=50`,
          {
            headers: {
              'Accept': 'application/json',
            },
          }
        )
        
        if (!res.ok) throw new Error(`API returned ${res.status}`)
        
        const data = await res.json()
        setTokens(data.tokens || [])
      } catch (err) {
        console.error('Failed to fetch tokens:', err)
        setError('Failed to load creations from the blockchain.')
      } finally {
        setLoading(false)
      }
    }

    fetchTokens()
  }, [])

  return (
    <>
      <CustomCursor />
      
      <div className="scanlines"></div>
      <div className="crt-flicker"></div>

      <div className="min-h-screen p-6 md:p-12 max-w-[2000px] mx-auto space-y-12 relative z-10">
        
        {/* Navigation back */}
        <Link href="/" className="font-mono text-sm hover-trigger opacity-60 hover:opacity-100 transition-opacity inline-block">
          ← B A C K
        </Link>

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start gap-8">
          <div className="relative w-24 h-24 shrink-0 border border-white/30 p-1">
            <Image
              src="/assets/images/guru-pfp.jpg"
              alt="iitsGuru"
              fill
              className="object-cover grayscale"
            />
          </div>
          
          <div className="space-y-3">
            <h1 className="text-4xl md:text-6xl font-title glitch terminal-text" data-text="iitsGuru">
              iitsGuru
            </h1>
            <p className="font-mono text-xs text-white/40 tracking-wider">
              {CREATOR_ADDRESS.slice(0, 6)}...{CREATOR_ADDRESS.slice(-4)} · iitsguru.eth
            </p>
            <p className="max-w-xl text-sm font-mono opacity-50 leading-relaxed">
              On-chain creations pulled live from the blockchain.
            </p>
            {!loading && (
              <p className="font-mono text-xs opacity-40">
                <strong className="text-white opacity-100">{tokens.length}</strong> creations indexed
              </p>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="font-mono text-[#00ff00] text-sm terminal-text animate-pulse">
              SCANNING_BLOCKCHAIN_FOR_ARTIFACTS...
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="border border-white/20 p-8 text-center space-y-2">
            <p className="font-mono text-sm opacity-70">{error}</p>
            <p className="font-mono text-xs opacity-40">The indexer may be temporarily unavailable.</p>
          </div>
        )}

        {/* Masonry Grid */}
        {!loading && !error && tokens.length > 0 && (
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 [&>*]:mb-6 [&>*]:break-inside-avoid">
            {tokens.map((item) => {
              const t = item.token
              const imageUrl = t.image || '/assets/images/art.png'
              const price = item.market?.floorAsk?.price || t.lastSale?.price
              
              return (
                <div 
                  key={`${t.collection?.id}-${t.tokenId}`} 
                  className="border border-white/15 hover:border-white/50 p-4 bg-black/40 group hover-trigger transition-all duration-300"
                >
                  <div className="relative aspect-square w-full mb-4 border border-white/10 overflow-hidden bg-white/5">
                    <Image
                      src={imageUrl}
                      alt={t.name || `Token #${t.tokenId}`}
                      fill
                      className="object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-500"
                      unoptimized
                    />
                  </div>
                  <div className="flex justify-between items-end font-mono text-sm">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-base tracking-wider truncate">
                        {t.name || `#${t.tokenId}`}
                      </h3>
                      <p className="opacity-40 text-xs mt-1 truncate">
                        {t.collection?.name || 'Unknown Collection'}
                      </p>
                    </div>
                    {price && (
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className="font-bold text-xs">
                          {price.amount?.decimal} {price.currency?.symbol || 'ETH'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && tokens.length === 0 && (
          <div className="border border-white/20 p-12 text-center">
            <p className="font-mono text-sm opacity-50">
              No on-chain creations found for this address.
            </p>
          </div>
        )}

      </div>
    </>
  )
}
