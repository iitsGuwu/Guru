/**
 * Standalone on-chain diagnostic for the /art page.
 *
 * Usage:
 *   node scripts/diagnose-art.mjs 0xYourArtistWalletAddress [optionalRpcUrl]
 *
 * Walks the exact same path the app does:
 *   1. factory.houseOf(artist)          → is a house deployed?
 *   2. factory.isHouse(house)           → sanity
 *   3. scan AuctionCreated on the house → are there any auctions?
 *   4. read auctions(id) for the first  → does the live read work?
 *
 * No env vars, no Next.js — pure viem against mainnet so we can tell
 * whether the problem is on-chain data, configuration, or the app code.
 */
import {
  createPublicClient,
  http,
  fallback,
  parseAbiItem,
  isAddress,
  getAddress,
} from "viem"
import { mainnet } from "viem/chains"

const FACTORY = "0xaE712abcA452901A74D1FBC0c3919F2cc060EF9f"
const DEPLOY_BLOCK = 24_973_294n
const ZERO = "0x0000000000000000000000000000000000000000"

const PUBLIC_RPCS = [
  "https://ethereum-rpc.publicnode.com",
  "https://eth.drpc.org",
  "https://eth.llamarpc.com",
  "https://cloudflare-eth.com",
]

const houseOfAbi = parseAbiItem("function houseOf(address) view returns (address)")
const isHouseAbi = parseAbiItem("function isHouse(address) view returns (bool)")
const totalHousesAbi = parseAbiItem("function totalHouses() view returns (uint256)")
const auctionsAbi = parseAbiItem(
  "function auctions(uint256) view returns (uint256 tokenId, address tokenContract, uint256 firstBidTime, uint256 amount, uint256 reservePrice, address tokenOwner, uint256 endTime, address bidder, uint256 duration)",
)
const auctionCreatedEvent = parseAbiItem(
  "event AuctionCreated(uint256 indexed auctionId, uint256 indexed tokenId, address indexed tokenContract, uint256 duration, uint256 reservePrice, address tokenOwner)",
)

function log(step, msg) {
  console.log(`\n[${step}] ${msg}`)
}

