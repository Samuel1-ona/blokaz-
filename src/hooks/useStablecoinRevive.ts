import { useCallback, useEffect, useRef, useState } from 'react'
import { useAccount, useBalance, useWriteContract } from 'wagmi'
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
  const { reviveGame } = useGameStore()
  const { writeContractAsync } = useWriteContract()
  const writeRef = useRef(writeContractAsync)
  useEffect(() => { writeRef.current = writeContractAsync }, [writeContractAsync])

  const [isPaying, setIsPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isPayingRef = useRef(false)

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
    (sym: StablecoinSymbol) => balances[sym] >= STABLECOIN_TOKENS[sym].reviveCost,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [balances.USDC, balances.USDT, balances.USDm]
  )

  // First affordable token (USDC preferred on MiniPay)
  const defaultToken: StablecoinSymbol =
    (Object.keys(STABLECOIN_TOKENS) as StablecoinSymbol[]).find(canAfford) ?? 'USDC'

  const hasAnyBalance = (Object.keys(STABLECOIN_TOKENS) as StablecoinSymbol[]).some(canAfford)

  const payForRevive = useCallback(
    async (sym: StablecoinSymbol): Promise<boolean> => {
      if (!address || isPayingRef.current) return false
      isPayingRef.current = true
      setIsPaying(true)
      setError(null)
      try {
        const token = STABLECOIN_TOKENS[sym]
        const txOverrides = isMiniPay()
          ? { type: 'legacy' as const }
          : {}
        await writeRef.current({
          address: token.address,
          abi: ERC20_TRANSFER_ABI,
          functionName: 'transfer',
          args: [GAME_TREASURY, token.reviveCost],
          ...txOverrides,
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
    [address, reviveGame]
  )

  return {
    balances,
    canAfford,
    hasAnyBalance,
    defaultToken,
    isPaying,
    error,
    payForRevive,
  }
}
