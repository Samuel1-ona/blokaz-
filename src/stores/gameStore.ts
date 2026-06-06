import { create } from 'zustand'
import { GameSession } from '../engine/game'
import type { ShapeDefinition } from '../engine/shapes'
// Imported lazily to avoid circular deps — accessed via getState() at call time
import { usePowerUpStore } from './powerUpStore'
import { CLASSIC_SESSION_STORAGE_KEY } from '../utils/gameSessionStorage'

interface GameState {
  gameSession: GameSession | null
  score: number
  comboStreak: number
  currentPieces: (ShapeDefinition | null)[]
  isGameOver: boolean
  onChainGameId: bigint | null
  onChainSeed: `0x${string}` | null
  onChainStatus: 'none' | 'pending' | 'syncing' | 'registered' | 'failed'
  tournamentId: bigint | null
  reviveCount: number
  lotteryMultiplierMovesLeft: number

  startGame: (seed: bigint, preserveOnChain?: boolean) => void
  setOnChainData: (gameId: bigint, seed: `0x${string}`, status?: 'registered' | 'pending' | 'syncing' | 'failed') => void
  setOnChainGameId: (id: bigint) => void
  setOnChainSeed: (seed: `0x${string}`) => void
  setTournamentId: (id: bigint | null) => void
  placePiece: (index: number, r: number, c: number) => any
  resetGame: () => void
  reviveGame: () => void
  forceReset: () => void
}

export const useGameStore = create<GameState>((set, get) => ({
  gameSession: null,
  score: 0,
  comboStreak: 0,
  currentPieces: [],
  isGameOver: false,
  onChainGameId: null,
  onChainSeed: null,
  onChainStatus: 'none',
  tournamentId: null,
  reviveCount: 0,
  lotteryMultiplierMovesLeft: 0,

  startGame: (seed, preserveOnChain = false) => {
    const session = new GameSession(seed)
    // @ts-ignore
    window.currentPieces = session.currentPieces

    const updates: Partial<GameState> = {
      gameSession: session,
      score: 0,
      comboStreak: 0,
      currentPieces: session.currentPieces,
      isGameOver: false,
      reviveCount: 0,
      lotteryMultiplierMovesLeft: 0,
    }

    if (!preserveOnChain) {
      updates.onChainGameId = null
      updates.onChainSeed = null
      updates.onChainStatus = 'none'
    }

    set(updates)
  },

  setOnChainData: (gameId, seed, status = 'registered') => {
    set({ onChainGameId: gameId, onChainSeed: seed, onChainStatus: status })
  },

  setOnChainGameId: (id) => set({ onChainGameId: id }),
  setOnChainSeed: (seed) => set({ onChainSeed: seed }),
  setTournamentId: (id) => set({ tournamentId: id }),

  placePiece: (index, r, c) => {
    const { gameSession, reviveCount } = get()
    if (!gameSession) return null

    const result = gameSession.placePiece(index, r, c)
    if (!result.success) return result

    // Shield intercept: if this move triggers game-over, try to auto-save
    // synchronously BEFORE committing isGameOver to the store so the
    // game-over modal never flashes and timing/effect issues are eliminated.
    if (result.isGameOver) {
      const shielded = usePowerUpStore.getState().triggerShield()
      if (shielded) {
        // Record the shield-triggered revival so replayMoveHistory can call
        // session.revive() at this exact position during session restore.
        const minimalScoreEvent = {
          basePoints: 0, linePoints: 0, comboBonus: 0, totalPoints: 0,
          linesCleared: 0, newComboStreak: gameSession.comboStreak,
          comboMultiplier: 1 as const, isMilestone: false, multiLineFactor: 1 as const,
        }
        gameSession.moveHistory.push({
          pieceIndex: -1, shapeId: '', row: 0, col: 0,
          revive: true,
          scoreEvent: minimalScoreEvent,
        })

        gameSession.revive()
        // @ts-ignore
        window.currentPieces = gameSession.currentPieces
        set({
          score:                      gameSession.score,
          comboStreak:                gameSession.comboStreak,
          currentPieces:              [...gameSession.currentPieces],
          isGameOver:                 gameSession.isGameOver,
          reviveCount:                reviveCount + 1,
          lotteryMultiplierMovesLeft: gameSession.lotteryMultiplierMovesLeft,
        })
        return { ...result, isGameOver: gameSession.isGameOver }
      }
    }

    set({
      score:                      gameSession.score,
      comboStreak:                gameSession.comboStreak,
      currentPieces:              [...gameSession.currentPieces],
      isGameOver:                 result.isGameOver,
      lotteryMultiplierMovesLeft: gameSession.lotteryMultiplierMovesLeft,
    })
    // @ts-ignore
    window.currentPieces = gameSession.currentPieces
    return result
  },

  resetGame: () => {
    get().startGame(BigInt(Date.now()))
  },
  
  reviveGame: () => {
    const { gameSession, reviveCount } = get()
    if (!gameSession) return

    // Record the revival in moveHistory BEFORE mutating session state so the
    // record sits at the correct position for replayMoveHistory to call revive()
    // at exactly the right point during session restore.
    const minimalScoreEvent = {
      basePoints: 0, linePoints: 0, comboBonus: 0, totalPoints: 0,
      linesCleared: 0, newComboStreak: gameSession.comboStreak,
      comboMultiplier: 1 as const, isMilestone: false, multiLineFactor: 1 as const,
    }
    gameSession.moveHistory.push({
      pieceIndex: -1, shapeId: '', row: 0, col: 0,
      revive: true,
      scoreEvent: minimalScoreEvent,
    })

    gameSession.revive()
    // @ts-ignore
    window.currentPieces = gameSession.currentPieces

    set({
      isGameOver:                 gameSession.isGameOver,
      score:                      gameSession.score,
      currentPieces:              [...gameSession.currentPieces],
      reviveCount:                reviveCount + 1,
      lotteryMultiplierMovesLeft: gameSession.lotteryMultiplierMovesLeft,
    })

    // Persist the revive record synchronously so navigating away immediately
    // after tapping revival doesn't lose it before useEffect([reviveCount]) fires.
    try {
      const raw = localStorage.getItem(CLASSIC_SESSION_STORAGE_KEY)
      if (raw) {
        const entry = JSON.parse(raw)
        entry.snapshot = { moveHistory: gameSession.moveHistory, scoreBoostActive: gameSession.scoreBoostActive }
        localStorage.setItem(CLASSIC_SESSION_STORAGE_KEY, JSON.stringify(entry))
      }
    } catch {}
  },

  forceReset: (keepTournamentId = false) => {
    set({
      gameSession: null,
      score: 0,
      comboStreak: 0,
      currentPieces: [],
      isGameOver: false,
      onChainGameId: null,
      onChainSeed: null,
      onChainStatus: 'none',
      tournamentId: keepTournamentId ? get().tournamentId : null,
      reviveCount: 0,
      lotteryMultiplierMovesLeft: 0,
    })
  },

}))
