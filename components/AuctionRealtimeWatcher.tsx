"use client"

import { useCallback } from "react"
import { type Address } from "viem"
import { useRouter } from "next/navigation"
import { useWatchContractEvent } from "wagmi"
import { sovereignAuctionHouseAbi } from "@/lib/abi"
import { refreshAuctions } from "@/app/actions"

/**
 * Listens for every event on the artist's auction house and invalidates the
 * server-cached auction list + bid history on each. Combined with
 * `router.refresh()`, this makes the gallery feel live without manual
 * reloads — a new bid, a settle, a new auction creation, or anti-sniping
 * extensions all surface within a few seconds.
 *
 * RPC cost: 5 polled subscriptions at 10s each = 0.5 eth_getLogs/sec per
 * visitor on /art. Modest enough for public RPCs to handle.
 */
export function AuctionRealtimeWatcher({ houseAddress }: { houseAddress: Address }) {
  const router = useRouter()

  const refresh = useCallback(() => {
    refreshAuctions().then(() => router.refresh())
  }, [router])

  useWatchContractEvent({
    address: houseAddress,
    abi: sovereignAuctionHouseAbi,
    eventName: "AuctionCreated",
    onLogs: refresh,
    pollingInterval: 10_000,
  })
  useWatchContractEvent({
    address: houseAddress,
    abi: sovereignAuctionHouseAbi,
    eventName: "AuctionBid",
    onLogs: refresh,
    pollingInterval: 10_000,
  })
  useWatchContractEvent({
    address: houseAddress,
    abi: sovereignAuctionHouseAbi,
    eventName: "AuctionEnded",
    onLogs: refresh,
    pollingInterval: 10_000,
  })
  useWatchContractEvent({
    address: houseAddress,
    abi: sovereignAuctionHouseAbi,
    eventName: "AuctionCanceled",
    onLogs: refresh,
    pollingInterval: 10_000,
  })
  useWatchContractEvent({
    address: houseAddress,
    abi: sovereignAuctionHouseAbi,
    eventName: "AuctionEndTimeUpdated",
    onLogs: refresh,
    pollingInterval: 10_000,
  })

  return null
}
