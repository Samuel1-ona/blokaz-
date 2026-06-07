import { useCallback, useEffect, useRef, useState } from 'react'
import { useAccount, useBalance, usePublicClient, useWalletClient } from 'wagmi'
import { encodeFunctionData } from 'viem'
import {
  GAME_TREASURY,
  STABLECOIN_TOKENS,
  type StablecoinSymbol,
} from '../constants/contracts'
import { usePowerUpStore, type PowerUpId } from '../stores/powerUpStore'
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

// $0.10 cost per item — same structure as reviveCost
function shopCost(sym: StablecoinSymbol): bigint {
  return STABLECOIN_TOKENS[sym].reviveCost
}

export function useStablecoinShop() {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const walletRef = useRef(walletClient)
  useEffect(() => { walletRef.current = walletClient }, [walletClient])

  const { addInventory } = usePowerUpStore()

  const [isPaying, setIsPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isPayingRef = useRef(false)

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
    (sym: StablecoinSymbol) => balances[sym] >= shopCost(sym),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [balances.USDC, balances.USDT, balances.USDm]
  )

  const defaultToken: StablecoinSymbol =
    (Object.keys(STABLECOIN_TOKENS) as StablecoinSymbol[]).sort((a, b) => {
      const aUsd = Number(balances[a]) / 10 ** STABLECOIN_TOKENS[a].decimals
      const bUsd = Number(balances[b]) / 10 ** STABLECOIN_TOKENS[b].decimals
      return bUsd - aUsd
    })[0] as StablecoinSymbol ?? 'USDC'

  const hasAnyBalance = (Object.keys(STABLECOIN_TOKENS) as StablecoinSymbol[]).some(canAfford)

  // qty = number of units bought (1 revivalBundle = 3 revival credits)
  const purchase = useCallback(
    async (
      itemId: PowerUpId | 'revivalBundle',
      sym: StablecoinSymbol
    ): Promise<boolean> => {
      if (!address || isPayingRef.current) return false
      isPayingRef.current = true
      setIsPaying(true)
      setError(null)
      try {
        const token = STABLECOIN_TOKENS[sym]
        const cost = shopCost(sym)
        const data = encodeFunctionData({
          abi: ERC20_TRANSFER_ABI,
          functionName: 'transfer',
          args: [GAME_TREASURY, cost],
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
        // Grant the item: revivalBundle = 3 revival credits, others = 1 use
        const qty = itemId === 'revivalBundle' ? 3 : 1
        addInventory(itemId, qty)
        // Log the confirmed purchase to the server (permanent receipt + server inventory credit)
        logPurchase(address, itemId, qty, sym, txHash)
        return true
      } catch (err: any) {
        console.error('Shop tx error:', err)
        const msg = err?.message || err?.data?.message || (typeof err === 'string' ? err : 'Transaction failed')
        setError(msg.length > 80 ? msg.slice(0, 80) + '…' : msg)
        return false
      } finally {
        isPayingRef.current = false
        setIsPaying(false)
      }
    },
    [address, publicClient, addInventory, refetchBalances]
  )

  return {
    balances,
    canAfford,
    hasAnyBalance,
    defaultToken,
    isPaying,
    error,
    purchase,
    shopCost,
  }
}
