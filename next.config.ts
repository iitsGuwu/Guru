import type { NextConfig } from "next"
import path from "node:path"

const nextConfig: NextConfig = {
  // Silence the "multiple lockfiles" inference warning — pin tracing
  // root to this workspace.
  outputFileTracingRoot: path.join(__dirname),
  // The MetaMask SDK and WalletConnect's pino logger bundle optional
  // peer deps we never use (React Native AsyncStorage, pino-pretty).
  // Tell webpack to resolve them as empty so the dev-mode "Module not
  // found" warnings stop firing on every HMR cycle.
  webpack: (config) => {
    config.resolve.fallback = {
      ...(config.resolve.fallback ?? {}),
      "@react-native-async-storage/async-storage": false,
      "pino-pretty": false,
    }
    return config
  },
  // Allow Reservoir CDN + common IPFS gateways for token media. NFT
  // metadata can point anywhere, so we keep this list broad but
  // explicit (no `**` wildcard — that would let any HTTPS host be
  // proxied through the Next image optimizer).
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.reservoir.tools" },
      { protocol: "https", hostname: "**.reservoir.tools" },
      { protocol: "https", hostname: "**.ipfs.w3s.link" },
      { protocol: "https", hostname: "cloudflare-ipfs.com" },
      { protocol: "https", hostname: "ipfs.io" },
      { protocol: "https", hostname: "dweb.link" },
      { protocol: "https", hostname: "nftstorage.link" },
      { protocol: "https", hostname: "**.nftstorage.link" },
      { protocol: "https", hostname: "i.seadn.io" },
      { protocol: "https", hostname: "openseauserdata.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "arweave.net" },
    ],
  },
}

export default nextConfig
