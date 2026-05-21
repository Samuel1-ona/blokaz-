import { useCallback, useEffect, useRef, useState } from 'react'
import { useAccount, useBalance, useWalletClient } from 'wagmi'
import { encodeFunctionData } from 'viem'
import {
  GAME_TREASURY,
  STABLECOIN_TOKENS,
  type StablecoinSymbol,
} from '../constants/contracts'
import { useGameStore } from '../stores/gameStore'
import { isMiniPay } from '../utils/miniPay'

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

  const { data: usdcBal } = useBalance({
    address,
    token: STABLECOIN_TOKENS.USDC.address,
    query: { enabled: !!address },
  })
  const { data: usdtBal } = useBalance({
    address,
    token: STABLECOIN_TOKENS.USDT.address,
    query: { enabled: !!address },
  })
  const { data: usdmBal } = useBalance({
    address,
    token: STABLECOIN_TOKENS.USDm.address,
    query: { enabled: !!address },
  })

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
      if (!address || !walletRef.current || isPayingRef.current) return false
      isPayingRef.current = true
      setIsPaying(true)
      setError(null)
      try {
        const token = STABLECOIN_TOKENS[sym]
        // Use sendTransaction directly to bypass wagmi's eth_call simulation,
        // which throws UnknownRpcError on MiniPay's injected provider.
        await walletRef.current.sendTransaction({
          to: token.address,
          data: encodeFunctionData({
            abi: ERC20_TRANSFER_ABI,
            functionName: 'transfer',
            args: [GAME_TREASURY, getReviveCost(sym)],
          }),
          // MiniPay requires legacy txs and an explicit gas limit so it never
          // calls eth_estimateGas (which it also doesn't support in sandbox).
          ...(isMiniPay() ? { type: 'legacy' as const, gas: 100_000n } : {}),
        })
        reviveGame()
        return true
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Transaction failed'
        setError(msg.length > 80 ? msg.slice(0, 80) + '…' : msg)
        return false
      } finally {
        isPayingRef.current = false
        setIsPaying(false)
      }
    },
    [address, reviveGame, getReviveCost]
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
