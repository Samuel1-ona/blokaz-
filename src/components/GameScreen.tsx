import React, { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../stores/gameStore'
import { GridRenderer } from '../canvas/GridRenderer'
import { PieceRenderer } from '../canvas/PieceRenderer'
import { TouchController } from '../canvas/TouchController'
import { AnimationManager } from '../canvas/AnimationManager'
import { Grid } from '../engine/grid'
import { SHAPES, TOTAL_WEIGHT } from '../engine/shapes'
import type { ShapeDefinition } from '../engine/shapes'
import ScoreBar from './ScoreBar'
import GameOverModal from './GameOverModal'
import NoGasModal from './NoGasModal'
import { ComboOverlay } from './ComboOverlay'
import { BrutalIcon } from './BrutalIcon'
import HowToPlayModal, { hasSeenOnboarding } from './HowToPlayModal'
import FAQSheet from './FAQSheet'
import {
  hapticImpact,
  hapticNotification,
  hapticError,
} from '../miniapp/haptics'
import {
  useStartGame,
  generateGameSeed,
  useActiveGame,
  useLeaderboard,
  useUsername,
} from '../hooks/useBlokzGame'
import { useAccount, useBalance } from 'wagmi'
import { keccak256, encodePacked } from 'viem'
import contractInfo from '../contract.json'
import { GameSession } from '../engine/game'
import type { MoveRecord } from '../engine/game'
import {
  CLASSIC_SESSION_STORAGE_KEY,
  readStoredGameSession,
  writeStoredGameSession,
  clearStoredGameSession,
} from '../utils/gameSessionStorage'
import { IS_MINIPAY } from '../utils/miniPay'

const GAME_ADDRESS = contractInfo.game as `0x${string}`
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

function replayMoveHistory(seed: bigint, history: MoveRecord[]): GameSession {
  const session = new GameSession(seed)
  for (const move of history) {
    session.placePiece(move.pieceIndex, move.row, move.col)
  }
  return session
}

interface GameScreenProps {
  onOpenLeaderboard?: () => void
  onBack?: () => void
}

// ─── Desktop sidebar widgets ────────────────────────────────────────────────

// ─── Desktop sidebar widgets ────────────────────────────────────────────────

const DailyStreakPanel: React.FC = () => {
  const today = new Date().getDay()
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  return (
    <div
      className="border-4 border-ink"
      style={{
        background: 'var(--paper-2)',
        boxShadow: '4px 4px 0 var(--shadow)',
      }}
    >
      <div
        className="flex items-center justify-between border-b-4 border-ink px-4 py-3"
        style={{ background: 'var(--accent-yellow)' }}
      >
        <div
          className="flex items-center font-display text-[10px] tracking-[0.16em]"
          style={{ color: 'var(--ink-fixed)' }}
        >
          <BrutalIcon name="flame" size={12} className="mr-2" /> DAILY STREAK
        </div>
        <div
          className="font-display text-sm"
          style={{ color: 'var(--ink-fixed)' }}
        >
          DAY 7
        </div>
      </div>
      <div className="px-4 py-3">
        <div className="mb-2 flex gap-1.5">
          {days.map((d, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full border-2 border-ink"
                style={{
                  height: 18,
                  background: i < today ? 'var(--accent-lime)' : 'var(--rule)',
                }}
              />
              <span
                className="font-display text-[8px]"
                style={{ color: 'var(--ink-soft)' }}
              >
                {d}
              </span>
            </div>
          ))}
        </div>
        <div
          className="font-body text-[10px] uppercase tracking-[0.08em]"
          style={{ color: 'var(--ink-soft)' }}
        >
          2× BONUS ACTIVE ON ALL CLEARS
        </div>
      </div>
    </div>
  )
}

const DANGER_DEFS = [
  {
    name: '3×3 SQUARE',
    risk: 'HIGH',
    color: 'var(--piece-red)',
    weight: SHAPES.find((shape) => shape.id === 'O3')?.spawnWeight ?? 0,
    match: (shape: ShapeDefinition) => shape.id === 'O3',
  },
  {
    name: '5-LONG LINE',
    risk: 'MED',
    color: 'var(--piece-orange)',
    weight: SHAPES.filter(
      (shape) => shape.id === 'I5H' || shape.id === 'I5V'
    ).reduce((sum, shape) => sum + shape.spawnWeight, 0),
    match: (shape: ShapeDefinition) => shape.id === 'I5H' || shape.id === 'I5V',
  },
  {
    name: 'Z-ZIGZAG',
    risk: 'LOW',
    color: 'var(--piece-lime)',
    weight: SHAPES.filter((shape) => shape.family === 'zigzag').reduce(
      (sum, shape) => sum + shape.spawnWeight,
      0
    ),
    match: (shape: ShapeDefinition) => shape.family === 'zigzag',
  },
] as const

const DangerWatch: React.FC<{ currentPieces?: (ShapeDefinition | null)[] }> = ({
  currentPieces = [],
}) => {
  return (
    <div
      className="border-4 border-ink"
      style={{
        background: 'var(--paper-2)',
        boxShadow: '4px 4px 0 var(--shadow)',
      }}
    >
      <div className="border-b-4 border-ink bg-paper px-4 py-3 font-display text-[11px] uppercase tracking-[0.2em]">
        DANGER WATCH
      </div>
      <div className="space-y-1.5 p-3">
        {DANGER_DEFS.map((danger) => {
          const isLive = currentPieces.some(
            (shape) => shape && danger.match(shape)
          )
          return (
            <div
              key={danger.name}
              className="flex items-center justify-between border-[3px] border-ink px-2 py-2 transition-colors"
              style={{
                background: isLive ? 'var(--accent-yellow)' : 'var(--paper-2)',
                boxShadow: isLive ? '3px 3px 0 var(--shadow)' : 'none',
                color: isLive ? 'var(--ink-fixed)' : 'inherit',
              }}
            >
              <div className="font-display text-[11px] uppercase tracking-[0.05em]">
                {danger.name}
              </div>
              <div
                className="flex items-center gap-1.5 border-2 border-ink px-2 py-0.5 font-display text-[9px] tracking-[0.1em]"
                style={{
                  background: isLive ? 'var(--accent-lime)' : 'transparent',
                }}
              >
                <div
                  className="h-1.5 w-1.5 rounded-full border border-ink"
                  style={{
                    background: isLive ? 'white' : 'var(--ink)',
                  }}
                />
                <span
                  style={{ color: isLive ? 'var(--ink-fixed)' : 'var(--ink)' }}
                >
                  {isLive ? 'LIVE' : danger.risk}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const LadderPlayerName: React.FC<{ address: string }> = ({ address }) => {
  const { username, isLoading } = useUsername(address as `0x${string}`)
  if (isLoading) return <span className="inline-block h-3 w-20 animate-pulse rounded-sm bg-current opacity-20" />
  const display = username ?? `${address.slice(0, 6)}…${address.slice(-4)}`
  return <span>{display}</span>
}

const LiveLadder: React.FC<{ currentScore: number }> = ({ currentScore }) => {
  const { leaderboard, isLoading } = useLeaderboard()
  const { address } = useAccount()
  const sorted = leaderboard
    ? [...leaderboard].sort((a, b) => b.score - a.score)
    : []
  const top3 = sorted.slice(0, 3)
  const userIdx = sorted.findIndex(
    (e) => e.player.toLowerCase() === (address?.toLowerCase() ?? '')
  )

  return (
    <div
      className="border-4 border-ink"
      style={{
        background: 'var(--paper-2)',
        boxShadow: '8px 8px 0 var(--shadow)',
      }}
    >
      <div
        className="flex items-center justify-between border-b-4 border-ink px-4 py-3 font-display text-[11px] tracking-[0.14em]"
        style={{ background: 'var(--paper)' }}
      >
        <span className="flex items-center uppercase tracking-[0.2em]">
          <BrutalIcon name="trending" size={12} className="mr-2" /> WEEKLY
          LADDER
        </span>
        <span
          className="font-display text-[9px]"
          style={{ color: 'var(--ink-soft)' }}
        >
          2D 14H
        </span>
      </div>
      {isLoading ? (
        <div className="space-y-2 p-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse bg-ink/5" />
          ))}
        </div>
      ) : (
        <div>
          {top3.map((entry, i) => {
            const isMe =
              entry.player.toLowerCase() === (address?.toLowerCase() ?? '')
            return (
              <div
                key={entry.player}
                className="flex items-center gap-2 border-b-2 border-ink px-3 py-2.5"
                style={{
                  background: isMe
                    ? 'var(--accent-yellow)'
                    : i === 0
                      ? 'var(--accent-yellow)'
                      : 'var(--paper-2)',
                  color: isMe || i === 0 ? 'var(--ink-fixed)' : 'inherit',
                }}
              >
                <span className="w-6 font-display text-sm">#{i + 1}</span>
                <span className="flex-1 truncate font-display text-xs">
                  <LadderPlayerName address={entry.player} />
                </span>
                <span className="font-display text-xs tabular-nums tracking-tighter">
                  {entry.score.toLocaleString()}
                </span>
              </div>
            )
          })}
          {userIdx > 2 && (
            <div
              className="flex items-center gap-2 border-b-2 border-ink px-3 py-2.5"
              style={{
                background: 'var(--accent-cyan)',
                color: 'var(--ink-fixed)',
              }}
            >
              <span className="w-6 font-display text-sm">#{userIdx + 1}</span>
              <span className="flex-1 font-display text-xs uppercase">YOU</span>
              <span className="ml-1 border border-ink bg-ink px-1 font-display text-[9px] tabular-nums text-white">
                YOU
              </span>
              <span className="font-display text-xs tabular-nums tracking-tighter">
                {sorted[userIdx].score.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const ShareCard: React.FC<{ score: number }> = ({ score }) => (
  <div
    className="border-4 border-ink bg-accent-pink p-5"
    style={{ boxShadow: '6px 6px 0 var(--shadow)', color: 'var(--ink-fixed)' }}
  >
    <div className="mb-4 flex items-center justify-between">
      <div className="font-display text-[10px] uppercase tracking-widest opacity-80">
        SHARE CARD
      </div>
      <div className="h-2 w-2 animate-pulse rounded-full bg-ink" />
    </div>

    <div className="relative overflow-hidden border-4 border-ink bg-paper-2 p-5 shadow-[4px_4px_0_var(--shadow)]">
      {/* Decorative dots */}
      <div className="absolute -right-4 -top-4 opacity-10">
        <svg width="60" height="60" viewBox="0 0 60 60">
          <pattern
            id="dots"
            x="0"
            y="0"
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="2" cy="2" r="2" fill="var(--ink)" />
          </pattern>
          <rect x="0" y="0" width="60" height="60" fill="url(#dots)" />
        </svg>
      </div>

      <div className="font-display text-3xl tracking-tighter text-ink">
        BLOKAZ.
      </div>
      <div
        className="mt-4 font-display text-[10px] uppercase tracking-widest"
        style={{ color: 'var(--ink-soft)' }}
      >
        CLASSIC RUN SCORE
      </div>
      <div
        className="mt-1 font-display leading-none text-accent-pink"
        style={{
          fontSize: 'clamp(2.5rem, 4vw, 3.5rem)',
          letterSpacing: '-0.04em',
          WebkitTextStroke: '2px var(--ink)',
        }}
      >
        {score.toLocaleString()}
      </div>
    </div>
  </div>
)

// ─── Stat block for desktop left column ─────────────────────────────────────
const StatBlock: React.FC<{ label: string; value: string; bg: string }> = ({
  label,
  value,
  bg,
}) => {
  const isColoredTile = bg !== 'var(--paper)' && bg !== 'var(--paper-2)'
  const labelColor = isColoredTile ? 'var(--ink-fixed)' : 'var(--ink-soft)'
  const valueColor = isColoredTile ? 'var(--ink-fixed)' : 'var(--ink)'

  return (
    <div
      className="flex flex-col justify-between border-4 border-ink p-3"
      style={{
        background: bg,
        boxShadow: '4px 4px 0 var(--shadow)',
        height: 74,
      }}
    >
      <div
        className="font-display text-[9px] uppercase tracking-[0.2em]"
        style={{ color: labelColor, opacity: isColoredTile ? 0.7 : 1 }}
      >
        {label}
      </div>
      <div
        className="font-display text-2xl uppercase"
        style={{ letterSpacing: '-0.02em', lineHeight: 1, color: valueColor }}
      >
        {value}
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isMobile
}

const GameScreen: React.FC<GameScreenProps> = ({
  onOpenLeaderboard,
  onBack,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boardContainerRef = useRef<HTMLDivElement>(null)
  const animManagerRef = useRef<AnimationManager>(new AnimationManager())
  const lastTimeRef = useRef<number>(0)
  const trayHoverIndexRef = useRef<number | null>(null)
  const cellSizeRef = useRef<number>(0)

  const {
    gameSession,
    score,
    comboStreak,
    isGameOver,
    startGame,
    setOnChainData,
    forceReset,
    onChainStatus,
    onChainSeed,
    onChainGameId,
  } = useGameStore()

  const { address, isConnected } = useAccount()

  // ── No-gas detection ──────────────────────────────────────────────────────
  // Threshold: 0.005 CELO — enough for ~3-5 typical contract writes.
  // Skipped for MiniPay (gas is handled by the dApp) and unconnected wallets.
  const GAS_THRESHOLD = 5_000_000_000_000_000n // 0.005 CELO in wei
  const { data: celoBalance } = useBalance({
    address,
    query: { enabled: isConnected && !IS_MINIPAY, refetchInterval: 15_000 },
  })
  const hasNoGas =
    isConnected && !IS_MINIPAY && celoBalance !== undefined && celoBalance.value < GAS_THRESHOLD

  const [noGasDismissed, setNoGasDismissed] = useState(false)
  // Re-surface the modal whenever the user re-enters the screen with no gas
  useEffect(() => {
    if (!hasNoGas) setNoGasDismissed(false)
  }, [hasNoGas])

  const showNoGasModal = hasNoGas && !noGasDismissed
  // ─────────────────────────────────────────────────────────────────────────

  const { leaderboard: lbData } = useLeaderboard()

  const BEST_SCORE_KEY = 'blokaz:best_score'
  const getStoredBest = () => {
    try { return Number(localStorage.getItem(BEST_SCORE_KEY) ?? 0) || 0 } catch { return 0 }
  }
  const [localBest, setLocalBest] = React.useState(getStoredBest)

  // Update all-time best whenever a game ends with a new high score
  React.useEffect(() => {
    if (isGameOver && score > 0) {
      const current = getStoredBest()
      if (score > current) {
        try { localStorage.setItem(BEST_SCORE_KEY, String(score)) } catch {}
        setLocalBest(score)
      }
    }
  }, [isGameOver, score])

  const bestScore = React.useMemo(() => {
    const entries = (lbData ?? []) as readonly { player: `0x${string}`; score: number; gameId: bigint }[]
    const lbBest = address
      ? Math.max(0, ...entries.filter(e => e.player.toLowerCase() === address.toLowerCase()).map(e => e.score))
      : 0
    const allTimeBest = Math.max(localBest, lbBest, score)
    return allTimeBest > 0 ? allTimeBest : undefined
  }, [lbData, address, localBest, score])

  const {
    gameId: onChainActiveGameId,
    isLoading: isLoadingActiveGame,
    refetch: refetchActiveGame,
  } = useActiveGame(address)
  const {
    startGame: contractStartGame,
    isPending,
    isConfirming,
    isSuccess,
    error: startGameError,
  } = useStartGame()

  const [currentSeed, setCurrentSeed] = useState<{
    seed: `0x${string}`
    hash: `0x${string}`
  } | null>(null)
  const [isSyncingContract, setIsSyncingContract] = useState(true)
  const [sessionConflict, setSessionConflict] = useState(false)
  const [comboTrigger, setComboTrigger] = useState(0)
  const [canvasDims, setCanvasDims] = useState<{
    gridSize: number
    trayY: number
    trayH: number
  } | null>(null)
  const isMobile = useIsMobile()

  // 0. Account Switch Protection
  const lastAddressRef = useRef<`0x${string}` | undefined>(address)
  useEffect(() => {
    if (address !== lastAddressRef.current) {
      forceReset()
      lastAddressRef.current = address
    }
  }, [address, forceReset])

  // 0.5 Hydration & Reconciliation
  useEffect(() => {
    if (!isConnected || !address || isLoadingActiveGame) {
      if (!isConnected) setIsSyncingContract(false)
      return
    }
    const storedSession = readStoredGameSession(
      CLASSIC_SESSION_STORAGE_KEY,
      address,
      GAME_ADDRESS
    )
    const contractActiveId = (onChainActiveGameId as bigint) || 0n
    if (contractActiveId !== 0n) {
      if (!storedSession) {
        // On-chain game exists but NO local session — new device, fresh social
        // login (Web3Auth), or cleared browser data. Nothing locally to conflict
        // with, so just clear the stale on-chain ref and let the user start fresh.
        // If the contract rejects a new start because of the existing game ID,
        // that error will surface naturally via the tx rejection.
        setOnChainData(0n, null, 'none')
        setSessionConflict(false)
      } else if (
        storedSession.gameId === contractActiveId.toString() ||
        !storedSession.gameId
      ) {
        // Local session matches the on-chain game — resume it.
        setOnChainData(contractActiveId, storedSession.seed, 'none')
        setSessionConflict(false)
      } else {
        // True conflict: a local session exists but its game ID doesn't match
        // the active on-chain game. User must reset.
        setSessionConflict(true)
      }
    } else {
      if (storedSession) setOnChainData(0n, null, 'none')
      setSessionConflict(false)
    }
    setIsSyncingContract(false)
  }, [
    isConnected,
    address,
    isLoadingActiveGame,
    onChainActiveGameId,
    setOnChainData,
  ])

  // 1. Handle Start
  const handleStartGame = () => {
    if (isPending || isConfirming) return // already has a tx in flight
    const freshState = useGameStore.getState()
    const { onChainSeed: latestSeed, onChainGameId: latestGameId } = freshState
    if (
      isConnected &&
      address &&
      latestSeed &&
      latestGameId &&
      latestGameId !== 0n
    ) {
      const localSeed = BigInt(
        keccak256(
          encodePacked(['bytes32', 'address'], [latestSeed, address])
        ).slice(0, 18)
      )
      const stored = readStoredGameSession(CLASSIC_SESSION_STORAGE_KEY, address, GAME_ADDRESS)
      if (stored?.snapshot?.moveHistory?.length) {
        const restoredSession = replayMoveHistory(localSeed, stored.snapshot.moveHistory)
        ;(window as any).currentPieces = restoredSession.currentPieces
        useGameStore.setState({
          gameSession: restoredSession,
          score: restoredSession.score,
          comboStreak: restoredSession.comboStreak,
          currentPieces: [...restoredSession.currentPieces],
          isGameOver: restoredSession.isGameOver,
        })
      } else {
        startGame(localSeed, true)
      }
      return
    }
    const dummyAddr = address || ZERO_ADDRESS
    const { seed, hash } = generateGameSeed(dummyAddr)
    const localSeed = BigInt(hash.slice(0, 18))
    startGame(localSeed)
    if (isConnected && address) {
      setCurrentSeed({ seed, hash })
      setOnChainData(0n, seed, 'pending')
      writeStoredGameSession(CLASSIC_SESSION_STORAGE_KEY, {
        address,
        seed,
        hash,
        gameId: null,
        contractAddress: GAME_ADDRESS,
      })
      contractStartGame(hash)
    } else {
      setOnChainData(0n, seed, 'none')
    }
  }

  // 2. Background Sync
  useEffect(() => {
    if (isSuccess && currentSeed && address) {
      setOnChainData(0n, currentSeed.seed, 'syncing')
      const timer = setInterval(async () => {
        const res = await refetchActiveGame()
        const newGameId = res.data as bigint
        if (newGameId && newGameId !== 0n) {
          setOnChainData(newGameId, currentSeed.seed, 'registered')
          writeStoredGameSession(CLASSIC_SESSION_STORAGE_KEY, {
            address,
            seed: currentSeed.seed,
            hash: currentSeed.hash,
            gameId: newGameId.toString(),
            contractAddress: GAME_ADDRESS,
          })
          clearInterval(timer)
        }
      }, 2000)
      return () => clearInterval(timer)
    }
  }, [address, currentSeed, isSuccess, refetchActiveGame, setOnChainData])

  // 3. Practice Mode Fallback
  // Skip in MiniPay: isConnected is always false on first render because
  // MiniPayAutoConnect hasn't resolved yet. Without this guard the game
  // silently starts in practice mode and contractStartGame is never called.
  useEffect(() => {
    if (!isConnected && !gameSession && !IS_MINIPAY) handleStartGame()
  }, [isConnected, gameSession])

  // 4. Start tx rejection → abandon session and go back to lobby
  useEffect(() => {
    if (!startGameError) return
    const msg = (startGameError as any)?.message?.toLowerCase() ?? ''
    const isRejection =
      msg.includes('rejected') ||
      msg.includes('denied') ||
      msg.includes('cancelled') ||
      (startGameError as any)?.code === 4001
    if (isRejection) {
      forceReset()
      onBack?.()
    }
  }, [startGameError])

  // Canvas init
  useEffect(() => {
    if (!canvasRef.current || !gameSession) return

    const canvas = canvasRef.current

    // Fallback used only when the container hasn't been measured yet.
    // On mobile the board fills full width; subtract nothing for margins.
    // Height fraction ≈ dvh minus header(64) + scorebar(~48) + bottomnav(64)
    // expressed as a ratio so it works across screen sizes.
    const vpFallback = Math.min(
      window.innerWidth,
      Math.round(window.innerHeight * 0.58)
    )

    const computeDims = (containerWidth: number, containerHeight = 0) => {
      let gridSize = containerWidth > 0 ? containerWidth : vpFallback
      if (containerHeight > 0) {
        // totalCanvasH = gridSize + trayGap + trayH ≈ gridSize × 25/18
        const maxByHeight = Math.floor((containerHeight * 18) / 25)
        if (maxByHeight > 0 && maxByHeight < gridSize) gridSize = maxByHeight
      }
      const cellSize = gridSize / 9
      const trayGap = Math.round(cellSize * 0.5)
      const trayHeight = Math.round(gridSize / 3)
      const trayY = gridSize + trayGap
      return { gridSize, cellSize, trayGap, trayHeight, trayY }
    }

    const initialW = boardContainerRef.current?.clientWidth || 0
    const initialH = boardContainerRef.current?.clientHeight || 0
    const init = computeDims(initialW, initialH)

    canvas.width = init.gridSize
    canvas.height = init.gridSize + init.trayGap + init.trayHeight
    canvas.style.width = `${init.gridSize}px`
    canvas.style.height = `${canvas.height}px`
    canvas.style.background = 'transparent'

    setCanvasDims({
      gridSize: init.gridSize,
      trayY: init.trayY,
      trayH: init.trayHeight,
    })
    cellSizeRef.current = init.cellSize

    const gridRenderer = new GridRenderer(canvas, init.gridSize)
    const pieceRenderer = new PieceRenderer(canvas, init.trayY, init.cellSize)
    const animManager = animManagerRef.current

    // ResizeObserver keeps canvas sized to container
    let ro: ResizeObserver | null = null
    if (boardContainerRef.current) {
      ro = new ResizeObserver(([entry]) => {
        const w = entry.contentRect.width
        const h = entry.contentRect.height
        if (w <= 0) return
        const d = computeDims(w, h)
        const totalH = d.gridSize + d.trayGap + d.trayHeight
        canvas.width = d.gridSize
        canvas.height = totalH
        canvas.style.width = `${d.gridSize}px`
        canvas.style.height = `${totalH}px`
        gridRenderer.resize(d.gridSize)
        pieceRenderer.resize(d.trayY, d.cellSize, d.gridSize)
        cellSizeRef.current = d.cellSize
        setCanvasDims({
          gridSize: d.gridSize,
          trayY: d.trayY,
          trayH: d.trayHeight,
        })
      })
      ro.observe(boardContainerRef.current)
    }

    const touchController = new TouchController(
      canvas,
      gridRenderer,
      pieceRenderer,
      (pieceIndex: number, row: number, col: number) => {
        // Capture shape before state mutation so we know which cells were placed
        const preShape = useGameStore.getState().gameSession?.currentPieces[pieceIndex]
        const result = useGameStore.getState().placePiece(pieceIndex, row, col)
        if (!result?.success) {
          hapticError()
          return
        }
        hapticImpact()
        // Brief drop-flash on placed cells
        if (preShape) {
          const placedCells = (preShape.cells as [number, number][])
            .map(([dr, dc]) => ({ row: row + dr, col: col + dc }))
            .filter((c) => c.row >= 0 && c.row < 9 && c.col >= 0 && c.col < 9)
          animManager.trigger('DROP_FLASH', { cells: placedCells })
        }
        const linesCleared = result.linesCleared
        if (
          linesCleared &&
          (linesCleared.rows.length > 0 || linesCleared.cols.length > 0)
        ) {
          hapticNotification()
          animManager.trigger('LINE_CLEAR', {
            rows: linesCleared.rows,
            cols: linesCleared.cols,
          })
          if (result.scoreEvent && result.scoreEvent.newComboStreak > 0) {
            animManager.trigger('COMBO', {
              streak: result.scoreEvent.newComboStreak,
            })
            setComboTrigger((t) => t + 1)
          }
        }
        if (result.scoreEvent && result.scoreEvent.totalPoints > 0) {
          animManager.trigger('SCORE', {
            x: gridRenderer.currentGridSize * 0.5,
            y: gridRenderer.currentGridSize * 0.45,
            score: result.scoreEvent.totalPoints,
          })
        }
        // Persist move history so browser refresh can replay and restore progress
        const updatedSession = useGameStore.getState().gameSession
        if (updatedSession) {
          const raw = localStorage.getItem(CLASSIC_SESSION_STORAGE_KEY)
          if (raw) {
            try {
              const entry = JSON.parse(raw)
              entry.snapshot = { moveHistory: updatedSession.moveHistory }
              localStorage.setItem(CLASSIC_SESSION_STORAGE_KEY, JSON.stringify(entry))
            } catch {}
          }
        }
      },
      (shape: ShapeDefinition, row: number, col: number) => {
        if (!shape) return false
        const session = useGameStore.getState().gameSession
        return session ? Grid.canPlace(session.grid, shape, row, col) : false
      },
      (index) => {
        trayHoverIndexRef.current = index
      }
    )

    let rafHandle: number
    lastTimeRef.current = 0

    const render = (timestamp: number) => {
      const delta = lastTimeRef.current ? timestamp - lastTimeRef.current : 16
      lastTimeRef.current = timestamp
      animManager.update(delta)

      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const currentSession = useGameStore.getState().gameSession
      if (!currentSession) return

      const ghost = (window as any).activeGhost as {
        row: number
        col: number
        valid: boolean
      } | null
      const dragState = touchController.getDragState()
      const activeIdx = dragState.isDragging && dragState.dragIndex !== null ? dragState.dragIndex : null
      const selectedIdx = dragState.selectedIndex ?? null
      let ghostCells: { row: number; col: number; valid: boolean }[] | undefined

      if (ghost && (activeIdx !== null || selectedIdx !== null)) {
        const idx = activeIdx ?? selectedIdx!
        const shape = currentSession.currentPieces[idx]
        if (shape) {
          ghostCells = (shape.cells as [number, number][])
            .map(([dr, dc]) => ({
              row: ghost.row + dr,
              col: ghost.col + dc,
              valid: ghost.valid,
            }))
            .filter(
              (cell) =>
                cell.row >= 0 && cell.row < 9 && cell.col >= 0 && cell.col < 9
            )
        }
      }

      gridRenderer.draw(currentSession.grid, ghostCells, false)
      pieceRenderer.drawTray(
        currentSession.currentPieces,
        activeIdx ?? undefined,
        false,
        activeIdx !== null ? undefined : (trayHoverIndexRef.current ?? undefined),
        selectedIdx ?? undefined
      )

      if (dragState.isDragging && dragState.dragIndex !== null) {
        const shape = currentSession.currentPieces[dragState.dragIndex]
        if (shape)
          pieceRenderer.drawDragging(
            shape,
            dragState.dragPos.x,
            dragState.dragPos.y,
            cellSizeRef.current,
            false
          )
      }

      animManager.draw(ctx, cellSizeRef.current, false)
      rafHandle = requestAnimationFrame(render)
    }

    rafHandle = requestAnimationFrame(render)
    return () => {
      cancelAnimationFrame(rafHandle)
      touchController.destroy()
      ro?.disconnect()
      trayHoverIndexRef.current = null
    }
  }, [!!gameSession])

  const handlePlayAgain = () => handleStartGame()

  // Detect a saved game the user can resume (snapshot in localStorage)
  const hasStoredGame = !gameSession && !!address && !!(
    readStoredGameSession(CLASSIC_SESSION_STORAGE_KEY, address, GAME_ADDRESS)?.snapshot?.moveHistory?.length
  )

  const continueGame = () => {
    if (!address) return
    const stored = readStoredGameSession(CLASSIC_SESSION_STORAGE_KEY, address, GAME_ADDRESS)
    if (!stored?.snapshot?.moveHistory?.length || !stored.hash) return
    const localSeed = BigInt(stored.hash.slice(0, 18))
    const restoredSession = replayMoveHistory(localSeed, stored.snapshot.moveHistory)
    ;(window as any).currentPieces = restoredSession.currentPieces
    useGameStore.setState({
      gameSession: restoredSession,
      score: restoredSession.score,
      comboStreak: restoredSession.comboStreak,
      currentPieces: [...restoredSession.currentPieces],
      isGameOver: restoredSession.isGameOver,
    })
  }

  const startNewGame = () => {
    clearStoredGameSession(CLASSIC_SESSION_STORAGE_KEY)
    forceReset()
    handleStartGame()
  }

  const isMiniPayConnecting = IS_MINIPAY && !isConnected

  const commonCanvasProps = {
    canvasRef,
    boardContainerRef,
    canvasDims,
    gameSession,
    isConnected,
    onChainStatus,
    isPending,
    isConfirming,
    comboStreak,
    comboTrigger,
    isGameOver,
    score,
    address,
    handleStartGame,
    isSyncingContract,
    isMiniPayConnecting,
    sessionConflict,
    forceReset,
    setSessionConflict,
    onOpenLeaderboard,
    startGameError,
    hasStoredGame,
    continueGame,
    startNewGame,
  }

  const canvasArea = (
    <CanvasArea
      {...commonCanvasProps}
    />
  )

  if (isMobile) {
    return (
      <>
        <MobileLayout
          score={score}
          comboStreak={comboStreak}
          bestScore={bestScore}
          gameSession={gameSession}
          onOpenLeaderboard={onOpenLeaderboard}
          onBack={onBack}
          canvasArea={canvasArea}
        />
        {showNoGasModal && <NoGasModal address={address} onDismiss={() => setNoGasDismissed(true)} />}
      </>
    )
  }

  return (
    <>
      <DesktopLayout
        score={score}
        comboStreak={comboStreak}
        gameSession={gameSession}
        bestScore={bestScore}
        onOpenLeaderboard={onOpenLeaderboard}
        canvasArea={canvasArea}
      />
      {showNoGasModal && <NoGasModal address={address} onDismiss={() => setNoGasDismissed(true)} />}
    </>
  )
}

// ─── Sub-components moved outside to avoid unmounting canvas ────────────────

interface SyncChipProps {
  gameSession: any
  isConnected: boolean
  onChainStatus: string
  isPending: boolean
  isConfirming: boolean
}

const SyncStatusChip: React.FC<SyncChipProps> = ({
  gameSession,
  isConnected,
  onChainStatus,
  isPending,
  isConfirming,
}) => {
  if (!gameSession || !isConnected) return null
  if (onChainStatus === 'pending' || isPending || isConfirming) {
    return (
      <div
        className="flex items-center gap-2 border-2 border-ink px-2 py-1 font-display text-[10px] tracking-[0.12em]"
        style={{
          background: 'var(--accent-yellow)',
          color: 'var(--ink-fixed)',
          boxShadow: '2px 2px 0 var(--shadow)',
        }}
      >
        <div className="h-2 w-2 animate-pulse bg-ink" />
        SYNCING
      </div>
    )
  }
  if (onChainStatus === 'syncing') {
    return (
      <div
        className="flex items-center gap-2 border-2 border-ink px-2 py-1 font-display text-[10px] tracking-[0.12em]"
        style={{
          background: 'var(--accent-cyan)',
          color: 'var(--ink-fixed)',
          boxShadow: '2px 2px 0 var(--shadow)',
        }}
      >
        <div className="brutal-loader" />
        FINALIZING
      </div>
    )
  }
  if (onChainStatus === 'registered') {
    return (
      <div
        className="flex items-center gap-2 border-2 border-ink px-2 py-1 font-display text-[10px] tracking-[0.12em]"
        style={{
          background: 'var(--accent-lime)',
          color: 'var(--ink-fixed)',
          boxShadow: '2px 2px 0 var(--shadow)',
        }}
      >
        <div className="h-2 w-2" style={{ background: 'var(--ink)' }} />
        VERIFIED
      </div>
    )
  }
  return null
}

interface CanvasAreaProps {
  canvasRef: React.RefObject<HTMLCanvasElement>
  boardContainerRef: React.RefObject<HTMLDivElement>
  canvasDims: { gridSize: number; trayY: number; trayH: number } | null
  gameSession: any
  isConnected: boolean
  onChainStatus: string
  isPending: boolean
  isConfirming: boolean
  comboStreak: number
  comboTrigger: number
  isGameOver: boolean
  score: number
  handleStartGame: () => void
  isSyncingContract: boolean
  isMiniPayConnecting: boolean
  sessionConflict: boolean
  forceReset: () => void
  setSessionConflict: (v: boolean) => void
  onOpenLeaderboard?: () => void
  startGameError?: Error | null
  hasStoredGame: boolean
  continueGame: () => void
  startNewGame: () => void
}

const ClassicStartCard: React.FC<{
  isConnected: boolean
  handleStartGame: () => void
  isPending: boolean
  isConfirming: boolean
  isSyncingContract: boolean
  isMiniPayConnecting: boolean
  sessionConflict: boolean
  forceReset: () => void
  setSessionConflict: (v: boolean) => void
  startGameError?: Error | null
  hasStoredGame: boolean
  continueGame: () => void
  startNewGame: () => void
}> = ({
  isConnected,
  handleStartGame,
  isPending,
  isConfirming,
  isSyncingContract,
  isMiniPayConnecting,
  sessionConflict,
  forceReset,
  setSessionConflict,
  startGameError,
  hasStoredGame,
  continueGame,
  startNewGame,
}) => {
  const [showHowToPlay, setShowHowToPlay] = useState(!hasSeenOnboarding())

  return (
  <>
  {showHowToPlay && (
    <HowToPlayModal onDone={() => setShowHowToPlay(false)} />
  )}
  <div
    className="relative z-10 flex w-full flex-col gap-4 rounded-[6px] border-4 border-ink bg-paper px-4 py-5 sm:gap-5 sm:px-7 sm:py-8"
    style={{ boxShadow: '6px 6px 0 var(--accent-yellow)' }}
  >
    <div
      className="w-fit border-4 border-ink bg-accent-yellow px-6 py-2 font-display text-sm tracking-[0.15em]"
      style={{ boxShadow: '4px 4px 0 var(--shadow)', color: 'var(--ink-fixed)' }}
    >
      CLASSIC MODE
    </div>

    {/* Hero Image */}
    <div className="relative overflow-hidden border-4 border-ink bg-paper-2 shadow-[6px_6px_0_var(--shadow)]">
      <img
        src="/hero.webp"
        alt="Blokaz Game Preview"
        className="block h-auto w-full"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/20 to-transparent" />
    </div>

    <div
      className="text-center font-display uppercase"
      style={{
        fontSize: 'clamp(1.4rem, 7.5vw, 2rem)',
        letterSpacing: '-0.03em',
        lineHeight: 1.1,
      }}
    >
      READY FOR A{' '}
      <span
        className="bg-accent-pink px-2 text-white"
        style={{
          display: 'inline-block',
          transform: 'rotate(-2deg)',
          border: '3px solid var(--ink)',
          boxShadow: '3px 3px 0 var(--shadow)',
        }}
      >
        CLASSIC
      </span>{' '}
      RUN?
    </div>
    {/* CONTINUE GAME — shown when a saved snapshot exists */}
    {hasStoredGame && (
      <button
        onClick={continueGame}
        disabled={isPending || isConfirming || isSyncingContract || isMiniPayConnecting}
        className="brutal-btn flex w-full items-center justify-center gap-3 border-4 border-ink bg-accent-lime py-5 font-display text-sm uppercase tracking-[0.15em] shadow-[6px_6px_0_var(--shadow)] disabled:opacity-70"
        style={{ color: 'var(--ink-fixed)' }}
      >
        ▶ CONTINUE GAME
      </button>
    )}

    <button
      onClick={hasStoredGame ? startNewGame : handleStartGame}
      disabled={
        isPending ||
        isConfirming ||
        isSyncingContract ||
        isMiniPayConnecting ||
        sessionConflict
      }
      className={`brutal-btn flex w-full items-center justify-center gap-3 border-4 border-ink py-5 font-display text-sm uppercase tracking-[0.15em] shadow-[6px_6px_0_var(--shadow)] disabled:opacity-70 ${
        hasStoredGame ? 'bg-paper-2' : 'bg-accent-lime'
      }`}
      style={{ color: 'var(--ink-fixed)' }}
    >
      {isMiniPayConnecting ? (
        <>
          <div className="brutal-loader" />
          CONNECTING...
        </>
      ) : isSyncingContract ? (
        <>
          <div className="brutal-loader" />
          SYNCING...
        </>
      ) : sessionConflict ? (
        'SESSION CONFLICT'
      ) : hasStoredGame ? (
        'START NEW GAME'
      ) : (
        'START CLASSIC GAME'
      )}
    </button>

    {sessionConflict && (
      <div className="fixed inset-0 z-[500] flex items-center justify-center px-5">
        {/* Backdrop */}
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }} />
        {/* Modal */}
        <div
          className="relative w-full max-w-sm border-4 border-ink"
          style={{ background: 'var(--paper)', boxShadow: '8px 8px 0 var(--danger)' }}
        >
          {/* Header strip */}
          <div
            className="flex items-center gap-3 border-b-4 border-ink px-5 py-4"
            style={{ background: 'var(--danger)' }}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center border-[3px] border-white">
              <BrutalIcon name="alert" size={18} strokeWidth={3} className="text-white" />
            </div>
            <div>
              <div className="font-display text-[13px] uppercase tracking-[0.14em] text-white">SESSION CONFLICT</div>
              <div className="font-body text-[10px] text-white opacity-75">Action required</div>
            </div>
          </div>
          {/* Body */}
          <div className="px-5 py-5">
            <p className="mb-5 font-body text-[13px] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
              Your app has a saved game that doesn't match your active session. You need to reset before starting a new game.
            </p>
            <button
              onClick={() => { forceReset(); setSessionConflict(false) }}
              className="brutal-btn flex w-full items-center justify-center gap-2 border-[3px] border-ink py-3.5 font-display text-[12px] uppercase tracking-widest text-white"
              style={{ background: 'var(--danger)', boxShadow: '4px 4px 0 rgba(0,0,0,0.3)' }}
            >
              <BrutalIcon name="alert" size={14} strokeWidth={2.5} />
              RESET &amp; START FRESH
            </button>
          </div>
        </div>
      </div>
    )}
    <div
      className="flex items-center justify-center gap-2 text-center font-display text-[10px] uppercase tracking-widest"
      style={{ color: 'var(--ink-soft)' }}
    >
      {isConnected ? (
        <>
          <BrutalIcon name="zap" size={10} strokeWidth={2} /> Score flows into
          the leaderboard automatically
        </>
      ) : isMiniPayConnecting ? (
        <>
          <BrutalIcon name="zap" size={10} strokeWidth={2} /> Connecting MiniPay
          wallet...
        </>
      ) : (
        <>
          <BrutalIcon name="alert" size={10} strokeWidth={2} /> PRACTICE MODE —
          connect wallet for rewards
        </>
      )}
    </div>

    {startGameError && (
      <div className="border-4 border-danger bg-paper-2 p-4" style={{ boxShadow: '4px 4px 0 var(--shadow)' }}>
        <div className="mb-1.5 flex items-center gap-2 font-display text-[11px] uppercase tracking-[0.12em] text-danger">
          <BrutalIcon name="alert" size={12} strokeWidth={2.5} />
          COULDN'T START YOUR GAME
        </div>
        <p className="mb-3 font-body text-[11px] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
          The approval was cancelled or failed. Tap below to try again — your game won't start until it goes through.
        </p>
        <button
          onClick={handleStartGame}
          disabled={isPending || isConfirming}
          className="brutal-btn flex w-full items-center justify-center gap-2 border-[3px] border-ink py-2.5 font-display text-[11px] uppercase tracking-widest disabled:opacity-50"
          style={{ background: 'var(--accent-yellow)', color: 'var(--ink-fixed)', boxShadow: '3px 3px 0 var(--shadow)' }}
        >
          {isPending || isConfirming ? <div className="brutal-loader" /> : <BrutalIcon name="play" size={13} strokeWidth={2.5} />}
          TRY AGAIN
        </button>
      </div>
    )}

    {/* How to play link — re-opens tutorial after first time */}
    <button
      onClick={() => setShowHowToPlay(true)}
      className="flex items-center justify-center gap-1.5 font-display text-[10px] uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity"
      style={{ color: 'var(--ink)' }}
    >
      <BrutalIcon name="alert" size={10} strokeWidth={2} />
      HOW TO PLAY
    </button>
  </div>
  </>
  )
}

const CanvasArea: React.FC<CanvasAreaProps> = ({
  canvasRef,
  boardContainerRef,
  canvasDims,
  gameSession,
  isConnected,
  onChainStatus,
  isPending,
  isConfirming,
  comboStreak,
  comboTrigger,
  isGameOver,
  score,
  address,
  handleStartGame,
  isSyncingContract,
  isMiniPayConnecting,
  sessionConflict,
  forceReset,
  setSessionConflict,
  onOpenLeaderboard,
  startGameError,
  hasStoredGame,
  continueGame,
  startNewGame,
}) => {
  if (!gameSession) {
    return (
      <ClassicStartCard
        isConnected={isConnected}
        handleStartGame={handleStartGame}
        isPending={isPending}
        isConfirming={isConfirming}
        isSyncingContract={isSyncingContract}
        isMiniPayConnecting={isMiniPayConnecting}
        sessionConflict={sessionConflict}
        forceReset={forceReset}
        setSessionConflict={setSessionConflict}
        startGameError={startGameError}
        hasStoredGame={hasStoredGame}
        continueGame={continueGame}
        startNewGame={startNewGame}
      />
    )
  }

  return (
    <div
      ref={boardContainerRef}
      className="flex flex-1 min-h-0 w-full select-none items-center justify-center"
    >
      <div className="relative inline-flex flex-col">
        {canvasDims && (
          <>
            <div
              className="pointer-events-none absolute left-0 top-0 rounded-[6px] border-[4px] border-ink bg-paper-2"
              style={{
                width: canvasDims.gridSize,
                height: canvasDims.gridSize,
                boxShadow: '8px 8px 0 var(--shadow)',
              }}
            />
            <div
              className="pointer-events-none absolute left-0 z-[1] grid grid-cols-3 border-[3px] border-ink p-3 sm:p-5"
              style={{
                background: 'var(--piece-tray-bg)',
                top: canvasDims.trayY,
                width: canvasDims.gridSize,
                height: canvasDims.trayH,
                boxShadow: '6px 6px 0 var(--shadow)',
              }}
            >
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="flex items-center justify-center border-r-[3px] border-ink last:border-r-0"
                />
              ))}
            </div>
          </>
        )}

        <div className="relative z-[2]" style={{ display: 'inline-block' }}>
          <canvas
            ref={canvasRef}
            style={{ touchAction: 'none', display: 'block' }}
          />

          {/* Sync chip */}
          <div className="pointer-events-none absolute right-2 top-2 z-30">
            <SyncStatusChip
              gameSession={gameSession}
              isConnected={isConnected}
              onChainStatus={onChainStatus}
              isPending={isPending}
              isConfirming={isConfirming}
            />
          </div>

          {/* ComboOverlay */}
          <ComboOverlay streak={comboStreak} trigger={comboTrigger} />

          {isGameOver && (
            <GameOverModal
              score={score}
              onPlayAgain={handleStartGame}
              onOpenLeaderboard={onOpenLeaderboard}
              mode="classic"
            />
          )}
        </div>
      </div>
    </div>
  )
}

interface MobileLayoutProps {
  score: number
  comboStreak: number
  bestScore?: number
  gameSession: any
  onOpenLeaderboard?: () => void
  onBack?: () => void
  canvasArea: React.ReactNode
}

const ClassicTabStrip: React.FC<{
  onOpenLeaderboard?: () => void
  mobile?: boolean
}> = ({ onOpenLeaderboard, mobile = false }) => (
  <div
    className={`flex w-full flex-wrap items-center gap-4 border-b-2 border-ink ${
      mobile ? 'mb-4 min-h-12 pb-3' : 'mb-8 h-12 pb-4'
    }`}
  >
    <div
      className="border-4 border-ink px-4 py-2 font-display text-sm tracking-[0.1em]"
      style={{
        background: 'var(--accent-yellow)',
        boxShadow: '4px 4px 0 var(--shadow)',
      }}
    >
      CLASSIC MODE
    </div>
    <span
      className="font-display text-[10px] uppercase tracking-[0.2em]"
      style={{ color: 'var(--ink-soft)' }}
    >
      WEEKLY LEADERBOARD RUN
    </span>
    {onOpenLeaderboard && (
      <button
        onClick={onOpenLeaderboard}
        className="brutal-btn ml-auto border-4 border-ink px-4 py-2 font-display text-[10px] tracking-[0.1em]"
        style={{
          background: 'var(--paper-2)',
          boxShadow: '4px 4px 0 var(--shadow)',
        }}
      >
        RANKINGS
      </button>
    )}
  </div>
)

const LeftRail: React.FC<{
  score: number
  comboStreak: number
  gameSession: any
}> = ({ score, comboStreak, gameSession }) => (
  <div className="flex w-full flex-col gap-5">
    <div
      className="border-4 border-ink p-5"
      style={{ background: 'var(--ink-fixed)', boxShadow: '6px 6px 0 var(--shadow)' }}
    >
      <div
        className="brutal-label mb-2 opacity-100"
      >
        LIVE SCORE
      </div>
      <div
        className="font-display tabular-nums"
        style={{ fontSize: 64, letterSpacing: '-0.04em', lineHeight: 0.95, color: '#ffffff' }}
      >
        {score.toLocaleString()}
      </div>
      {comboStreak > 0 && (
        <div className="mt-4 flex gap-2">
          <div className="brutal-sticker text-[14px]">COMBO ×{comboStreak}</div>
          <div
            className="border-2 border-ink bg-accent-yellow px-2 py-1 font-display text-[11px] tracking-widest"
            style={{ color: 'var(--ink-fixed)' }}
          >
            +{Math.floor(score * 0.05)}
          </div>
        </div>
      )}
    </div>

    <div
      className="border-4 border-ink p-4"
      style={{
        background: 'var(--paper-2)',
        boxShadow: '5px 5px 0 var(--shadow)',
      }}
    >
      <div className="brutal-label mb-3">
        NEXT CLEAR CHAIN
      </div>
      <div
        className="relative overflow-hidden border-[4px] border-ink"
        style={{ height: 24 }}
      >
        <div
          className={`tension-fill absolute inset-y-0 left-0 ${
            comboStreak >= 4 ? 'tension-fill-strobe' : ''
          }`}
          style={{
            width: `${Math.min(100, comboStreak * 20 + 28)}%`,
            transition: 'width 200ms cubic-bezier(0.17, 0.67, 0.83, 0.67)',
          }}
        />
      </div>
      <div
        className="mt-3 flex justify-between font-display text-[10px] uppercase tracking-widest"
        style={{ color: 'var(--ink-soft)' }}
      >
        <span>×{comboStreak + 1} NEXT</span>
        <span>+220 BONUS</span>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-3">
      <StatBlock
        label="PIECES"
        value={gameSession ? String(gameSession.moveHistory.length) : '0'}
        bg="var(--paper-2)"
      />
      <StatBlock
        label="CLEARS"
        value={
          gameSession
            ? String(
                gameSession.moveHistory.reduce(
                  (sum: number, m: any) =>
                    sum + (m.scoreEvent?.linesCleared || 0),
                  0
                )
              )
            : '0'
        }
        bg="var(--accent-lime)"
      />
      <StatBlock
        label="MAX CHAIN"
        value={comboStreak > 0 ? `×${comboStreak}` : '—'}
        bg="var(--accent-pink)"
      />
      <StatBlock label="TIME" value="2:18" bg="var(--accent-cyan)" />
    </div>

    <DailyStreakPanel />
  </div>
)

const RightRail: React.FC<{
  score: number
  gameSession: any
  bestScore?: number
}> = ({ score, gameSession, bestScore }) => {
  const { leaderboard } = useLeaderboard()
  const [showShare, setShowShare] = React.useState(false)

  const shareScore = bestScore ?? score

  const rankData = React.useMemo(() => {
    const scores = (leaderboard ?? []).map((e) => e.score).sort((a, b) => b - a)
    const rank =
      scores.findIndex((v) => shareScore >= v) + 1 || scores.length + 1
    return rank
  }, [leaderboard, shareScore])

  const HASHTAGS = `#miniapps #minipay #playblokaz #celo`

  const handleShareTwitter = () => {
    const text = `my best score on @playblokaz is ${shareScore.toLocaleString()} 🎮\nrank #${rankData} on the weekly ladder\n\ncan you beat it? blokaz.xyz\n\n${HASHTAGS}`
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="flex w-full flex-col gap-5">
      <LiveLadder currentScore={score} />
      <DangerWatch currentPieces={gameSession?.currentPieces} />

      {showShare ? (
        <div
          className="border-4 border-ink"
          style={{
            background: 'var(--paper-2)',
            boxShadow: '5px 5px 0 var(--shadow)',
          }}
        >
          <div
            className="flex items-center justify-between border-b-4 border-ink px-3 py-2"
            style={{ background: 'var(--paper)' }}
          >
            <span className="font-display text-[10px] uppercase tracking-[0.18em]">
              SHARE BEST SCORE
            </span>
            <button
              onClick={() => setShowShare(false)}
              className="brutal-btn flex h-7 w-7 items-center justify-center border-2 border-ink text-ink"
              style={{
                background: 'var(--paper-2)',
                boxShadow: '2px 2px 0 var(--shadow)',
              }}
            >
              <BrutalIcon name="back" size={12} strokeWidth={3} />
            </button>
          </div>
          <div className="flex flex-col gap-2 p-3">
            <div
              className="mb-1 border-[3px] border-ink p-2 font-display text-2xl tabular-nums"
              style={{ background: 'var(--paper)', letterSpacing: '-0.03em' }}
            >
              {shareScore.toLocaleString()}
            </div>
            <button
              onClick={handleShareTwitter}
              className="brutal-btn flex w-full items-center justify-between border-4 border-ink px-4 py-3 font-display text-[11px] uppercase tracking-wider shadow-[4px_4px_0_var(--shadow)]"
              style={{ background: 'var(--ink)', color: 'var(--paper)' }}
            >
              <span className="flex items-center gap-2">
                <span
                  className="flex h-5 w-5 items-center justify-center border-2 border-paper text-[9px] font-bold"
                  style={{ background: 'var(--paper)', color: 'var(--ink)' }}
                >
                  X
                </span>
                POST ON X / TWITTER
              </span>
              <span>→</span>
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowShare(true)}
          className="brutal-btn flex w-full items-center justify-between border-4 border-ink bg-accent-lime p-5 font-display text-xs uppercase tracking-[0.2em] shadow-[5px_5px_0_var(--shadow)]"
          style={{ color: 'var(--ink-fixed)' }}
        >
          <span className="flex items-center">
            <BrutalIcon name="rocket" size={16} className="mr-2" /> SHARE BEST
            SCORE
          </span>
          <span className="text-xl">→</span>
        </button>
      )}
    </div>
  )
}

const MobileLayout: React.FC<MobileLayoutProps> = ({
  score,
  comboStreak,
  bestScore,
  gameSession,
  onOpenLeaderboard,
  onBack,
  canvasArea,
}) => {
  const [isPaused, setIsPaused] = useState(false)
  const [showFAQ, setShowFAQ] = useState(false)
  const [showHowToPlay, setShowHowToPlay] = useState(false)

  return (
    <div className="flex w-full flex-col flex-1 min-h-0 overflow-hidden">
      {/* ── FAQ sheet ─────────────────────────────────────────────── */}
      {showFAQ && <FAQSheet onClose={() => setShowFAQ(false)} />}

      {/* ── How to play (re-opened from pause) ────────────────────── */}
      {showHowToPlay && (
        <HowToPlayModal onDone={() => setShowHowToPlay(false)} />
      )}

      {gameSession && (
        <>
          {/* ── Game chrome: back / status / pause ──────────────────── */}
          <div className="flex shrink-0 items-center justify-between border-b-4 border-ink bg-paper px-3 py-1.5">
            <button
              className="brutal-btn border-[3px] border-ink bg-paper p-1.5 text-ink"
              style={{ boxShadow: '2px 2px 0 var(--shadow)' }}
              onClick={onBack ?? (() => window.history.back())}
            >
              <BrutalIcon name="back" size={16} strokeWidth={3} />
            </button>

            {/* centre — intentionally empty */}
            <div />

            <button
              className="brutal-btn border-[3px] border-ink bg-paper p-1.5 text-ink"
              style={{ boxShadow: '2px 2px 0 var(--shadow)' }}
              onClick={() => setIsPaused(true)}
            >
              <BrutalIcon name="pause" size={16} strokeWidth={3} />
            </button>
          </div>

          {/* ── Compact score + tension bar ──────────────────────────── */}
          <div className="shrink-0">
            <ScoreBar
              score={score}
              comboStreak={comboStreak}
              bestScore={bestScore}
              compact
            />
          </div>
        </>
      )}

      {/* ── Canvas fills all remaining vertical space ────────────────── */}
      <div className={`relative flex flex-col min-h-0 flex-1 ${gameSession ? 'overflow-hidden' : 'overflow-auto'}`}>
        {canvasArea}

        {/* ── Pause overlay — sits above canvas, blocks all touch ──── */}
        {isPaused && gameSession && (
          <div
            className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-0"
            style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(4px)' }}
          >
            {/* Header strip */}
            <div
              className="w-full border-b-4 border-ink px-6 py-4 text-center"
              style={{ background: 'var(--ink)' }}
            >
              <div className="flex items-center justify-center gap-3">
                <BrutalIcon name="pause" size={16} strokeWidth={3} className="text-paper" />
                <span className="font-display text-[14px] uppercase tracking-[0.24em] text-paper">
                  PAUSED
                </span>
              </div>
            </div>

            {/* Score snapshot */}
            <div
              className="w-full border-b-4 border-ink px-6 py-3 text-center"
              style={{ background: 'var(--paper-2)' }}
            >
              <div className="font-display text-[10px] uppercase tracking-widest" style={{ color: 'var(--ink-soft)' }}>
                CURRENT SCORE
              </div>
              <div className="font-display text-[2rem] leading-tight tabular-nums" style={{ color: 'var(--ink)', letterSpacing: '-0.04em' }}>
                {score.toLocaleString()}
              </div>
            </div>

            {/* Menu buttons */}
            <div className="flex w-full flex-col" style={{ background: 'var(--paper)' }}>
              {/* Resume */}
              <button
                onClick={() => setIsPaused(false)}
                className="brutal-btn flex items-center justify-between border-b-4 border-ink px-6 py-4 font-display text-[12px] uppercase tracking-[0.14em]"
                style={{ background: 'var(--accent-lime)', color: 'var(--ink-fixed)' }}
              >
                <span className="flex items-center gap-3">
                  <BrutalIcon name="play" size={16} strokeWidth={2.5} />
                  RESUME GAME
                </span>
                <span>→</span>
              </button>

              {/* How to play */}
              <button
                onClick={() => { setIsPaused(false); setShowHowToPlay(true) }}
                className="brutal-btn flex items-center justify-between border-b-4 border-ink px-6 py-4 font-display text-[12px] uppercase tracking-[0.14em]"
                style={{ background: 'var(--paper)', color: 'var(--ink)' }}
              >
                <span className="flex items-center gap-3">
                  <BrutalIcon name="star" size={16} strokeWidth={2.5} />
                  HOW TO PLAY
                </span>
                <span style={{ color: 'var(--ink-soft)' }}>→</span>
              </button>

              {/* Help / FAQ */}
              <button
                onClick={() => { setIsPaused(false); setShowFAQ(true) }}
                className="brutal-btn flex items-center justify-between border-b-4 border-ink px-6 py-4 font-display text-[12px] uppercase tracking-[0.14em]"
                style={{ background: 'var(--paper)', color: 'var(--ink)' }}
              >
                <span className="flex items-center gap-3">
                  <BrutalIcon name="alert" size={16} strokeWidth={2.5} />
                  HELP & FAQ
                </span>
                <span style={{ color: 'var(--ink-soft)' }}>→</span>
              </button>

              {/* Quit */}
              <button
                onClick={onBack ?? (() => window.history.back())}
                className="brutal-btn flex items-center justify-between px-6 py-4 font-display text-[12px] uppercase tracking-[0.14em]"
                style={{ background: 'var(--paper)', color: 'var(--piece-red)' }}
              >
                <span className="flex items-center gap-3">
                  <BrutalIcon name="close" size={16} strokeWidth={2.5} />
                  QUIT GAME
                </span>
                <span style={{ color: 'var(--piece-red)', opacity: 0.5 }}>→</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface DesktopLayoutProps {
  score: number
  comboStreak: number
  gameSession: any
  bestScore?: number
  onOpenLeaderboard?: () => void
  canvasArea: React.ReactNode
}

const DesktopLayout: React.FC<DesktopLayoutProps> = ({
  score,
  comboStreak,
  gameSession,
  bestScore,
  onOpenLeaderboard,
  canvasArea,
}) => (
  <div className="w-full min-h-screen" style={{ background: 'var(--page)' }}>
    <div
      className="mx-auto grid w-full max-w-[1600px] items-start px-10 py-6"
      style={{
        gridTemplateColumns:
          'minmax(250px, 280px) minmax(520px, 1fr) minmax(250px, 280px)',
        gap: 40,
        paddingTop: 124,
      }}
    >
      <div className="col-[1/-1]">
        <ClassicTabStrip onOpenLeaderboard={onOpenLeaderboard} />
      </div>

      <div className="flex min-w-0 flex-col">
        <LeftRail
          score={score}
          comboStreak={comboStreak}
          gameSession={gameSession}
        />
      </div>

      <div
        className="flex flex-col w-full min-w-0"
        style={
          gameSession
            ? { height: 'calc(100vh - 240px)', minHeight: 520 }
            : undefined
        }
      >
        {canvasArea}
      </div>

      <div className="flex min-w-0 flex-col">
        <RightRail
          score={score}
          gameSession={gameSession}
          bestScore={bestScore}
        />
      </div>
    </div>
  </div>
)

export default GameScreen