async function main() {
  const rawArtist = process.argv[2]
  const userRpc = process.argv[3]

  if (!rawArtist || !isAddress(rawArtist)) {
    console.error(
      "Usage: node scripts/diagnose-art.mjs 0xArtistAddress [rpcUrl]\n" +
        `Got: ${rawArtist ?? "(nothing)"}`,
    )
    process.exit(1)
  }
  const artist = getAddress(rawArtist)

  const urls = userRpc ? [userRpc, ...PUBLIC_RPCS] : PUBLIC_RPCS
  const client = createPublicClient({
    chain: mainnet,
    transport: fallback(
      urls.map((u) => http(u, { retryCount: 1, timeout: 15_000 })),
    ),
  })

  console.log("=".repeat(64))
  console.log("Sovereign /art on-chain diagnostic")
  console.log("=".repeat(64))
  console.log(`Artist address : ${artist}`)
  console.log(`Factory        : ${FACTORY}`)
  console.log(`RPC chain      : ${userRpc ? `${userRpc} (+ public fallbacks)` : "public RPCs only"}`)

  const blockNo = await client.getBlockNumber().catch((e) => {
    console.error("\nFATAL: cannot reach any RPC:", e.shortMessage || e.message)
    process.exit(1)
  })
  log("0", `RPC reachable. Latest block: ${blockNo}`)

  // ── Step 1: factory totalHouses (proves factory address is live) ──────────
  let totalHouses
  try {
    totalHouses = await client.readContract({
      address: FACTORY,
      abi: [totalHousesAbi],
      functionName: "totalHouses",
    })
    log("1", `factory.totalHouses() = ${totalHouses} (factory contract is live)`)
  } catch (e) {
    log("1", `FAILED to read factory.totalHouses(): ${e.shortMessage || e.message}`)
    console.error(
      "  → The factory address may be wrong, or the RPC is not on mainnet.",
    )
    process.exit(1)
  }

  // ── Step 2: houseOf(artist) ───────────────────────────────────────────────
  const house = await client.readContract({
    address: FACTORY,
    abi: [houseOfAbi],
    functionName: "houseOf",
    args: [artist],
  })

  if (house === ZERO || house.toLowerCase() === ZERO) {
    log("2", `factory.houseOf(${artist}) = ZERO ADDRESS`)
    console.log(
      "\n  ❌ ROOT CAUSE: No SovereignAuctionHouse is deployed for this wallet.\n" +
        "     The /art page will show \"Auction house not deployed\".\n\n" +
        "     Fix one of:\n" +
        "     • This is the WRONG wallet → set NEXT_PUBLIC_ARTIST_ADDRESS in\n" +
        "       Netlify to the wallet that actually deployed the house.\n" +
        "     • You never deployed a house → go to the main Sovereign app and\n" +
        "       call createAuctionHouse() from this wallet first.",
    )
    process.exit(0)
  }
  log("2", `factory.houseOf(artist) = ${house}  ✅ house exists`)

  // ── Step 3: scan AuctionCreated on the house ──────────────────────────────
  log("3", `Scanning AuctionCreated from block ${DEPLOY_BLOCK} → ${blockNo} …`)
  const created = await scanLogs(client, house, auctionCreatedEvent, DEPLOY_BLOCK, blockNo)
  log("3", `Found ${created.length} AuctionCreated event(s)`)

  if (created.length === 0) {
    console.log(
      "\n  ⚠️  House exists but has ZERO auctions. The /art page will show\n" +
        '     "No auctions yet". You need to create an auction on this house\n' +
        "     via the main Sovereign app. (Code/config is fine.)",
    )
    process.exit(0)
  }

  const ids = created
    .map((l) => l.args.auctionId)
    .filter((x) => x !== undefined)
    .sort((a, b) => Number(b - a))
  console.log(`     Auction IDs: ${ids.slice(0, 10).join(", ")}${ids.length > 10 ? " …" : ""}`)

  // ── Step 4: read auctions(firstId) ────────────────────────────────────────
  const firstId = ids[0]
  try {
    const a = await client.readContract({
      address: house,
      abi: [auctionsAbi],
      functionName: "auctions",
      args: [firstId],
    })
    log("4", `auctions(${firstId}) read OK:`)
    console.log(
      `     tokenContract=${a[1]} tokenId=${a[0]} reserve=${a[4]} ` +
        `owner=${a[5]} endTime=${a[6]} bidder=${a[7]}`,
    )
    console.log(
      "\n  ✅ Everything works on-chain. House + auctions + reads all succeed.\n" +
        "     If the live site still shows nothing, the problem is:\n" +
        "     • NEXT_PUBLIC_ARTIST_ADDRESS on Netlify ≠ this address, OR\n" +
        "     • the deployed build predates the env var (trigger a redeploy), OR\n" +
        "     • the scan times out on Netlify (Alchemy RPC fixes this).",
    )
  } catch (e) {
    log("4", `FAILED to read auctions(${firstId}): ${e.shortMessage || e.message}`)
  }
}

async function scanLogs(client, address, event, fromBlock, toBlock) {
  const out = []
  let cursor = fromBlock
  let chunk = 5_000_000n
  const MIN = 1024n
  while (cursor <= toBlock) {
    const end = cursor + chunk - 1n > toBlock ? toBlock : cursor + chunk - 1n
    try {
      const logs = await client.getLogs({ address, event, fromBlock: cursor, toBlock: end })
      out.push(...logs)
      cursor = end + 1n
    } catch (e) {
      const m = (e.message || "").toLowerCase()
      if (
        (m.includes("range") || m.includes("limit") || m.includes("more than")) &&
        chunk > MIN
      ) {
        chunk = chunk / 2n > MIN ? chunk / 2n : MIN
        continue
      }
      console.error(`     getLogs window ${cursor}-${end} failed: ${e.shortMessage || e.message}`)
      cursor = end + 1n
    }
  }
  return out
}

main().catch((e) => {
  console.error("\nUnexpected error:", e)
  process.exit(1)
})
