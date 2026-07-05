import { useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
import { usePowerUpStore } from '../stores/powerUpStore'
import type { PowerUpId } from '../stores/powerUpStore'

const SERVER_URL = import.meta.env.VITE_SIGNER_URL ?? 'http://localhost:3001'
const SYNC_DEBOUNCE_MS = 2_000
const PENDING_PURCHASES_KEY = 'blokaz:pending_purchases'

interface PendingPurchase {
  address: string
  itemId: string
  quantity: number
  tokenSymbol: string
  txHash: string
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 8_000,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function serverPost(path: string, body: object): Promise<any> {
  try {
    const res = await fetchWithTimeout(
      `${SERVER_URL}${path}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      8_000,
    )
    return res.ok ? res.json() : null
  } catch {
    return null
  }
}

async function serverGet(path: string, timeoutMs = 5_000): Promise<any> {
  try {
    const res = await fetchWithTimeout(`${SERVER_URL}${path}`, {}, timeoutMs)
    return res.ok ? res.json() : null
  } catch {
    return null
  }
}

// Retries on failure — used for purchase receipts where losing the record
// has a real cost to the player.
async function postWithRetry(path: string, body: object, retries = 3): Promise<void> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetchWithTimeout(
        `${SERVER_URL}${path}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
        8_000,
      )
      if (res.ok || res.status === 409) return // 409 = already processed
    } catch {
      // Timeout or network error
    }
    if (attempt < retries - 1) await new Promise(r => setTimeout(r, 1_500 * (attempt + 1)))
  }
}

export async function restoreInventoryFromServer(address: string): Promise<void> {
  // 5 s timeout — inventory restore should not block the UI on slow networks
  const data = await serverGet(`/inventory/${address.toLowerCase()}`, 5_000)
  if (!data?.inventory) return

  const store = usePowerUpStore.getState()
  const localInv = store.inventory
  const localFt = store.freeTries

  const mergedInv = {
    revivalBundle: Math.max(localInv.revivalBundle, data.inventory.revivalBundle ?? 0),
    scoreBoost:    Math.max(localInv.scoreBoost,    data.inventory.scoreBoost    ?? 0),
    shield:        Math.max(localInv.shield,         data.inventory.shield        ?? 0),
    bomb:          Math.max(localInv.bomb,           data.inventory.bomb          ?? 0),
    rotatePass:    Math.max(localInv.rotatePass,     data.inventory.rotatePass    ?? 0),
  }
  // freeTries are consumed (decremented) locally — use Math.min so a stale
  // server value (not yet synced after a use) never restores a consumed try.
  const mergedFt = {
    scoreBoost: Math.min(localFt.scoreBoost, data.freeTries?.scoreBoost ?? localFt.scoreBoost),
    shield:     Math.min(localFt.shield,     data.freeTries?.shield     ?? localFt.shield),
    bomb:       Math.min(localFt.bomb,       data.freeTries?.bomb       ?? localFt.bomb),
    rotatePass: Math.min(localFt.rotatePass, data.freeTries?.rotatePass ?? localFt.rotatePass),
  }

  const invChanged = (Object.keys(mergedInv) as (keyof typeof mergedInv)[])
    .some(k => mergedInv[k] !== localInv[k])
  const ftChanged = (Object.keys(mergedFt) as (keyof typeof mergedFt)[])
    .some(k => mergedFt[k] !== localFt[k])

  if (invChanged || ftChanged) {
    usePowerUpStore.setState({ inventory: mergedInv, freeTries: mergedFt })
    if (store.currentAddress) {
      try {
        localStorage.setItem(`blokaz:inv:${store.currentAddress}`, JSON.stringify(mergedInv))
        localStorage.setItem(`blokaz:ft:${store.currentAddress}`, JSON.stringify(mergedFt))
      } catch {}
    }
  }
}

function loadPendingPurchases(): PendingPurchase[] {
  try {
    const raw = localStorage.getItem(PENDING_PURCHASES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function savePendingPurchases(queue: PendingPurchase[]): void {
  try {
    if (queue.length === 0) localStorage.removeItem(PENDING_PURCHASES_KEY)
    else localStorage.setItem(PENDING_PURCHASES_KEY, JSON.stringify(queue))
  } catch {}
}

async function flushPendingPurchases(): Promise<void> {
  const queue = loadPendingPurchases()
  if (!queue.length) return
  const remaining: PendingPurchase[] = []
  for (const p of queue) {
    try {
      const res = await fetchWithTimeout(
        `${SERVER_URL}/inventory/purchase`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) },
        8_000,
      )
      if (!res.ok && res.status !== 409) remaining.push(p)
    } catch {
      remaining.push(p)
    }
  }
  savePendingPurchases(remaining)
}

/**
 * Logs a confirmed purchase to the server with retry.
 * The on-chain tx is already permanent — this is the server-side receipt.
 * Retries 3× with back-off. If all retries fail (offline), queues to
 * localStorage so it's flushed the next time the network comes back.
 */
export async function logPurchase(
  address: string,
  // 'revive' is a log-only receipt for a consumed single revive; bundle ids
  // (e.g. 'starterPack') pass through as plain strings.
  itemId: PowerUpId | 'revivalBundle' | 'revive' | string,
  quantity: number,
  tokenSymbol: string,
  txHash: string,
): Promise<void> {
  const body = { address, itemId, quantity, tokenSymbol, txHash }
  let succeeded = false
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetchWithTimeout(
        `${SERVER_URL}/inventory/purchase`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
        8_000,
      )
      if (res.ok || res.status === 409) { succeeded = true; break }
    } catch {}
    if (attempt < 2) await new Promise(r => setTimeout(r, 1_500 * (attempt + 1)))
  }
  if (!succeeded) {
    const queue = loadPendingPurchases()
    queue.push(body)
    savePendingPurchases(queue)
  }
}

export function syncInventoryToServer(address: string): void {
  const { inventory, freeTries } = usePowerUpStore.getState()
  serverPost('/inventory/sync', { address, inventory, freeTries })
}

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

  // When network is restored, push the current inventory to the server and
  // flush any purchase receipts that failed while the player was offline.
  useEffect(() => {
    if (!address) return
    const handleOnline = () => {
      syncInventoryToServer(address)
      flushPendingPurchases()
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [address])
}
