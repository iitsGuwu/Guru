# Feature backlog

Proposals carried forward from the 2026-05 site audit. P0 items (pending refunds banner, real-time event listeners, pre-flight simulation) have already been implemented — see the `perf: P0 critical UX fixes` commit. Everything below is open work.

Ordered loosely by impact-per-effort. Each item is independently implementable.

---

## P1 — Strong UX wins (1–3 hours each)

### Outbid notification
When the connected wallet held the top bid and a new `AuctionBid` event fires from a different address, fire a browser notification (opt-in via `Notification.requestPermission`) plus a visual toast. Builds on the `AuctionBid` watcher already running in `BidForm.tsx`.

**Files to touch**: `components/BidForm.tsx`, new `components/OutbidToast.tsx`.

### Bid history sparkline
Tiny inline SVG line chart in the detail-page sidebar showing price progression across the auction's bids. Data already loaded via `getBidHistory()`.

**Files to touch**: new `components/BidHistorySparkline.tsx`, mount inside `app/art/[auctionId]/page.tsx`.

### Artist admin panel (gated)
When `connected === cfg.artistAddress`, surface a collapsible Admin panel on `/art` exposing:
- Create auction (token contract + token ID + reserve + duration)
- Cancel any of your auctions
- Update reserve price for any pre-bid auction
- Recover stuck ERC-721
- View `pendingRefunds(address)` for any address

Today the artist has to use Etherscan's write tab to do any of this.

**Contract methods**: `createAuction`, `bulkCreateAuctions`, `cancelAuction`, `bulkCancelAuctions`, `setAuctionReservePrice`, `recoverStuckERC721`.

**Files to touch**: new `components/AdminPanel.tsx`, `app/art/page.tsx`.

---

## P2 — Polish (half-day each)

### Watchlist (localStorage)
Star icon on each `AuctionCard`. Starred auctions surface in a sticky "Watching" section at the top of `/art` with live countdowns. No backend needed.

**Files to touch**: new `components/WatchStar.tsx`, new `lib/watchlist.ts` (localStorage helper), `app/art/page.tsx`, `components/AuctionCard.tsx`.

### End-of-auction reminder (.ics)
Click a clock icon on the detail page → generate a `.ics` calendar invite for `endTime - 10min`. Pure client-side, no email infrastructure required.

**Files to touch**: new `components/EndReminderButton.tsx`, `app/art/[auctionId]/page.tsx`.

### Token gallery (non-auction view)
Add `/collection` route showing every token the artist has ever owned/minted — not just ones currently/previously auctioned. Useful for browsing the body of work.

**Implementation note**: scan `Transfer` events on tracked token contracts (or all factory-deployed token contracts if the artist owns multiple); intersect with `ownerOf(tokenId) == artistAddress`.

**Files to touch**: new `app/collection/page.tsx`, possibly new `lib/collection.ts`.

### Auction extension visual indicator
When `AuctionEndTimeUpdated` has fired ≥1 time for an auction, show an `EXTENDED ×N` badge next to the countdown. Communicates anti-sniping clearly to viewers.

**Implementation note**: count `AuctionEndTimeUpdated` events per auction during the existing scan in `lib/auctions.ts`.

**Files to touch**: `lib/auctions.ts`, `components/AuctionCard.tsx`, `components/BidForm.tsx`.

### Share buttons with OG preview
"Share to X" / "Share to Farcaster" / "Copy link" on the detail page. The OG card images already exist and look great unfurled.

**Files to touch**: new `components/ShareRow.tsx`, `app/art/[auctionId]/page.tsx`.

### Min-bid increment readability
Show `Min bid: 0.55 ETH (+10% over current)` instead of just `Min bid 0.55 ETH`. Surfaces the contract's `MIN_BID_INCREMENT_BPS` value.

**Files to touch**: `components/BidForm.tsx` — add a `useReadContract` for `MIN_BID_INCREMENT_BPS`.

### Pending tx tracker
Show "Pending tx: 0x... · 4 min ago · [Speed up]" affordance for stuck bids. Uses `useWaitForTransactionReceipt` already loaded.

**Files to touch**: `components/BidForm.tsx`, new `components/PendingTxBadge.tsx`.

---

## P3 — Bigger lift (1–3 days each)

