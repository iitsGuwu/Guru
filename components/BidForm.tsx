"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { type Address, formatEther, parseEther } from "viem"
import {
  useAccount,
  useBalance,
  useReadContract,
  useSimulateContract,
  useWaitForTransactionReceipt,
  useWatchContractEvent,
  useWriteContract,
} from "wagmi"
import { ConnectButton as RKConnectButton } from "@rainbow-me/rainbowkit"
import { sovereignAuctionHouseAbi } from "@/lib/abi"
import { ZERO_ADDRESS } from "@/lib/config"
import { displayFor, formatEth } from "@/lib/format"
import { refreshAuctions } from "@/app/actions"

// 3 mETH gas reserve — covers a Place Bid tx at typical mainnet fees. Avoids
// the "you have enough for the bid but not enough for gas" failure that
// happens when checking the raw balance.
const GAS_RESERVE_WEI = parseEther("0.003")

// Within this many seconds of the auction's end, poll on-chain state every
// 3s instead of the default 12s so sniping bids surface immediately. The
// contract emits AuctionEndTimeUpdated on extension; we already listen for
// that, but a faster poll catches state changes from other paths too.
const SNIPING_WINDOW_SEC = 300

type Props = {
  houseAddress: Address
  auctionId: string
  /** Server-rendered initial state for fast first paint. */
  initial: {
    amount: string
    endTime: string
    reservePrice: string
    bidder: Address
    firstBidTime: string
    tokenOwner: Address
  }
  /** Pre-resolved ENS map for any addresses we'll display. */
  ensMap?: Map<string, string>
}

/**
 * Live bid + settle panel. Mirrors PND's bid panel chrome from
 * `SettledAuctionSummary` (status header + big tabular-nums price) so
 * pre-bid, mid-auction, and settled all read as one visual family.
 */
