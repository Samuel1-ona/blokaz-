import { useCallback, useEffect, useRef, useState } from 'react'
import { useAccount, useBalance, usePublicClient, useWalletClient } from 'wagmi'
import { encodeFunctionData } from 'viem'
import {
  GAME_TREASURY,
  STABLECOIN_TOKENS,
  type StablecoinSymbol,
} from '../constants/contracts'
import { useGameStore } from '../stores/gameStore'
import { isMiniPay } from '../utils/miniPay'
import { logPurchase } from './useInventorySync'

const ERC20_TRANSFER_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const

export function isMiniPayBrowser(): boolean {
  try {
    return (window as any).ethereum?.isMiniPay === true
  } catch {
    return false
  }
}

export function useStablecoinRevive() {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { reviveGame, reviveCount } = useGameStore()
  const { data: walletClient } = useWalletClient()
  const walletRef = useRef(walletClient)
  useEffect(() => { walletRef.current = walletClient }, [walletClient])

  const [isPaying, setIsPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isPayingRef = useRef(false)

  // Fixed fee of $0.10 regardless of how many times the player has revived
  const getReviveCost = useCallback(
    (sym: StablecoinSymbol): bigint => STABLECOIN_TOKENS[sym].reviveCost,
    []
  )

  const { data: usdcBal, refetch: refetchUsdc } = useBalance({
    address,
    token: STABLECOIN_TOKENS.USDC.address,
    query: { enabled: !!address },
  })
  const { data: usdtBal, refetch: refetchUsdt } = useBalance({
    address,
    token: STABLECOIN_TOKENS.USDT.address,
    query: { enabled: !!address },
  })
  const { data: usdmBal, refetch: refetchUsdm } = useBalance({
    address,
    token: STABLECOIN_TOKENS.USDm.address,
    query: { enabled: !!address },
  })

  const refetchBalances = useCallback(() => {
    refetchUsdc()
    refetchUsdt()
    refetchUsdm()
  }, [refetchUsdc, refetchUsdt, refetchUsdm])

  const balances: Record<StablecoinSymbol, bigint> = {
    USDC: usdcBal?.value ?? 0n,
    USDT: usdtBal?.value ?? 0n,
    USDm: usdmBal?.value ?? 0n,
  }

  const canAfford = useCallback(
    (sym: StablecoinSymbol) => balances[sym] >= getReviveCost(sym),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [balances.USDC, balances.USDT, balances.USDm, getReviveCost]
  )

  // Token the user holds the most of (by USD value) — MiniPay requirement
  const defaultToken: StablecoinSymbol =
    (Object.keys(STABLECOIN_TOKENS) as StablecoinSymbol[]).sort((a, b) => {
      const aUsd = Number(balances[a as StablecoinSymbol]) / 10 ** STABLECOIN_TOKENS[a as StablecoinSymbol].decimals
      const bUsd = Number(balances[b as StablecoinSymbol]) / 10 ** STABLECOIN_TOKENS[b as StablecoinSymbol].decimals
      return bUsd - aUsd
    })[0] as StablecoinSymbol ?? 'USDC'

  const hasAnyBalance = (Object.keys(STABLECOIN_TOKENS) as StablecoinSymbol[]).some(canAfford)

  const payForRevive = useCallback(
    async (sym: StablecoinSymbol): Promise<boolean> => {
      if (!address || isPayingRef.current) return false
      isPayingRef.current = true
      setIsPaying(true)
      setError(null)
      try {
        const token = STABLECOIN_TOKENS[sym]
        const data = encodeFunctionData({
          abi: ERC20_TRANSFER_ABI,
          functionName: 'transfer',
          args: [GAME_TREASURY, getReviveCost(sym)],
        })

        let txHash: `0x${string}`
        if (isMiniPay()) {
          // Bypass viem entirely — viem's prepareTransactionRequest on the Celo
          // chain tries CIP-42 (maxFeePerGas) or calls eth_estimateGas with Celo
          // specific params that MiniPay's injected provider rejects with RpcError.
          // Raw eth_accounts + eth_sendTransaction with explicit gas skips all of
          // that. MiniPay handles nonce, gas price, and signing internally.
          const accounts: string[] = await (window.ethereum as any).request({
            method: 'eth_accounts',
          })
          txHash = await (window.ethereum as any).request({
            method: 'eth_sendTransaction',
            params: [{
              from: accounts[0],
              to: token.address,
              data,
              gas: '0x493E0', // 300 000 — sufficient for ERC-20 transfer
            }],
          })
        } else {
          if (!walletRef.current) throw new Error('Wallet not connected')
          txHash = await walletRef.current.sendTransaction({ to: token.address, data })
        }

        // Wait for the tx to be mined before refreshing so the on-chain balance
        // has actually changed when wagmi queries it.
        if (publicClient) await publicClient.waitForTransactionReceipt({ hash: txHash })
        refetchBalances()
        // Log the confirmed purchase to the server (permanent receipt)
        logPurchase(address, 'revivalBundle', 3, sym, txHash)
        reviveGame()
        return true
      } catch (err: any) {
        console.error('Revive tx error:', err)
        const msg =
          err?.message ||
          err?.data?.message ||
          (typeof err === 'string' ? err : 'Transaction failed')
        setError(msg.length > 80 ? msg.slice(0, 80) + '…' : msg)
        return false
      } finally {
        isPayingRef.current = false
        setIsPaying(false)
      }
    },
    [address, publicClient, reviveGame, getReviveCost, refetchBalances]
  )

  return {
    balances,
    canAfford,
    hasAnyBalance,
    defaultToken,
    isPaying,
    error,
    payForRevive,
    getReviveCost,
    reviveCount,
  }
}
