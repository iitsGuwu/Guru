/**
 * Token metadata + media via on-chain `tokenURI` reads.
 *
 * Reservoir's NFT API was the original primary source but they shut it down
 * Oct 2025. The viable replacements (Alchemy, Moralis, OpenSea) all require
 * API keys, which would defeat the zero-signup deploy goal of this template.
 * Direct `tokenURI` reads + IPFS-gateway race work fine for the volume a
 * personal artist page sees.
 *
 * Three URI shapes we have to handle:
 *
 *  - `data:application/json;...,{...}` — parse the body inline, never fetch.
 *    Many minimal/on-chain-art contracts (e.g. zorb-style SVGs) embed full
 *    metadata + a `data:image/svg+xml;base64,...` image right in the token
 *    URI. The body can be raw JSON, percent-encoded, or base64.
 *  - `ipfs://...` — race a few public gateways and use the first response.
 *  - `https://...` — straight fetch.
 *
 * We don't resolve `image` URLs from the metadata at all when they're already
 * `data:` URLs — `<img>` renders them directly. IPFS images get rewritten
 * through a reliable single gateway (`IMAGE_GATEWAY`).
 */
import "server-only"
import { unstable_cache } from "next/cache"
import { type Address } from "viem"
import { getClient } from "./rpc"
import { erc721Abi } from "./abi"

// Gateways raced for metadata JSON. nftstorage.link / cloudflare-ipfs.com /
// dweb.link were all dead (timeouts / DNS failure / HTML error pages) as of
// 2026-05 — keeping them only added latency to the Promise.any race. These
// three are verified working and ordered fastest-first.
const IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://ipfs.filebase.io/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
]

// Single gateway used to rewrite `ipfs://` image URLs into something an
// <img> can load. Must be reliable on its own (no race/fallback once the
// HTML is sent to the browser). ipfs.io is the fastest verified option.
const IMAGE_GATEWAY = "https://ipfs.io/ipfs/"

export type TokenMetadata = {
  name: string
  description: string
  /** May be an HTTPS URL, an IPFS-gateway URL, or a `data:` URL. */
  image: string | null
  /** Same as `image` for now; reserved for future thumbnail support. */
  imageSmall: string | null
  collectionName: string | null
  artistDisplay: string | null
}

/**
 * Fetch token metadata. Cached for an hour — token metadata is essentially
 * immutable, but a short TTL covers IPFS pin propagation for newly-minted
 * pieces.
 */
export const getTokenMetadata = unstable_cache(
  async (
    tokenContract: Address,
    tokenId: string,
  ): Promise<TokenMetadata | null> => {
    return fetchFromTokenUri(tokenContract, tokenId)
  },
  // v3: busts entries cached with the old dead-gateway image URLs
  // (nftstorage.link) — bump on any change to image-URL resolution.
  ["token-metadata-v3"],
  { revalidate: 60 * 60, tags: ["token-metadata"] },
)

async function fetchFromTokenUri(
  tokenContract: Address,
  tokenId: string,
): Promise<TokenMetadata | null> {
  const client = getClient()
  let uri: string
  try {
    uri = (await client.readContract({
      address: tokenContract,
      abi: erc721Abi,
      functionName: "tokenURI",
      args: [BigInt(tokenId)],
    })) as string
  } catch {
    return null
  }

  const json = await loadMetadataJson(uri)
  if (!json) return null

  const rawImage = typeof json.image === "string" ? json.image : null
  const image = rawImage ? resolveImageUri(rawImage) : null
  return {
    name: typeof json.name === "string" ? json.name : `#${tokenId}`,
    description: typeof json.description === "string" ? json.description : "",
    image,
    imageSmall: image,
    collectionName: null,
    artistDisplay: null,
  }
}

/**
 * Resolve any `tokenURI` value into a JSON object. Handles `data:` URLs
 * inline; races all IPFS gateways in parallel (first to respond wins);
 * falls back to a direct fetch for HTTPS URLs.
 */
async function loadMetadataJson(
  uri: string,
): Promise<Record<string, unknown> | null> {
  if (uri.startsWith("data:")) {
    return parseDataUrlJson(uri)
  }
  if (uri.startsWith("ipfs://")) {
    const path = uri.slice("ipfs://".length).replace(/^ipfs\//, "")
    const ac = new AbortController()
    try {
      return await Promise.any(
        IPFS_GATEWAYS.map((g) =>
          fetchJson(g + path, AbortSignal.any([ac.signal, AbortSignal.timeout(8_000)])),
        ),
      )
    } catch {
      return null
    } finally {
      ac.abort()
    }
  }
  try {
    return await fetchJson(uri, AbortSignal.timeout(8_000))
  } catch {
    return null
  }
}

async function fetchJson(
  url: string,
  signal: AbortSignal,
): Promise<Record<string, unknown>> {
  const res = await fetch(url, { headers: { Accept: "application/json" }, signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()
  const parsed = JSON.parse(text) as unknown
  if (typeof parsed !== "object" || parsed === null) throw new Error("not an object")
  return parsed as Record<string, unknown>
}

/**
 * Parse a `data:application/json,...` URL inline. Supports the common
 * encodings:
 *
 *  - raw JSON: `data:application/json,{"name":"…"}`
 *  - utf-8 charset: `data:application/json;charset=utf-8,{...}`
 *  - non-standard utf8 param (zorb-style): `data:application/json;utf8,{...}`
 *  - base64: `data:application/json;base64,eyJ…=`
 *  - percent-encoded: `data:application/json,%7B%22name%22%3A%22…`
 *
 * Returns null if the URL isn't JSON or the body fails to parse.
 */
function parseDataUrlJson(url: string): Record<string, unknown> | null {
  const comma = url.indexOf(",")
  if (comma === -1) return null
  const header = url.slice(5, comma) // strip "data:"
  const body = url.slice(comma + 1)

  // Header looks like: "<mediatype>;<param>;...;<base64?>"
  const parts = header.split(";").map((p) => p.trim())
  const mediatype = parts[0] || "text/plain"
  const isBase64 = parts.some((p) => p.toLowerCase() === "base64")

  // Bail if it's not JSON-shaped. Accept */json, */json+ld, etc.
  if (!/json/i.test(mediatype) && mediatype !== "application/octet-stream") {
    return null
  }

  let text: string
  if (isBase64) {
    try {
      text = Buffer.from(body, "base64").toString("utf-8")
    } catch {
      return null
    }
  } else {
    try {
      text = decodeURIComponent(body)
    } catch {
      // Not percent-encoded — use the raw body as-is. Common for
      // contracts that paste literal JSON after the comma.
      text = body
    }
  }

  try {
    const parsed = JSON.parse(text)
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

/**
 * Rewrite the metadata's `image` field to something a browser `<img>` /
 * `next/image` can render directly. `data:` URLs and HTTPS URLs pass through
 * unchanged; `ipfs://` gets resolved through the reliable image gateway.
 */
function resolveImageUri(uri: string): string {
  if (uri.startsWith("ipfs://")) {
    const path = uri.slice("ipfs://".length).replace(/^ipfs\//, "")
    return IMAGE_GATEWAY + path
  }
  return uri
}