### Multi-chain support
Add Base / Optimism / Zora as supported chains. Most contemporary artist drops live on L2s now. Requires deploying a Sovereign factory on each chain (out of scope of the site, but worth flagging).

**Files to touch**: `lib/config.ts` (multi-chain factory address), `lib/wagmi-config.ts`, `lib/rpc.ts`, `lib/auctions.ts`, `components/BidForm.tsx`.

### Bidder profile page
`/bidder/[address]` showing all auctions a given bidder participated in. Could surface "this bidder has won 3 of your past drops" social proof.

**Implementation note**: filter `AuctionBid` events by `bidder` (indexed), join against `AuctionEnded` to mark wins.

**Files to touch**: new `app/bidder/[address]/page.tsx`, new `lib/bidder.ts`.

### Statistics dashboard
`/stats` route: total volume, average price, highest sale, total unique bidders, auction count by month, top bidders. All derivable from events already scanned.

**Files to touch**: new `app/stats/page.tsx`, new `lib/stats.ts`.

### Comment / cheer thread per auction
XMTP-based (no DB needed), wallet-signed messages tied to auction ID. Adds a social layer for live auctions.

**Files to touch**: new `components/AuctionChat.tsx`, integration with XMTP browser SDK.

### PWA / offline mode
Service worker that caches visited auction pages. Once viewed, accessible offline. Nice for collectors browsing their wins on the go.

**Files to touch**: new `app/sw.ts`, `next.config.ts` (worker config), `app/manifest.json`.

### Drop calendar
`/drops` route listing all `AuctionCreated` events grouped by month, with the artwork preview. Becomes a portfolio timeline.

**Files to touch**: new `app/drops/page.tsx`, new `lib/drops.ts`.

### Interactive 3D / generative art
Sandboxed `<iframe>` for HTML-based tokens (sandbox `allow-scripts` only, no `same-origin`). Lets the site host the actual generative experience rather than just a thumbnail.

**Implementation note**: detect HTML content-type via metadata, wrap in iframe with strict sandbox.

**Files to touch**: `components/TokenMedia.tsx`, `components/AuctionCardImage.tsx`.

---

## Security follow-ups (from audit)

### Content-Security-Policy header
Lock down `img-src`, `connect-src`, `frame-src`, etc. Mitigates SVG-fetched-resource leaks and arbitrary embedded URLs from on-chain metadata.

**Files to touch**: `next.config.ts` (`headers()` export), or `middleware.ts` to set CSP per route.

### URL validation for ENS `url` text record
The `getArtistLinks` resolver prepends `https://` to whatever the ENS record says without checking it's a valid URL. Add a `URL` constructor check + drop anything that isn't an `http(s)://` after normalization.

**Files to touch**: `lib/artist.ts`.

### Unicode normalization for ENS / token names
NFC-normalize and screen for confusables / RTL override characters before displaying ENS names and token titles. Mitigates homograph phishing.

**Files to touch**: `lib/format.ts` (`displayFor`), `lib/metadata.ts` (token name).

### Replace dead `cloudflare-ipfs.com` gateway
Cloudflare deprecated their public IPFS gateway in Aug 2024. Remove it from `IPFS_GATEWAYS` and add a working alternative (e.g., `4everland.io`).

**Files to touch**: `lib/metadata.ts`, `lib/artist.ts`.

---

## Performance follow-ups (from audit)

### Multicall the detail-page reads
`useReadContract` × 2 in `BidForm` fires two separate RPCs every refetch. Batch via viem's multicall.

**Files to touch**: `components/BidForm.tsx`.

### Track house deployment block per artist
Scan the factory once for the `HouseDeployed` event matching `artistAddress`, cache the block forever. Use it as `fromBlock` for auction scans instead of `SOVEREIGN_FACTORY_DEPLOY_BLOCK`. Cuts scan range substantially for newer artists.

**Files to touch**: `lib/auctions.ts`, possibly add a new event to the factory ABI export.

### Edge runtime for `/art`
Currently uses `nodejs` runtime. Edge has shorter cold starts but the viem `getLogs` calls still take the same wall time, so net win depends on traffic pattern. Worth benchmarking.

**Files to touch**: `app/art/page.tsx` — `export const runtime = "edge"`.
