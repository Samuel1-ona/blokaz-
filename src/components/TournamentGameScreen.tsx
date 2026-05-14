import React, { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../stores/gameStore'
import { GridRenderer } from '../canvas/GridRenderer'
import { PieceRenderer } from '../canvas/PieceRenderer'
import { TouchController } from '../canvas/TouchController'
import { AnimationManager } from '../canvas/AnimationManager'
import { Grid } from '../engine/grid'
import type { ShapeDefinition } from '../engine/shapes'
import ScoreBar from './ScoreBar'
import GameOverModal from './GameOverModal'
import TournamentLeaderboard from './TournamentLeaderboard'
import NoGasModal from './NoGasModal'
import { ComboOverlay } from './ComboOverlay'
import { BrutalIcon } from './BrutalIcon'
import HowToPlayModal from './HowToPlayModal'
import FAQSheet from './FAQSheet'
import {
  hapticImpact,
  hapticNotification,
  hapticError,
} from '../miniapp/haptics'
import {
  useStartTournamentGame,
  generateGameSeed,
  useActiveTournamentGame,
} from '../hooks/useBlokzGame'
import { requestStartSignature } from '../api/signer'
import { useAccount, useBalance } from 'wagmi'
import { keccak256, encodePacked } from 'viem'
import contractInfo from '../contract.json'
import {
  TOURNAMENT_SESSION_STORAGE_KEY,
  readStoredGameSession,
  writeStoredGameSession,
} from '../utils/gameSessionStorage'
import { IS_MINIPAY } from '../utils/miniPay'

const TOURNAMENT_ADDRESS = contractInfo.tournament as `0x${string}`
const GAS_THRESHOLD = 5_000_000_000_000_000n

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1024 : true
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isMobile
}

interface TournamentGameScreenProps {
  onBackToHall: () => void
}

