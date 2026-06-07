import { useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
import { useGameStore } from '../stores/gameStore'

const SERVER_URL = import.meta.env.VITE_SIGNER_URL ?? 'http://localhost:3001'
const SYNC_DEBOUNCE_MS = 3_000

// Wraps fetch with an AbortController timeout.
// On a shaky mobile connection, fetch can hang indefinitely without this.
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

// Fire-and-forget POST. Failures are swallowed — localStorage is always
// the primary fallback, the server is an additional safety net.
async function post(path: string, body: object): Promise<void> {
  try {
    await fetchWithTimeout(
      `${SERVER_URL}${path}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      8_000,
    )
  } catch {
    // Network failure or timeout — silent, localStorage covers it
  }
}

// POST with up to `retries` attempts. Used for important receipts (purchases)
// where losing the server record has a real cost.
async function postWithRetry(path: string, body: object, retries = 3): Promise<void> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetchWithTimeout(
        `${SERVER_URL}${path}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
        8_000,
      )
      if (res.ok || res.status === 409) return // 409 = already processed, not an error
    } catch {
      // Timeout or network error — wait before retrying
    }
    if (attempt < retries - 1) await new Promise(r => setTimeout(r, 1_500 * (attempt + 1)))
  }
}

export function useMoveSync() {
  const { address } = useAccount()
  const score = useGameStore((s) => s.score)
  const isGameOver = useGameStore((s) => s.isGameOver)
  const reviveCount = useGameStore((s) => s.reviveCount)
  const onChainGameId = useGameStore((s) => s.onChainGameId)
  const onChainSeed = useGameStore((s) => s.onChainSeed)

  // Subscribe to game seed so the effect re-fires when a new game starts.
  const gameSeed = useGameStore((s) => s.gameSession?.seed?.toString() ?? null)

  const registeredSeedRef = useRef<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSyncedMoveCountRef = useRef(0)
  // Preserved even after forceReset() sets gameSession to null, so the
  // unmount flush can still send the final state to the server.
  const lastKnownSessionRef = useRef(useGameStore.getState().gameSession)

  // /session/start — fires when a new game session appears
  useEffect(() => {
    if (!address || !gameSeed || gameSeed === '0') return
    if (registeredSeedRef.current === gameSeed) return
    registeredSeedRef.current = gameSeed
    lastSyncedMoveCountRef.current = 0

    post('/session/start', {
      address,
      seed: gameSeed,
      onChainGameId: onChainGameId?.toString() ?? null,
      onChainSeed: onChainSeed ?? null,
    })
  }, [address, gameSeed, onChainGameId, onChainSeed])

  // Ref-based callback so the debounce closure always reads latest state.
  // Falls back to lastKnownSessionRef so the unmount flush still fires even
  // after forceReset() has set gameSession to null (e.g. back-to-lobby tap).
  const syncNowRef = useRef<() => void>(() => {})
  useEffect(() => {
    syncNowRef.current = () => {
      const storeState = useGameStore.getState()
      const session = storeState.gameSession ?? lastKnownSessionRef.current
      if (!session || !address) return
      // Update the preserved reference whenever we sync
      lastKnownSessionRef.current = session
      lastSyncedMoveCountRef.current = session.moveHistory.length
      post('/session/sync', {
        address,
        seed: session.seed.toString(),
        moveHistory: session.moveHistory,
        score: session.score,
        scoreBoostActive: session.scoreBoostActive,
        isGameOver,
        reviveCount,
        onChainGameId: onChainGameId?.toString() ?? null,
        onChainSeed: onChainSeed ?? null,
      })
    }
  }, [address, isGameOver, reviveCount, onChainGameId, onChainSeed])

  // Keep lastKnownSessionRef up to date whenever gameSession changes
  useEffect(() => {
    const session = useGameStore.getState().gameSession
    if (session) lastKnownSessionRef.current = session
  }, [gameSeed, score])

  // Debounced sync after every score change
  useEffect(() => {
    if (!address || !score) return
    const { gameSession } = useGameStore.getState()
    if (!gameSession || !gameSession.moveHistory.length) return

    const currentMoveCount = gameSession.moveHistory.length
    if (currentMoveCount === lastSyncedMoveCountRef.current) return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => syncNowRef.current(), SYNC_DEBOUNCE_MS)
  }, [score, address])

  // Flush pending sync immediately on unmount (navigation away mid-game).
  // Always fires — not gated on debounceRef — so a bomb or revival that
  // changed moveHistory but not yet scheduled a debounce still gets sent.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      syncNowRef.current()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When the network comes back, immediately push whatever localStorage has
  // to the server — closes the gap left by any failed syncs during offline play.
  useEffect(() => {
    const handleOnline = () => {
      const { gameSession, onChainGameId: gid, onChainSeed: gs } = useGameStore.getState()
      if (!address || !gameSession) return
      post('/session/sync', {
        address,
        seed: gameSession.seed.toString(),
        moveHistory: gameSession.moveHistory,
        score: gameSession.score,
        scoreBoostActive: gameSession.scoreBoostActive,
        isGameOver: gameSession.isGameOver,
        reviveCount: useGameStore.getState().reviveCount,
        onChainGameId: gid?.toString() ?? null,
        onChainSeed: gs ?? null,
      })
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [address])
}

/**
 * Fetches the latest active session from the server with a hard 5-second
 * timeout. If the server is down or the network is slow, returns null
 * immediately so continueGame() falls back to localStorage without hanging.
 */
export async function fetchServerSession(address: string): Promise<{
  seed: string
  onChainGameId: string | null
  onChainSeed: string | null
  moveHistory: any[]
  score: number
  scoreBoostActive: boolean
  isGameOver: boolean
  reviveCount: number
  updatedAt: string
} | null> {
  try {
    const res = await fetchWithTimeout(
      `${SERVER_URL}/session/restore/${address.toLowerCase()}`,
      {},
      5_000, // 5 s max — player should not wait longer than this to continue
    )
    if (!res.ok) return null
    const { session } = await res.json()
    return session ?? null
  } catch {
    return null
  }
}

/**
 * Marks the session as submitted after successful on-chain score submission.
 * Retries up to 3 times — losing this record means the session could be
 * offered for restore after it was already submitted.
 */
export async function markSessionComplete(address: string, seed: string): Promise<void> {
  await postWithRetry('/session/complete', { address, seed }, 3)
}
