/**
 * Browser-side wagmi config for connect + bid txs.
 *
 * Zero-config posture: artists deploy without registering anything anywhere.
 * The connect modal works for any browser-extension wallet (MetaMask, Rabby,
 * Frame, Brave, OKX, Phantom, etc.) plus Coinbase Wallet and Safe — all of
 * which work without a WalletConnect project ID. Mobile users connecting via
 * WC QR codes are off by default; if an artist wants to enable that, they
 * register a free project at cloud.reown.com and set
 * NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID. We detect that env var and add the
 * WC connector to the wallet list when present.
 *
 * We bypass RainbowKit's `getDefaultConfig` (which always wires up WC and
 * fails noisily without a real project ID) in favor of an explicit
 * `connectorsForWallets` list. That gives us:
 *  - No 403 spam from Reown's API on init when no real project ID is set
 *  - A coherent fallback for wallet UI even when WC isn't in the picture
 *
 * The same RPC URLs that power our server-side viem client are passed to
 * wagmi's `http` transport with `fallback`, so wallet-issued reads (e.g.
 * `useReadContract`) get the same failover behavior as our server reads.
 */
"use client"

import { getDefaultConfig, connectorsForWallets } from "@rainbow-me/rainbowkit"
import {
  injectedWallet,
  coinbaseWallet,
  rainbowWallet,
  walletConnectWallet,
  safeWallet,
} from "@rainbow-me/rainbowkit/wallets"
import { fallback, http, createConfig, createStorage, noopStorage } from "wagmi"
import { mainnet } from "wagmi/chains"
import { DEFAULT_WALLETCONNECT_PROJECT_ID, getConfig } from "./config"

const PUBLIC_RPCS = [
  "https://ethereum-rpc.publicnode.com",
  "https://eth.drpc.org",
  "https://eth.llamarpc.com",
  "https://cloudflare-eth.com",
]

let _wagmiConfig: ReturnType<typeof getDefaultConfig> | null = null

export function getWagmiConfig() {
  if (_wagmiConfig) return _wagmiConfig

  const cfg = getConfig()
  const urls =
    cfg.userRpcUrls && cfg.userRpcUrls.length > 0
      ? [...cfg.userRpcUrls, ...PUBLIC_RPCS]
      : PUBLIC_RPCS

  const transports = {
    [mainnet.id]: fallback(
      urls.map((url) => http(url, { retryCount: 1, timeout: 15_000 })),
    ),
  }

  // Are we using the placeholder WalletConnect project ID? If so, skip the
  // WC mobile connector — its initialization fails with the placeholder and
  // prevents the rest of the connector list from rendering.
  const hasRealWcProjectId =
    cfg.walletConnectProjectId !== DEFAULT_WALLETCONNECT_PROJECT_ID &&
    cfg.walletConnectProjectId.length > 0

  // Build the explicit wallet list. injectedWallet covers any in-browser
  // wallet that exposes window.ethereum (MetaMask extension, Rabby, Frame,
  // Brave, OKX, Phantom, etc.) — no SDK socket needed. Coinbase + Safe
  // bring their own connectors that don't require a WC project ID.
  //
  // We intentionally do NOT include RainbowKit's `metaMaskWallet` here:
  // it pulls in @metamask/sdk, which opens a persistent WebSocket to
  // MetaMask's mobile-pairing relay. Without a real pairing in progress
  // that socket drops with "Connection closed" and the SDK retries in a
  // tight loop, flipping React state and producing visible console errors
  // on every page. MetaMask Mobile users pair via WalletConnect instead
  // (opt-in below once NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is set).
  const baseWallets = [injectedWallet, coinbaseWallet, safeWallet]
  const wallets = hasRealWcProjectId
    ? [...baseWallets, walletConnectWallet, rainbowWallet]
    : baseWallets

  const connectors = connectorsForWallets(
    [{ groupName: "Wallets", wallets }],
    {
      appName: cfg.artistName ?? "Auctions",
      // RainbowKit still requires this even when WC isn't in the wallet list.
      // It just gets passed to any connector that needs it; if none do, it's
      // unused.
      projectId: cfg.walletConnectProjectId,
    },
  )

  _wagmiConfig = createConfig({
    chains: [mainnet],
    connectors,
    transports,
    ssr: true,
    // Disable auto-reconnect on page load — users must click Connect Wallet
    // explicitly. noopStorage prevents wagmi from persisting or restoring
    // the last-connected wallet across navigations.
    storage: createStorage({ storage: noopStorage }),
  }) as unknown as ReturnType<typeof getDefaultConfig>
  return _wagmiConfig
}