export function BidForm({ houseAddress, auctionId, initial, ensMap }: Props) {
  const { address: connected, isConnected } = useAccount()
  const router = useRouter()

  const auctionRead = useReadContract({
    address: houseAddress,
    abi: sovereignAuctionHouseAbi,
    functionName: "auctions",
    args: [BigInt(auctionId)],
    query: {
      initialData: [
        0n,
        ZERO_ADDRESS as Address,
        BigInt(initial.firstBidTime),
        BigInt(initial.amount),
        BigInt(initial.reservePrice),
        initial.tokenOwner,
        BigInt(initial.endTime),
        initial.bidder,
        0n,
      ] as readonly [
        bigint, Address, bigint, bigint, bigint, Address, bigint, Address, bigint,
      ],
      // Dynamic interval: snap to 3s when we're close to the auction's end
      // so sniping bids and time extensions surface before the next render.
      refetchInterval: (query) => {
        const data = query.state.data as
          | readonly [bigint, Address, bigint, bigint, bigint, Address, bigint, Address, bigint]
          | undefined
        if (!data) return 12_000
        const endTime = Number(data[6])
        if (endTime <= 0) return 12_000
        const remaining = endTime - Math.floor(Date.now() / 1000)
        if (remaining > 0 && remaining < SNIPING_WINDOW_SEC) return 3_000
        return 12_000
      },
    },
  })

  const tuple = auctionRead.data as readonly [
    bigint, Address, bigint, bigint, bigint, Address, bigint, Address, bigint,
  ] | undefined
  const amount = tuple?.[3] ?? BigInt(initial.amount)
  const reservePrice = tuple?.[4] ?? BigInt(initial.reservePrice)
  const tokenOwner = (tuple?.[5] ?? initial.tokenOwner) as Address
  const endTime = tuple?.[6] ?? BigInt(initial.endTime)
  const bidder = (tuple?.[7] ?? initial.bidder) as Address
  const firstBidTime = tuple?.[2] ?? BigInt(initial.firstBidTime)

  const minBidRead = useReadContract({
    address: houseAddress,
    abi: sovereignAuctionHouseAbi,
    functionName: "getMinBidAmount",
    args: [BigInt(auctionId)],
    query: { refetchInterval: 12_000 },
  })
  const minBidWei =
    (minBidRead.data as readonly [boolean, bigint] | undefined)?.[1] ??
    (amount === 0n ? reservePrice : amount)

  const isCancelled = tokenOwner === ZERO_ADDRESS
  const awaitingFirstBid = firstBidTime === 0n || bidder === ZERO_ADDRESS
  const nowSec = useNowSec()
  const ended = !awaitingFirstBid && endTime > 0n && BigInt(nowSec) >= endTime

  const refetchAll = useCallback(() => {
    auctionRead.refetch()
    minBidRead.refetch()
  }, [auctionRead, minBidRead])

  // Per-auction event watchers — keep on-chain state in sync without waiting
  // for the polling interval. Filtered by auctionId so the watcher only fires
  // for this auction's events.
  useWatchContractEvent({
    address: houseAddress,
    abi: sovereignAuctionHouseAbi,
    eventName: "AuctionBid",
    args: { auctionId: BigInt(auctionId) },
    onLogs: () => {
      refetchAll()
      refreshAuctions().then(() => router.refresh())
    },
    pollingInterval: 10_000,
  })
  useWatchContractEvent({
    address: houseAddress,
    abi: sovereignAuctionHouseAbi,
    eventName: "AuctionEndTimeUpdated",
    args: { auctionId: BigInt(auctionId) },
    onLogs: refetchAll,
    // Sniping-critical event — poll faster than the others.
    pollingInterval: 5_000,
  })
  useWatchContractEvent({
    address: houseAddress,
    abi: sovereignAuctionHouseAbi,
    eventName: "AuctionEnded",
    args: { auctionId: BigInt(auctionId) },
    onLogs: () => {
      refetchAll()
      refreshAuctions().then(() => router.refresh())
    },
    pollingInterval: 10_000,
  })
  useWatchContractEvent({
    address: houseAddress,
    abi: sovereignAuctionHouseAbi,
    eventName: "AuctionCanceled",
    args: { auctionId: BigInt(auctionId) },
    onLogs: () => {
      refetchAll()
      refreshAuctions().then(() => router.refresh())
    },
    pollingInterval: 10_000,
  })

  const { writeContract, data: txHash, isPending, error: writeError } =
    useWriteContract()
  const { isLoading: confirming, isSuccess: confirmed } =
    useWaitForTransactionReceipt({ hash: txHash })

  useEffect(() => {
    if (confirmed) {
      refetchAll()
      // Invalidate the server-cached auction list + bid history before
      // forcing a re-render, otherwise router.refresh() would just re-fetch
      // the (still-fresh) 10-min cache and miss the new bid.
      refreshAuctions().then(() => router.refresh())
    }
  }, [confirmed]) // eslint-disable-line react-hooks/exhaustive-deps

  if (isCancelled) {
    return (
      <Panel statusDot="bg-gray-400" statusLabel="Cancelled">
        <p className="text-[11px] font-mono text-gray-500">
          This auction was cancelled.
        </p>
      </Panel>
    )
  }

  if (ended) {
    return (
      <Panel statusDot="bg-status-upcoming" statusLabel="Awaiting settlement">
        <PriceRow
          label="Final bid"
          amountWei={amount}
          subtext={
            bidder !== ZERO_ADDRESS
              ? `by ${displayFor(bidder, ensMap)}`
              : undefined
          }
        />
        <SettleButton
          houseAddress={houseAddress}
          auctionId={auctionId}
          isConnected={isConnected}
          isPending={isPending}
          confirming={confirming}
          writeContract={writeContract}
        />
        {writeError ? <ErrorLine error={writeError} /> : null}
      </Panel>
    )
  }

  const remainingSec = Number(endTime) - nowSec
  const showBidder = !awaitingFirstBid && bidder !== ZERO_ADDRESS

  return (
    <Panel
      statusDot={awaitingFirstBid ? "bg-status-upcoming" : "bg-status-live"}
      statusLabel={awaitingFirstBid ? "Awaiting first bid" : "Live auction"}
      rightLabel={!awaitingFirstBid && remainingSec > 0 ? "Time left" : undefined}
      rightValue={
        !awaitingFirstBid && remainingSec > 0 ? (
          <CountdownLabel target={Number(endTime)} />
        ) : undefined
      }
    >
      <PriceRow
        label={awaitingFirstBid ? "Reserve price" : "Current bid"}
        amountWei={awaitingFirstBid ? reservePrice : amount}
        subtext={
          showBidder ? `by ${displayFor(bidder, ensMap)}` : undefined
        }
      />
      <BidInput
        houseAddress={houseAddress}
        auctionId={auctionId}
        minBidWei={minBidWei}
        isConnected={isConnected}
        connected={connected}
        isPending={isPending}
        confirming={confirming}
        writeContract={writeContract}
      />
      {writeError ? <ErrorLine error={writeError} /> : null}
    </Panel>
  )
}

