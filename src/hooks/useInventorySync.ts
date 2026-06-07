/**
 * Server sync for player inventory and purchase log.
 *
 * - On wallet connect: fetch server inventory and merge with localStorage
 *   (server wins if it has more items — protects against localStorage wipe)
 * - On every inventory change: push to server (debounced 2 s)
 * - On purchase: log the tx + credit server inventory immediately
 */
import { useEffect, useRef, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { usePowerUpStore } from '../stores/powerUpStore'
import type { PowerUpId } from '../stores/powerUpStore'

const SERVER_URL = import.meta.env.VITE_SIGNER_URL ?? 'http://localhost:3001'
const SYNC_DEBOUNCE_MS = 2_000

async function serverPost(path: string, body: object): Promise<any> {
  try {
    const res = await fetch(`${SERVER_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return res.ok ? res.json() : null
  } catch {
    return null
  }
}

async function serverGet(path: string): Promise<any> {
  try {
    const res = await fetch(`${SERVER_URL}${path}`)
    return res.ok ? res.json() : null
  } catch {
    return null
  }
}

/**
 * Fetches server inventory for an address and merges it into the local store.
 * Server wins when it has more items (it's the source of truth after a purchase).
 * localStorage wins when it has more free tries (prevents resetting free trials).
 */
export async function restoreInventoryFromServer(address: string): Promise<void> {
  const data = await serverGet(`/inventory/${address.toLowerCase()}`)
  if (!data?.inventory) return

  const store = usePowerUpStore.getState()
  const localInv = store.inventory
  const localFt = store.freeTries

  // Merge: take the max of server vs local for each field
  const mergedInv = {
    revivalBundle: Math.max(localInv.revivalBundle, data.inventory.revivalBundle ?? 0),
    scoreBoost:    Math.max(localInv.scoreBoost,    data.inventory.scoreBoost    ?? 0),
    shield:        Math.max(localInv.shield,         data.inventory.shield        ?? 0),
    bomb:          Math.max(localInv.bomb,           data.inventory.bomb          ?? 0),
    rotatePass:    Math.max(localInv.rotatePass,     data.inventory.rotatePass    ?? 0),
  }
  const mergedFt = {
    scoreBoost: Math.max(localFt.scoreBoost, data.freeTries?.scoreBoost ?? 0),
    shield:     Math.max(localFt.shield,     data.freeTries?.shield     ?? 0),
    bomb:       Math.max(localFt.bomb,       data.freeTries?.bomb       ?? 0),
    rotatePass: Math.max(localFt.rotatePass, data.freeTries?.rotatePass ?? 0),
  }

  // Only update the store if the server had something better
  const invChanged = (Object.keys(mergedInv) as (keyof typeof mergedInv)[])
    .some(k => mergedInv[k] !== localInv[k])
  const ftChanged = (Object.keys(mergedFt) as (keyof typeof mergedFt)[])
    .some(k => mergedFt[k] !== localFt[k])

  if (invChanged || ftChanged) {
    usePowerUpStore.setState({ inventory: mergedInv, freeTries: mergedFt })
    // Persist the merged state back to localStorage
    if (store.currentAddress) {
      try {
        localStorage.setItem(`blokaz:inv:${store.currentAddress}`, JSON.stringify(mergedInv))
        localStorage.setItem(`blokaz:ft:${store.currentAddress}`, JSON.stringify(mergedFt))
      } catch {}
    }
  }
}

/**
 * Logs a confirmed purchase to the server and credits the inventory.
 * Call this after waitForTransactionReceipt resolves.
 */
export async function logPurchase(
  address: string,
  itemId: PowerUpId | 'revivalBundle',
  quantity: number,
  tokenSymbol: string,
  txHash: string,
): Promise<void> {
  await serverPost('/inventory/purchase', { address, itemId, quantity, tokenSymbol, txHash })
}

/**
 * Pushes the current inventory + free tries to the server.
 * Exported so it can be called directly after a consume/activate.
 */
export function syncInventoryToServer(address: string): void {
  const { inventory, freeTries } = usePowerUpStore.getState()
  serverPost('/inventory/sync', { address, inventory, freeTries })
}

/**
 * Hook — mounts in the main app shell (not just during a game).
 * Restores inventory from server on connect, syncs changes back debounced.
 */
export function useInventorySync() {
  const { address } = useAccount()
  const inventory = usePowerUpStore((s) => s.inventory)
  const freeTries = usePowerUpStore((s) => s.freeTries)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const restoredRef = useRef<string | null>(null)

  // Restore from server once per wallet connection
  useEffect(() => {
    if (!address || restoredRef.current === address) return
    restoredRef.current = address
    restoreInventoryFromServer(address)
  }, [address])

  // Debounced push on every inventory / freeTries change
  useEffect(() => {
    if (!address) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      syncInventoryToServer(address)
    }, SYNC_DEBOUNCE_MS)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    address,
    inventory.revivalBundle, inventory.scoreBoost, inventory.shield,
    inventory.bomb, inventory.rotatePass,
    freeTries.scoreBoost, freeTries.shield, freeTries.bomb, freeTries.rotatePass,
  ])
}
