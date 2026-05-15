"use client"

import { useEffect } from "react"
import { type Address } from "viem"
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWatchContractEvent,
  useWriteContract,
} from "wagmi"
import { sovereignAuctionHouseAbi } from "@/lib/abi"
import { formatEth } from "@/lib/format"

/**
 * Outbid bidders aren't auto-refunded by the SovereignAuctionHouse — their ETH
 * is credited to `pendingRefunds[wallet]` and they must call `withdrawRefund()`
 * themselves. Without this banner, a user who gets outbid has no in-app signal
 * that their funds are locked in the contract.
 *
 * The banner only renders when the connected wallet has a positive balance.
 * It listens for `RefundCredited` / `RefundWithdrawn` events so the amount
 * stays in sync with on-chain reality without polling.
 */
export function PendingRefundsBanner({ houseAddress }: { houseAddress: Address }) {
  const { address: connected, isConnected } = useAccount()

  const refundRead = useReadContract({
    address: houseAddress,
    abi: sovereignAuctionHouseAbi,
    functionName: "pendingRefunds",
    args: connected ? [connected] : undefined,
    query: { enabled: Boolean(connected) },
  })

  // Refetch when the contract emits a refund event for this wallet — keeps the
  // banner in sync without polling.
  useWatchContractEvent({
    address: houseAddress,
    abi: sovereignAuctionHouseAbi,
    eventName: "RefundCredited",
    args: connected ? { to: connected } : undefined,
    onLogs: () => refundRead.refetch(),
    pollingInterval: 10_000,
  })
  useWatchContractEvent({
    address: houseAddress,
    abi: sovereignAuctionHouseAbi,
    eventName: "RefundWithdrawn",
    args: connected ? { to: connected } : undefined,
    onLogs: () => refundRead.refetch(),
    pollingInterval: 10_000,
  })

  const {
    writeContract,
    data: txHash,
    isPending,
    error: writeError,
  } = useWriteContract()
  const { isLoading: confirming, isSuccess: confirmed } =
    useWaitForTransactionReceipt({ hash: txHash })

  useEffect(() => {
    if (confirmed) refundRead.refetch()
  }, [confirmed]) // eslint-disable-line react-hooks/exhaustive-deps

  const amount = (refundRead.data as bigint | undefined) ?? 0n
  if (!isConnected || amount === 0n) return null

  return (
    <div className="border border-status-upcoming/40 bg-status-upcoming/5 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="space-y-1 min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-wider text-status-upcoming">
          Pending refund
        </p>
        <p className="font-mono text-sm text-fg">
          You have{" "}
          <strong className="font-medium tabular-nums">
            {formatEth(amount.toString())} ETH
          </strong>{" "}
          from outbids waiting in the auction contract.
        </p>
        {writeError ? (
          <p
            className="text-[11px] font-mono text-status-sold"
            role="alert"
          >
            {(writeError.message ?? "").split("\n")[0] || "Withdraw failed."}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() =>
          writeContract({
            address: houseAddress,
            abi: sovereignAuctionHouseAbi,
            functionName: "withdrawRefund",
          })
        }
        disabled={isPending || confirming}
        className="shrink-0 text-xs font-mono uppercase tracking-wider px-4 py-2 bg-fg text-bg disabled:cursor-not-allowed disabled:opacity-60 hover:opacity-80 transition-opacity"
      >
        {confirming
          ? "Withdrawing…"
          : isPending
            ? "Confirm in wallet…"
            : "Withdraw"}
      </button>
    </div>
  )
}