function Panel({
  statusDot,
  statusLabel,
  rightLabel,
  rightValue,
  children,
}: {
  statusDot: string
  statusLabel: string
  rightLabel?: string
  rightValue?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-surface overflow-hidden">
      <div className="p-5 space-y-5">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusDot}`} />
            <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
              {statusLabel}
            </span>
          </div>
          {rightLabel ? (
            <div className="text-right space-y-1">
              <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400">
                {rightLabel}
              </p>
              <p className="text-sm font-mono tabular-nums leading-none text-gray-500">
                {rightValue}
              </p>
            </div>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  )
}

function PriceRow({
  label,
  amountWei,
  subtext,
}: {
  label: string
  amountWei: bigint
  subtext?: string
}) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400">
        {label}
      </p>
      <p className="text-2xl font-mono font-medium tabular-nums tracking-tight leading-none">
        {formatEth(amountWei.toString())}{" "}
        <span className="text-sm font-mono text-gray-500">ETH</span>
      </p>
      {subtext ? (
        <p className="text-[11px] font-mono text-gray-500 pt-1">{subtext}</p>
      ) : null}
    </div>
  )
}

function ErrorLine({ error }: { error: Error }) {
  const msg = extractErrorMessage(error)
  return (
    <p className="text-[11px] font-mono text-status-sold" role="alert">
      {msg || "Transaction failed."}
    </p>
  )
}

type WriteContractFn = ReturnType<typeof useWriteContract>["writeContract"]

function BidInput({
  houseAddress,
  auctionId,
  minBidWei,
  isConnected,
  connected,
  isPending,
  confirming,
  writeContract,
}: {
  houseAddress: Address
  auctionId: string
  minBidWei: bigint
  isConnected: boolean
  connected?: Address
  isPending: boolean
  confirming: boolean
  writeContract: WriteContractFn
}) {
  const minEth = useMemo(() => formatEther(minBidWei), [minBidWei])
  const [value, setValue] = useState(minEth)
  useEffect(() => {
    setValue(minEth)
  }, [minEth])

  const parsed = useMemo(() => {
    try {
      return parseEther(value as `${number}`)
    } catch {
      return 0n
    }
  }, [value])
  const tooLow = parsed < minBidWei

  const balanceQuery = useBalance({
    address: connected,
    query: { enabled: Boolean(connected), refetchInterval: 12_000 },
  })
  const balanceWei = balanceQuery.data?.value ?? 0n
  const balanceLoaded = balanceQuery.isSuccess
  // Reserve a gas allowance so the user doesn't have to babysit a tx that
  // would have just-enough ETH for the bid but fail on gas.
  const usableBalance =
    balanceWei > GAS_RESERVE_WEI ? balanceWei - GAS_RESERVE_WEI : 0n
  const insufficient = balanceLoaded && parsed > usableBalance

  // Pre-flight the bid before the user pays gas. Catches reverts from stale
  // state (auction extended, ended, cancelled, someone else bid above us, etc.)
  // before the user submits.
  const bidSim = useSimulateContract({
    address: houseAddress,
    abi: sovereignAuctionHouseAbi,
    functionName: "createBid",
    args: [BigInt(auctionId)],
    value: parsed,
    query: {
      enabled: Boolean(connected) && !tooLow && !insufficient,
    },
  })
  const simErrorMsg = extractErrorMessage(bidSim.error)

  const presets = useMemo(
    () => [
      { label: "Min", wei: minBidWei },
      { label: "+10%", wei: (minBidWei * 110n) / 100n },
      { label: "+25%", wei: (minBidWei * 125n) / 100n },
      { label: "+50%", wei: (minBidWei * 150n) / 100n },
    ],
    [minBidWei],
  )

  function submit() {
    if (!bidSim.data) return
    writeContract(bidSim.data.request)
  }

  if (!isConnected || !connected) {
    return (
      <div className="pt-2">
        <RKConnectButton.Custom>
          {({ openConnectModal }) => (
            <button
              type="button"
              onClick={openConnectModal}
              className="block w-full text-center text-sm font-medium py-3 bg-fg text-bg hover:opacity-80 transition-opacity"
            >
              Connect wallet to bid
            </button>
          )}
        </RKConnectButton.Custom>
      </div>
    )
  }

  return (
    <div className="pt-2 space-y-3">
      <div className="flex gap-1.5">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setValue(stripTrailingZeros(formatEther(p.wei)))}
            className="flex-1 px-2 py-1.5 font-mono text-[10px] uppercase tracking-wider border border-gray-200 hover:border-gray-400 transition-colors"
            aria-label={`Set bid to ${p.label}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 rounded-md border border-gray-200 bg-bg px-3 py-2 focus-within:border-gray-400 transition-colors">
        <input
          type="number"
          inputMode="decimal"
          step="0.001"
          min={minEth}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1 bg-transparent font-mono text-base outline-none tabular-nums"
          aria-label="Bid amount in ETH"
        />
        <span className="font-mono text-xs text-gray-500">ETH</span>
      </label>
      {balanceLoaded ? (
        <p className="text-[10px] font-mono text-gray-500 leading-relaxed">
          Bid: <span className="tabular-nums">{formatEth(parsed.toString())}</span> ETH · Gas reserve:{" "}
          <span className="tabular-nums">{formatEth(GAS_RESERVE_WEI.toString())}</span> ETH · Available:{" "}
          <span className="tabular-nums">{formatEth(usableBalance.toString())}</span> ETH
        </p>
      ) : null}
      {simErrorMsg && !tooLow && !insufficient ? (
        <p className="text-[11px] font-mono text-status-sold" role="alert">
          {simErrorMsg}
        </p>
      ) : null}
      <button
        type="button"
        onClick={submit}
        disabled={
          tooLow ||
          insufficient ||
          isPending ||
          confirming ||
          !bidSim.data ||
          Boolean(simErrorMsg)
        }
        className="block w-full text-center text-sm font-medium py-3 bg-fg text-bg disabled:cursor-not-allowed disabled:opacity-60 hover:opacity-80 transition-opacity"
      >
        {confirming
          ? "Waiting for confirmation…"
          : isPending
            ? "Confirm in wallet…"
            : tooLow
              ? `Min bid ${formatEth(minBidWei.toString())} ETH`
              : insufficient
                ? `Insufficient · ${formatEth(usableBalance.toString())} ETH usable`
                : bidSim.isFetching
                  ? "Checking…"
                  : "Place bid"}
      </button>
    </div>
  )
}