const TournamentGameScreen: React.FC<TournamentGameScreenProps> = ({
  onBackToHall,
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
    tournamentId,
    setTournamentId,
  } = useGameStore()

  const { address, isConnected } = useAccount()

  // ── Gas detection (mirrors classic) ─────────────────────────────────────────
  const { data: celoBalance } = useBalance({
    address,
    query: { enabled: isConnected && !IS_MINIPAY, refetchInterval: 15_000 },
  })
  const hasNoGas =
    isConnected &&
    !IS_MINIPAY &&
    celoBalance !== undefined &&
    celoBalance.value < GAS_THRESHOLD
  const [noGasDismissed, setNoGasDismissed] = useState(false)
  useEffect(() => {
    if (!hasNoGas) setNoGasDismissed(false)
  }, [hasNoGas])
  const showNoGasModal = hasNoGas && !noGasDismissed

  const {
    gameId: onChainActiveGameId,
    isLoading: isLoadingActiveGame,
    refetch: refetchActiveGame,
  } = useActiveTournamentGame(address)
  const {
    startTournamentGame: contractStartTournamentGame,
    isPending,
    isConfirming,
    isSuccess,
    error: contractError,
  } = useStartTournamentGame()

  const [currentSeed, setCurrentSeed] = useState<{
    seed: `0x${string}`
    hash: `0x${string}`
  } | null>(null)
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false)
  const [isSyncingContract, setIsSyncingContract] = useState(true)
  const [sessionConflict, setSessionConflict] = useState(false)
  const [signerError, setSignerError] = useState<string | null>(null)
  const [comboTrigger, setComboTrigger] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [showFAQ, setShowFAQ] = useState(false)
  const [showHowToPlay, setShowHowToPlay] = useState(false)
  const [canvasDims, setCanvasDims] = useState<{
    gridSize: number
    trayY: number
    trayH: number
  } | null>(null)
  const isMobile = useIsMobile()

  // ── Account switch protection ────────────────────────────────────────────────
  const lastAddressRef = useRef<`0x${string}` | undefined>(address)
  useEffect(() => {
    if (address !== lastAddressRef.current) {
      forceReset()
      lastAddressRef.current = address
    }
  }, [address, forceReset])

  // ── Hydration & Reconciliation ───────────────────────────────────────────────
  useEffect(() => {
    if (!isConnected || !address || isLoadingActiveGame) return

    const storedSession = readStoredGameSession(
      TOURNAMENT_SESSION_STORAGE_KEY,
      address,
      TOURNAMENT_ADDRESS
    )
    const contractActiveId = (onChainActiveGameId as bigint) || 0n

    if (contractActiveId !== 0n) {
      if (
        storedSession &&
        (storedSession.gameId === contractActiveId.toString() ||
          !storedSession.gameId)
      ) {
        setOnChainData(contractActiveId, storedSession.seed, 'none')
        setSessionConflict(false)
      } else {
        setSessionConflict(true)
      }
    } else {
      if (storedSession) setOnChainData(0n, null, 'none')
      setSessionConflict(false)
    }

    setIsSyncingContract(false)
  }, [isConnected, address, isLoadingActiveGame, onChainActiveGameId, setOnChainData])

  // ── Restore tournamentId from storage ───────────────────────────────────────
  useEffect(() => {
    if (!isConnected || !address) return
    const storedSession = readStoredGameSession(
      TOURNAMENT_SESSION_STORAGE_KEY,
      address,
      TOURNAMENT_ADDRESS
    )
    if (storedSession?.tournamentId && !tournamentId) {
      setTournamentId(BigInt(storedSession.tournamentId))
    }
  }, [isConnected, address, setTournamentId, tournamentId])

  // ── Redirect if no tournament selected ──────────────────────────────────────
  useEffect(() => {
    if (tournamentId === null) {
      onBackToHall()
    }
  }, [tournamentId, onBackToHall])

  // ── Contract tx rejection → back to hall ────────────────────────────────────
  useEffect(() => {
    if (!contractError) return
    const msg = (contractError as any)?.message?.toLowerCase() ?? ''
    const isRejection =
      msg.includes('rejected') ||
      msg.includes('denied') ||
      msg.includes('cancelled') ||
      (contractError as any)?.code === 4001
    if (isRejection) {
      forceReset()
      onBackToHall()
    }
  }, [contractError, forceReset, onBackToHall])

  // ── Handle Start ─────────────────────────────────────────────────────────────
  const handleStartGame = async () => {
    if (!isConnected || !address) return

    const freshState = useGameStore.getState()
    const { onChainSeed: latestSeed, onChainGameId: latestGameId } = freshState

    if (latestSeed && latestGameId && latestGameId !== 0n) {
      const localSeed = BigInt(
        keccak256(
          encodePacked(['bytes32', 'address'], [latestSeed, address])
        ).slice(0, 18)
      )
      startGame(localSeed, true)
      return
    }

    const { seed, hash } = generateGameSeed(address)
    const localSeed = BigInt(hash.slice(0, 18))
    startGame(localSeed)

    setCurrentSeed({ seed, hash })
    setOnChainData(0n, seed, 'pending')

    writeStoredGameSession(TOURNAMENT_SESSION_STORAGE_KEY, {
      address,
      seed,
      hash,
      gameId: null,
      tournamentId: tournamentId?.toString(),
      contractAddress: TOURNAMENT_ADDRESS,
    })

    setSignerError(null)
    try {
      const { signature, nonce, deadline } = await requestStartSignature(
        tournamentId!,
        hash,
        address
      )
      contractStartTournamentGame(tournamentId!, hash, nonce, deadline, signature)
    } catch (err) {
      console.error('Failed to get start signature:', err)
      hapticError()
      setSignerError(
        'Could not reach signing server. Check your connection and try again.'
      )
    }
  }

  // ── Background sync for game ID ──────────────────────────────────────────────
  useEffect(() => {
    if (isSuccess && currentSeed && address) {
      setOnChainData(0n, currentSeed.seed, 'syncing')

      const timer = setInterval(async () => {
        const res = await refetchActiveGame()
        const newGameId = res.data as bigint
        if (newGameId && newGameId !== 0n) {
          setOnChainData(newGameId, currentSeed.seed, 'registered')
          writeStoredGameSession(TOURNAMENT_SESSION_STORAGE_KEY, {
            address,
            seed: currentSeed.seed,
            hash: currentSeed.hash,
            gameId: newGameId.toString(),
            tournamentId: tournamentId?.toString(),
            contractAddress: TOURNAMENT_ADDRESS,
          })
          clearInterval(timer)
        }
      }, 2000)

      return () => clearInterval(timer)
    }
  }, [address, currentSeed, isSuccess, refetchActiveGame, setOnChainData, tournamentId])

  // ── Canvas setup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current || !gameSession) return

    const canvas = canvasRef.current
    const vpFallback = Math.min(
      window.innerWidth - 32,
      Math.round(window.innerHeight * 0.72)
    )

    const computeDims = (containerWidth: number, containerHeight = 0) => {
      let gridSize = containerWidth > 0 ? containerWidth : vpFallback
      if (containerHeight > 0) {
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
        const result = useGameStore.getState().placePiece(pieceIndex, row, col)
        if (!result?.success) {
          hapticError()
          return
        }
        hapticImpact()
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
        // Persist move history
        const updatedSession = useGameStore.getState().gameSession
        if (updatedSession) {
          const raw = localStorage.getItem(TOURNAMENT_SESSION_STORAGE_KEY)
          if (raw) {
            try {
              const entry = JSON.parse(raw)
              entry.snapshot = { moveHistory: updatedSession.moveHistory }
              localStorage.setItem(
                TOURNAMENT_SESSION_STORAGE_KEY,
                JSON.stringify(entry)
              )
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
      let ghostCells: { row: number; col: number; valid: boolean }[] | undefined

      if (ghost && dragState.isDragging && dragState.dragIndex !== null) {
        const shape = currentSession.currentPieces[dragState.dragIndex]
        if (shape) {
          ghostCells = shape.cells
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

      gridRenderer.draw(currentSession.grid, ghostCells, true)
      pieceRenderer.drawTray(
        currentSession.currentPieces,
        dragState.isDragging && dragState.dragIndex !== null
          ? dragState.dragIndex
          : undefined,
        true,
        dragState.isDragging ? undefined : (trayHoverIndexRef.current ?? undefined)
      )

      if (dragState.isDragging && dragState.dragIndex !== null) {
        const shape = currentSession.currentPieces[dragState.dragIndex]
        if (shape) {
          pieceRenderer.drawDragging(
            shape,
            dragState.dragPos.x,
            dragState.dragPos.y,
            cellSizeRef.current,
            true
          )
        }
      }

      animManager.draw(ctx, cellSizeRef.current, true)
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

  // ── On-chain sync chip ───────────────────────────────────────────────────────
  const syncChip = gameSession ? (
    onChainStatus === 'pending' || isPending || isConfirming ? (
      <div
        className="flex items-center gap-1.5 border-2 border-ink px-2 py-1 font-display text-[9px] uppercase tracking-[0.12em]"
        style={{
          background: 'var(--accent-yellow)',
          color: 'var(--ink-fixed)',
          boxShadow: '2px 2px 0 var(--shadow)',
        }}
      >
        <div className="h-1.5 w-1.5 animate-pulse bg-ink" />
        REGISTERING
      </div>
    ) : onChainStatus === 'syncing' ? (
      <div
        className="flex items-center gap-1.5 border-2 border-ink px-2 py-1 font-display text-[9px] uppercase tracking-[0.12em]"
        style={{
          background: 'var(--accent-cyan)',
          color: 'var(--ink-fixed)',
          boxShadow: '2px 2px 0 var(--shadow)',
        }}
      >
        <div className="brutal-loader" />
        SYNCING
      </div>
    ) : onChainStatus === 'registered' ? (
      <div
        className="flex items-center gap-1.5 border-2 border-ink px-2 py-1 font-display text-[9px] uppercase tracking-[0.12em]"
        style={{
          background: 'var(--accent-lime)',
          color: 'var(--ink-fixed)',
          boxShadow: '2px 2px 0 var(--shadow)',
        }}
      >
        <div className="h-1.5 w-1.5 bg-ink" />
        VERIFIED
      </div>
    ) : null
  ) : null

  // ── Canvas board area ────────────────────────────────────────────────────────
  const boardArea = (
    <div
      ref={boardContainerRef}
      className="flex min-h-0 flex-1 select-none items-center justify-center p-3"
    >
      <div className="relative inline-flex flex-col">
        {canvasDims && (
          <>
            <div
              className="pointer-events-none absolute left-0 top-0 border-[4px] border-ink"
              style={{
                background: 'var(--board)',
                width: canvasDims.gridSize,
                height: canvasDims.gridSize,
                boxShadow: '8px 8px 0 var(--shadow)',
              }}
            />
            <div
              className="pointer-events-none absolute left-0 z-[1] grid grid-cols-3 border-[3px] border-ink"
              style={{
                background: 'var(--piece-tray-bg)',
                top: canvasDims.trayY,
                width: canvasDims.gridSize,
                height: canvasDims.trayH,
                boxShadow: '6px 6px 0 var(--shadow)',
              }}
            >
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-center border-r-[3px] last:border-r-0"
                  style={{ borderColor: 'var(--rule)' }}
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
          <div className="pointer-events-none absolute right-2 top-2 z-30">
            {syncChip}
          </div>
          <ComboOverlay streak={comboStreak} trigger={comboTrigger} />
          {isGameOver && (
            <GameOverModal
              score={score}
              onPlayAgain={handleStartGame}
              onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
              mode="tournament"
            />
          )}
        </div>
      </div>
    </div>
  )

  // ── Start / ready screen ─────────────────────────────────────────────────────
  const startCard = (
    <div className="z-10 flex flex-1 items-center justify-center overflow-auto p-4">
      <div
        className="w-full max-w-xs border-4 border-ink bg-paper p-8 text-center"
        style={{ boxShadow: '8px 8px 0 var(--shadow)' }}
      >
        <div
          className="mb-4 inline-block border-4 border-ink bg-accent-yellow px-4 py-1 font-display text-[11px] tracking-[0.14em]"
          style={{
            transform: 'rotate(-3deg)',
            boxShadow: '4px 4px 0 var(--shadow)',
            color: 'var(--ink-fixed)',
          }}
        >
          TOURNAMENT MODE
        </div>
        <h2
          className="mb-2 font-display text-[42px] leading-[0.9]"
          style={{ letterSpacing: '-0.04em' }}
        >
          READY FOR{' '}
          <span
            style={{
              color: 'var(--danger)',
              WebkitTextStroke: '1px var(--ink)',
              display: 'inline-block',
              transform: 'rotate(-2deg)',
            }}
          >
            GLORY?
          </span>
        </h2>
        <p className="mb-8 font-display text-[10px] uppercase leading-relaxed tracking-[0.16em] text-ink/60">
          You are about to enter a competitive match. Your final score will be
          recorded on the leaderboard.
        </p>

        <button
          onClick={handleStartGame}
          disabled={isPending || isConfirming || isSyncingContract || sessionConflict}
          className="brutal-btn w-full border-4 border-ink bg-accent-lime py-4 font-display text-sm uppercase tracking-[0.14em] disabled:opacity-50"
          style={{ boxShadow: '6px 6px 0 var(--shadow)', color: 'var(--ink-fixed)' }}
        >
          {isSyncingContract ? (
            <div className="flex items-center justify-center gap-2">
              <div className="brutal-loader" />
              SYNCING...
            </div>
          ) : sessionConflict ? (
            'SESSION CONFLICT'
          ) : isPending || isConfirming ? (
            'PREPARING...'
          ) : (
            'COMMENCE MATCH'
          )}
        </button>

        {(signerError || (contractError && !isPending && !isConfirming)) && (
          <div className="mt-3 border-[3px] border-danger bg-paper-2 px-3 py-2 text-left">
            <div className="mb-1 font-display text-[9px] uppercase tracking-[0.12em] text-danger">
              COULDN'T START YOUR GAME
            </div>
            <p className="mb-2 font-body text-[10px] leading-relaxed text-ink/70">
              {signerError ??
                (contractError?.message?.slice(0, 120) ??
                  'Transaction failed — check your wallet')}
            </p>
            <button
              onClick={handleStartGame}
              disabled={isPending || isConfirming}
              className="brutal-btn flex w-full items-center justify-center gap-2 border-[3px] border-ink py-2 font-display text-[10px] uppercase tracking-wider disabled:opacity-50"
              style={{
                background: 'var(--accent-yellow)',
                color: 'var(--ink-fixed)',
                boxShadow: '3px 3px 0 var(--shadow)',
              }}
            >
              {isPending || isConfirming ? (
                <div className="brutal-loader" />
              ) : (
                <BrutalIcon name="play" size={12} strokeWidth={2.5} />
              )}
              TRY AGAIN
            </button>
          </div>
        )}

        <button
          onClick={onBackToHall}
          className="mt-4 w-full border-2 border-ink py-2 font-display text-[9px] uppercase tracking-[0.14em] text-ink/60"
        >
          BACK TO HALL
        </button>

        <button
          onClick={() => setShowHowToPlay(true)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 font-display text-[10px] uppercase tracking-widest opacity-50 transition-opacity hover:opacity-100"
          style={{ color: 'var(--ink)' }}
        >
          <BrutalIcon name="alert" size={10} strokeWidth={2} />
          HOW TO PLAY
        </button>
      </div>

      {/* Session conflict modal */}
      {sessionConflict && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center px-5">
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
          />
          <div
            className="relative w-full max-w-sm border-4 border-ink"
            style={{ background: 'var(--paper)', boxShadow: '8px 8px 0 var(--danger)' }}
          >
            <div
              className="flex items-center gap-3 border-b-4 border-ink px-5 py-4"
              style={{ background: 'var(--danger)' }}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center border-[3px] border-white">
                <BrutalIcon name="alert" size={18} strokeWidth={3} className="text-white" />
              </div>
              <div>
                <div className="font-display text-[13px] uppercase tracking-[0.14em] text-white">
                  SESSION CONFLICT
                </div>
                <div className="font-body text-[10px] text-white opacity-75">
                  Action required
                </div>
              </div>
            </div>
            <div className="px-5 py-5">
              <p
                className="mb-5 font-body text-[13px] leading-relaxed"
                style={{ color: 'var(--ink-soft)' }}
              >
                An active session exists on-chain that doesn't match your local
                record. Reset to start a fresh match.
              </p>
              <button
                onClick={() => {
                  forceReset()
                  setSessionConflict(false)
                }}
                className="brutal-btn flex w-full items-center justify-center gap-2 border-[3px] border-ink py-3.5 font-display text-[12px] uppercase tracking-widest text-white"
                style={{
                  background: 'var(--danger)',
                  boxShadow: '4px 4px 0 rgba(0,0,0,0.3)',
                }}
              >
                <BrutalIcon name="alert" size={14} strokeWidth={2.5} />
                RESET &amp; START FRESH
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // ── Shared modals ────────────────────────────────────────────────────────────
  const sharedModals = (
    <>
      {showFAQ && <FAQSheet onClose={() => setShowFAQ(false)} />}
      {showHowToPlay && (
        <HowToPlayModal onDone={() => setShowHowToPlay(false)} />
      )}
      {showNoGasModal && (
        <NoGasModal address={address} onDismiss={() => setNoGasDismissed(true)} />
      )}
      <TournamentLeaderboard
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
        tournamentId={tournamentId}
      />
    </>
  )

  // ── Mobile layout (same structure as classic MobileLayout) ──────────────────
  if (isMobile) {
    return (
      <div className="brutal-grid-bg flex h-screen select-none flex-col overflow-hidden bg-paper text-ink">
        {sharedModals}

        {gameSession && (
          <>
            {/* Game chrome: back / sync / pause */}
            <div className="flex shrink-0 items-center justify-between border-b-4 border-ink bg-paper px-3 py-1.5">
              <button
                className="brutal-btn border-[3px] border-ink bg-paper p-1.5 text-ink"
                style={{ boxShadow: '2px 2px 0 var(--shadow)' }}
                onClick={onBackToHall}
              >
                <BrutalIcon name="back" size={16} strokeWidth={3} />
              </button>

              <div className="flex items-center gap-2">
                {syncChip}
                <button
                  onClick={() => setIsLeaderboardOpen(true)}
                  className="brutal-btn border-[3px] border-ink px-2 py-1.5 font-display text-[9px] uppercase tracking-[0.14em]"
                  style={{
                    background: 'var(--accent-cyan)',
                    boxShadow: '2px 2px 0 var(--shadow)',
                    color: 'var(--ink-fixed)',
                  }}
                >
                  RANKS
                </button>
              </div>

              <button
                className="brutal-btn border-[3px] border-ink bg-paper p-1.5 text-ink"
                style={{ boxShadow: '2px 2px 0 var(--shadow)' }}
                onClick={() => setIsPaused(true)}
              >
                <BrutalIcon name="pause" size={16} strokeWidth={3} />
              </button>
            </div>

            {/* Compact score bar */}
            <div className="shrink-0">
              <ScoreBar
                score={score}
                comboStreak={comboStreak}
                tournamentId={tournamentId}
                compact
              />
            </div>
          </>
        )}

        {/* Board or start screen */}
        <div
          className={`relative flex min-h-0 flex-1 flex-col ${
            gameSession ? 'overflow-hidden' : 'overflow-auto'
          }`}
        >
          {gameSession ? boardArea : startCard}

          {/* Pause overlay */}
          {isPaused && gameSession && (
            <div
              className="absolute inset-0 z-50 flex flex-col items-center justify-center"
              style={{
                background: 'rgba(0,0,0,0.82)',
                backdropFilter: 'blur(4px)',
              }}
            >
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

              <div
                className="w-full border-b-4 border-ink px-6 py-3 text-center"
                style={{ background: 'var(--paper-2)' }}
              >
                <div
                  className="font-display text-[10px] uppercase tracking-widest"
                  style={{ color: 'var(--ink-soft)' }}
                >
                  CURRENT SCORE
                </div>
                <div
                  className="font-display text-[2rem] leading-tight tabular-nums"
                  style={{ color: 'var(--ink)', letterSpacing: '-0.04em' }}
                >
                  {score.toLocaleString()}
                </div>
                <div
                  className="font-display text-[9px] uppercase tracking-[0.14em] opacity-60"
                  style={{ marginTop: 2 }}
                >
                  BRACKET #{tournamentId?.toString()}
                </div>
              </div>

              <div className="flex w-full flex-col" style={{ background: 'var(--paper)' }}>
                <button
                  onClick={() => setIsPaused(false)}
                  className="brutal-btn flex items-center justify-between border-b-4 border-ink px-6 py-4 font-display text-[12px] uppercase tracking-[0.14em]"
                  style={{ background: 'var(--accent-lime)', color: 'var(--ink-fixed)' }}
                >
                  <span className="flex items-center gap-3">
                    <BrutalIcon name="play" size={16} strokeWidth={2.5} />
                    RESUME MATCH
                  </span>
                  <span>→</span>
                </button>

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

                <button
                  onClick={() => { setIsPaused(false); setShowFAQ(true) }}
                  className="brutal-btn flex items-center justify-between border-b-4 border-ink px-6 py-4 font-display text-[12px] uppercase tracking-[0.14em]"
                  style={{ background: 'var(--paper)', color: 'var(--ink)' }}
                >
                  <span className="flex items-center gap-3">
                    <BrutalIcon name="alert" size={16} strokeWidth={2.5} />
                    HELP &amp; FAQ
                  </span>
                  <span style={{ color: 'var(--ink-soft)' }}>→</span>
                </button>

                <button
                  onClick={onBackToHall}
                  className="brutal-btn flex items-center justify-between px-6 py-4 font-display text-[12px] uppercase tracking-[0.14em]"
                  style={{ background: 'var(--paper)', color: 'var(--piece-red)' }}
                >
                  <span className="flex items-center gap-3">
                    <BrutalIcon name="close" size={16} strokeWidth={2.5} />
                    QUIT TO HALL
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

  // ── Desktop layout ───────────────────────────────────────────────────────────
  return (
    <div className="brutal-grid-bg min-h-screen w-full select-none bg-paper text-ink">
      {sharedModals}

      {/* Fixed top bar */}
      <div
        className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b-4 border-ink bg-paper px-6 py-3"
        style={{ boxShadow: '0 4px 0 var(--shadow)' }}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={onBackToHall}
            className="brutal-btn flex items-center gap-2 border-[3px] border-ink px-3 py-2 font-display text-[10px] uppercase tracking-[0.14em]"
            style={{
              background: 'var(--paper-2)',
              boxShadow: '3px 3px 0 var(--shadow)',
            }}
          >
            <BrutalIcon name="back" size={12} strokeWidth={3} />
            BACK TO HALL
          </button>

          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center border-4 border-ink font-display text-base"
              style={{
                background: 'var(--accent-pink)',
                boxShadow: '3px 3px 0 var(--shadow)',
                color: 'var(--ink-fixed)',
              }}
            >
              T
            </div>
            <div>
              <div
                className="font-display text-[9px] uppercase tracking-[0.2em]"
                style={{ color: 'var(--label)' }}
              >
                TOURNAMENT MATCH
              </div>
              <div
                className="font-display text-sm"
                style={{ letterSpacing: '-0.03em' }}
              >
                BRACKET #{tournamentId?.toString()}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {syncChip}
          <button
            onClick={() => setIsLeaderboardOpen(true)}
            className="brutal-btn border-[3px] border-ink px-3 py-2 font-display text-[9px] uppercase tracking-[0.14em]"
            style={{
              background: 'var(--accent-cyan)',
              boxShadow: '3px 3px 0 var(--shadow)',
              color: 'var(--ink-fixed)',
            }}
          >
            RANKS
          </button>
        </div>
      </div>

      {/* Main content */}
      <div
        className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center"
        style={{ paddingTop: 80, minHeight: '100vh' }}
      >
        {gameSession ? boardArea : startCard}
      </div>
    </div>
  )
}

export default TournamentGameScreen
