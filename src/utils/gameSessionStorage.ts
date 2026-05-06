import type { MoveRecord } from '../engine/game'

export const CLASSIC_SESSION_STORAGE_KEY = 'blokaz_classic_session'
export const TOURNAMENT_SESSION_STORAGE_KEY = 'blokaz_tournament_session'

export interface StoredGameSession {
  address: string
  seed: `0x${string}`
  hash?: `0x${string}`
  gameId: string | null
  contractAddress: `0x${string}`
  tournamentId?: string | null
  snapshot?: { moveHistory: MoveRecord[] }
}

export function readStoredGameSession(
  storageKey: string,
  address?: `0x${string}`,
  contractAddress?: `0x${string}`
) {
  if (typeof window === 'undefined') return null

  const stored = localStorage.getItem(storageKey)
  if (!stored) return null

  try {
    const data = JSON.parse(stored) as StoredGameSession

    if (address && data.address.toLowerCase() !== address.toLowerCase()) {
      return null
    }

    if (contractAddress && data.contractAddress !== contractAddress) {
      return null
    }

    if (!data.seed) {
      return null
    }

    return data
  } catch (error) {
    console.error('Failed to parse stored game session', error)
    return null
  }
}

export function writeStoredGameSession(storageKey: string, session: StoredGameSession) {
  localStorage.setItem(storageKey, JSON.stringify(session))
}

export function clearStoredGameSession(storageKey: string) {
  localStorage.removeItem(storageKey)
}