function SettleButton({
  houseAddress,
  auctionId,
  isConnected,
  isPending,
  confirming,
  writeContract,
}: {
  houseAddress: Address
  auctionId: string
  isConnected: boolean
  isPending: boolean
  confirming: boolean
  writeContract: WriteContractFn
}) {
  const settleSim = useSimulateContract({
    address: houseAddress,
    abi: sovereignAuctionHouseAbi,
    functionName: "endAuction",
    args: [BigInt(auctionId)],
    query: { enabled: isConnected },
  })
  const simErrorMsg = extractErrorMessage(settleSim.error)

  if (!isConnected) {
    return (
      <div className="pt-2">
        <RKConnectButton.Custom>
          {({ openConnectModal }) => (
            <button
              type="button"
              onClick={openConnectModal}
              className="block w-full text-center text-sm font-medium py-3 bg-fg text-bg hover:opacity-80 transition-opacity"
            >
              Connect wallet to settle
            </button>
          )}
        </RKConnectButton.Custom>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => {
          if (!settleSim.data) return
          writeContract(settleSim.data.request)
        }}
        disabled={isPending || confirming || !settleSim.data || Boolean(simErrorMsg)}
        className="mt-2 block w-full text-center text-sm font-medium py-3 bg-fg text-bg disabled:cursor-not-allowed disabled:opacity-60 hover:opacity-80 transition-opacity"
      >
        {confirming
          ? "Waiting for confirmation…"
          : isPending
            ? "Confirm in wallet…"
            : settleSim.isFetching
              ? "Checking…"
              : "Settle auction"}
      </button>
      {simErrorMsg ? (
        <p className="text-[11px] font-mono text-status-sold" role="alert">
          {simErrorMsg}
        </p>
      ) : null}
    </div>
  )
}

function CountdownLabel({ target }: { target: number }) {
  const now = useNowSec()
  const remaining = Math.max(0, target - now)
  const d = Math.floor(remaining / 86400)
  const h = Math.floor((remaining % 86400) / 3600)
  const m = Math.floor((remaining % 3600) / 60)
  const s = remaining % 60
  if (remaining === 0) return <>Ended</>
  if (d > 0) return <>{`${d}d ${h}h ${m}m`}</>
  if (h > 0) return <>{`${h}h ${m}m ${s}s`}</>
  return <>{`${m}m ${s}s`}</>
}

function useNowSec(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

/**
 * Pull a compact display string out of a viem-flavored error. viem populates
 * `shortMessage` on its error classes and falls back to the first line of
 * `message` for upstream Error instances.
 */
function extractErrorMessage(error: unknown): string | null {
  if (!error) return null
  const e = error as Error & { shortMessage?: string }
  if (e.shortMessage) return e.shortMessage
  if (typeof e.message === "string") return e.message.split("\n")[0]
  return String(error)
}

function stripTrailingZeros(eth: string): string {
  if (!eth.includes(".")) return eth
  const [whole, frac] = eth.split(".")
  const trimmed = frac.replace(/0+$/, "")
  return trimmed ? `${whole}.${trimmed}` : whole
}
