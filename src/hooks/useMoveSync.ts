import { useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
import { useGameStore } from '../stores/gameStore'

const SERVER_URL = import.meta.env.VITE_SIGNER_URL ?? 'http://localhost:3001'

// How long to wait after the last move before syncing.
// Batches rapid moves into one request — reduces server load by ~10x.
const SYNC_DEBOUNCE_MS = 3_000

async function post(path: string, body: object): Promise<void> {
  try {
    await fetch(`${SERVER_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    // Network failure — localStorage remains the fallback, swallow silently
  }
}

/**
 * Syncs the current game session to the server after moves settle.
 * Debounced to fire at most once every 3 seconds — groups rapid piece
 * placements into a single request instead of one per move.
 *
 * Mount inside GameScreen (i.e. while a game is active).
 */
export function useMoveSync() {
  const { address } = useAccount()
  const score = useGameStore((s) => s.score)
  const isGameOver = useGameStore((s) => s.isGameOver)
  const reviveCount = useGameStore((s) => s.reviveCount)
  const onChainGameId = useGameStore((s) => s.onChainGameId)
  const onChainSeed = useGameStore((s) => s.onChainSeed)

  const registeredSeedRef = useRef<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSyncedMoveCountRef = useRef(0)

  // Register a new session on the server when the game starts
  useEffect(() => {
    const { gameSession } = useGameStore.getState()
    if (!address || !gameSession) return
    const seed = gameSession.seed.toString()
    if (registeredSeedRef.current === seed) return
    registeredSeedRef.current = seed
    lastSyncedMoveCountRef.current = 0

    post('/session/start', {
      address,
      seed,
      onChainGameId: onChainGameId?.toString() ?? null,
      onChainSeed: onChainSeed ?? null,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address])

  // Debounced sync after every score change.
  // We use a ref for the callback so the timeout closure always reads the
  // latest state — this avoids stale captures and prevents the React cleanup
  // from cancelling a pending sync just because a dependency changed.
  const syncNowRef = useRef<() => void>(() => {})
  useEffect(() => {
    syncNowRef.current = () => {
      const { gameSession: session } = useGameStore.getState()
      if (!session || !address) return
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

  useEffect(() => {
    if (!address || !score) return
    const { gameSession } = useGameStore.getState()
    if (!gameSession || !gameSession.moveHistory.length) return

    const currentMoveCount = gameSession.moveHistory.length
    if (currentMoveCount === lastSyncedMoveCountRef.current) return

    // Reset the debounce timer — fires SYNC_DEBOUNCE_MS after the last move
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => syncNowRef.current(), SYNC_DEBOUNCE_MS)
  }, [score, address])

  // On unmount (navigation away), flush any pending sync immediately
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        const { gameSession } = useGameStore.getState()
        const addr = address
        if (!gameSession || !addr) return
        post('/session/sync', {
          address: addr,
          seed: gameSession.seed.toString(),
          moveHistory: gameSession.moveHistory,
          score: gameSession.score,
          scoreBoostActive: gameSession.scoreBoostActive,
          isGameOver: gameSession.isGameOver,
          reviveCount: useGameStore.getState().reviveCount,
          onChainGameId: useGameStore.getState().onChainGameId?.toString() ?? null,
          onChainSeed: useGameStore.getState().onChainSeed ?? null,
        })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address])
}

/**
 * Fetches the latest active session from the server.
 * Returns null if nothing found or server is unreachable.
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
    const res = await fetch(`${SERVER_URL}/session/restore/${address.toLowerCase()}`)
    if (!res.ok) return null
    const { session } = await res.json()
    return session ?? null
  } catch {
    return null
  }
}

/**
 * Marks the current session as submitted on the server.
 * Call after a successful on-chain score submission.
 */
export async function markSessionComplete(address: string, seed: string): Promise<void> {
  await post('/session/complete', { address, seed })
}
