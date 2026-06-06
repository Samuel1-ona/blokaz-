import React, { useMemo } from 'react'
import { useGameStore } from '../stores/gameStore'
import { usePowerUpStore } from '../stores/powerUpStore'
import { useStablecoinRevive } from '../hooks/useStablecoinRevive'
import {
  STABLECOIN_TOKENS,
  type StablecoinSymbol,
} from '../constants/contracts'
import { packMoves } from '../engine/replay'
import {
  useSubmitScore,
  useActiveGame,
  useActiveTournamentGame,
  useLeaderboard,
  useSubmitTournamentScore,
} from '../hooks/useBlokzGame'
import { useAccount, useReadContract } from 'wagmi'
import { BLOKZ_GAME_ABI, BLOKZ_TOURNAMENT_ABI } from '../constants/abi'
import contractInfo from '../contract.json'
import { requestSubmitSignature } from '../api/signer'
import { keccak256, encodePacked } from 'viem'
import {
  CLASSIC_SESSION_STORAGE_KEY,
  TOURNAMENT_SESSION_STORAGE_KEY,
  clearStoredGameSession,
  readStoredGameSession,
} from '../utils/gameSessionStorage'
import { BrutalIcon } from './BrutalIcon'
import { IS_MINIPAY } from '../utils/miniPay'

const MINIPAY_DEPOSIT_URL = 'https://minipay.opera.com/add_cash'

const GAME_ADDRESS = contractInfo.game as `0x${string}`
const TOURNAMENT_ADDRESS = contractInfo.tournament as `0x${string}`

interface GameOverModalProps {
  score: number
  onPlayAgain: () => void
  onBack?: () => void
  mode: 'classic' | 'tournament'
  onOpenLeaderboard?: () => void
}

const EMPTY_HASH =
  '0x0000000000000000000000000000000000000000000000000000000000000000'

const GameOverModal: React.FC<GameOverModalProps> = ({
  score,
  onPlayAgain,
  onBack,
  mode,
  onOpenLeaderboard,
}) => {
  const { address } = useAccount()
  // Each contract tracks its own activeGame mapping — use the right one per mode
  const { gameId: classicActiveGameId, isLoading: isLoadingClassicGameId } =
    useActiveGame(mode === 'classic' ? address : undefined)
  const {
    gameId: tournamentActiveGameId,
    isLoading: isLoadingTournamentGameId,
  } = useActiveTournamentGame(mode === 'tournament' ? address : undefined)
  const activeGameId =
    mode === 'tournament' ? tournamentActiveGameId : classicActiveGameId
  const isLoadingGameId =
    mode === 'tournament' ? isLoadingTournamentGameId : isLoadingClassicGameId
  const { leaderboard } = useLeaderboard()
  const {
    gameSession,
    onChainSeed,
    onChainGameId,
    onChainStatus,
    forceReset,
    tournamentId,
    setTournamentId,
    comboStreak,
    reviveGame,
  } = useGameStore()

  const {
    balances: stableBalances,
    canAfford,
    hasAnyBalance: hasStableBalance,
    defaultToken,
    isPaying: isStablePaying,
    error: stableError,
    payForRevive,
    getReviveCost,
    reviveCount,
  } = useStablecoinRevive()

  const [selectedToken, setSelectedToken] =
    React.useState<StablecoinSymbol>(defaultToken)

  const { inventory, consumeCharge } = usePowerUpStore()
  const bundleCredits = inventory.revivalBundle

  const handleBundleRevive = () => {
    setCountdown(null)
    autoSubmitTriggeredRef.current = true
    if (consumeCharge('revivalBundle')) reviveGame()
  }

  const handleStableRevive = async () => {
    setCountdown(null)
    autoSubmitTriggeredRef.current = true // prevent auto-submit after revival
    await payForRevive(selectedToken)
  }

  const [showShareSheet, setShowShareSheet] = React.useState(false)
  const [countdown, setCountdown] = React.useState<number | null>(null)
  const [signerError, setSignerError] = React.useState<string | null>(null)
  const autoSubmitTriggeredRef = React.useRef(false)

  const { submitScore, isPending, isConfirming, isSuccess, error } =
    useSubmitScore()
  const {
    submitTournamentScore,
    isPending: isToursPending,
    isConfirming: isToursConfirming,
    isSuccess: isToursSuccess,
    error: toursError,
  } = useSubmitTournamentScore()
  const storageKey =
    mode === 'tournament'
      ? TOURNAMENT_SESSION_STORAGE_KEY
      : CLASSIC_SESSION_STORAGE_KEY
  const isTournamentMode = mode === 'tournament' && tournamentId !== null

  const effectiveGameId = onChainGameId || activeGameId

  // Classic games live in GAME_ADDRESS; tournament games in TOURNAMENT_ADDRESS.
  // Both hooks are always called (Rules of Hooks), but only the relevant one is enabled.
  const { data: classicGameData, isLoading: isLoadingClassicContract } =
    useReadContract({
      address: GAME_ADDRESS,
      abi: BLOKZ_GAME_ABI,
      functionName: 'games',
      args: effectiveGameId ? [effectiveGameId] : undefined,
      query: { enabled: mode === 'classic' && !!effectiveGameId },
    })
  const { data: tournamentGameData, isLoading: isLoadingTournamentContract } =
    useReadContract({
      address: TOURNAMENT_ADDRESS,
      abi: BLOKZ_TOURNAMENT_ABI,
      functionName: 'games',
      args: effectiveGameId ? [effectiveGameId] : undefined,
      query: { enabled: mode === 'tournament' && !!effectiveGameId },
    })
  const gameData = mode === 'tournament' ? tournamentGameData : classicGameData
  const isLoadingContract =
    mode === 'tournament'
      ? isLoadingTournamentContract
      : isLoadingClassicContract

  const recoveredSeed = useMemo(() => {
    if (onChainSeed) return onChainSeed
    if (!address) return null
    const contractAddr =
      mode === 'tournament' ? TOURNAMENT_ADDRESS : GAME_ADDRESS
    return (
      readStoredGameSession(storageKey, address, contractAddr)?.seed ?? null
    )
  }, [address, onChainSeed, storageKey, mode])

  const onChainHash = useMemo(() => {
    if (!gameData) return null
    const txData = gameData as { seedHash?: `0x${string}` } & readonly unknown[]
    // Named field works for both contracts; index fallback differs:
    // classic struct: [player, seedHash, ...] → index 1
    // tournament struct: [player, tournamentId, seedHash, ...] → index 2
    const indexFallback = mode === 'tournament' ? txData[2] : txData[1]
    return (txData.seedHash ?? indexFallback ?? null) as `0x${string}` | null
  }, [gameData, mode])

  const isSeedMatch = useMemo(() => {
    if (!recoveredSeed || !address) return false
    if (!gameData) return false
    const expectedHash = keccak256(
      encodePacked(['bytes32', 'address'], [recoveredSeed, address])
    )
    if (!onChainHash) return false
    console.log('--- Submission Pre-flight Check ---')
    console.log('Match Result:', expectedHash === onChainHash)
    return expectedHash === onChainHash
  }, [recoveredSeed, address, effectiveGameId, gameData, onChainHash])

  const isLoading = isLoadingGameId || isLoadingContract

  const resetForNextGame = () => {
    const activeTournamentId = tournamentId
    clearStoredGameSession(storageKey)
    forceReset()
    if (mode === 'tournament' && activeTournamentId !== null)
      setTournamentId(activeTournamentId)
  }

  const handleAbandon = () => {
    resetForNextGame()
    onPlayAgain()
  }

  const handleSubmit = async () => {
    if (!gameSession || !recoveredSeed || !effectiveGameId) return
    if (isRegistering || isAllSuccess) return
    // Filter out marker records (revive, bomb, lottery) — they have pieceIndex: -1.
    // Packing a negative pieceIndex produces a negative BigInt which corrupts the
    // packed word and causes the ABI encoder to throw before the tx is sent.
    const realMoves = gameSession.moveHistory.filter(m => m.pieceIndex >= 0)
    const packed = packMoves(realMoves)
    if (isTournamentMode) {
      setSignerError(null)
      try {
        const { signature, deadline } = await requestSubmitSignature(
          tournamentId!,
          effectiveGameId!,
          gameSession.score,
          gameSession.moveHistory,
          recoveredSeed,
          address!
        )
        submitTournamentScore(
          tournamentId!,
          effectiveGameId!,
          gameSession.score,
          deadline,
          signature
        )
      } catch (err) {
        console.error('Failed to get submission signature:', err)
        setSignerError(
          'Could not reach signing server — tap retry to try again.'
        )
      }
    } else {
      submitScore(
        effectiveGameId,
        recoveredSeed,
        packed,
        gameSession.score,
        realMoves.length
      )
    }
  }

  const isRegistering =
    isPending || isConfirming || isToursPending || isToursConfirming
  const isSyncing = onChainStatus === 'pending' || onChainStatus === 'syncing'
  const isAllSuccess = isSuccess || isToursSuccess
  const hasError = error || toursError
  // Button is enabled as soon as we have a game ID — seed verification is
  // enforced by the contract. On MiniPay wagmi's isSuccess may never fire,
  // so we don't gate on isSeedMatch or onChainStatus here.
  const canSubmit =
    !isRegistering &&
    !isAllSuccess &&
    !!gameSession &&
    !!recoveredSeed &&
    !!effectiveGameId

  // Human-readable reason when the submit button is blocked
  const submitBlockReason: string | null = (() => {
    if (isAllSuccess || isRegistering) return null
    if (!gameSession) return 'Game session not found — start a new game'
    if (!effectiveGameId) return 'Game not registered on-chain — start a new game'
    if (!recoveredSeed) return 'Game seed unavailable — start a new game'
    return null
  })()

  // Total stablecoin balance across all tokens (USD value)
  const totalStableUsd = (Object.keys(STABLECOIN_TOKENS) as StablecoinSymbol[]).reduce((sum, sym) => {
    return sum + Number(stableBalances[sym]) / 10 ** STABLECOIN_TOKENS[sym].decimals
  }, 0)

  // Detect insufficient-funds errors from wagmi/MiniPay
  const rawErrorMsg = (hasError as any)?.message ?? (typeof hasError === 'string' ? hasError : '')
  const isInsufficientFunds =
    /insufficient funds/i.test(rawErrorMsg) ||
    /not enough/i.test(rawErrorMsg) ||
    /exceeds.*(balance|allowance)/i.test(rawErrorMsg) ||
    (!!hasError && totalStableUsd < 0.09)

  // Parse raw wagmi/viem errors into a player-friendly message
  const friendlyError = (() => {
    if (!hasError) return null
    if (isInsufficientFunds) return null  // handled by its own UI block below
    if (/user rejected/i.test(rawErrorMsg) || /denied/i.test(rawErrorMsg))
      return 'Transaction cancelled — tap retry to try again.'
    if (/nonce/i.test(rawErrorMsg))
      return 'Transaction conflict — please retry.'
    if (/network|timeout|fetch/i.test(rawErrorMsg))
      return 'Network issue — check your connection and retry.'
    return 'Something went wrong — tap retry to try again.'
  })()

  React.useEffect(() => {
    if (isAllSuccess) {
      clearStoredGameSession(storageKey)
    }
  }, [isAllSuccess, storageKey])

  // Start countdown once we have everything needed to submit (5s tournament, 10s classic)
  React.useEffect(() => {
    if (!canSubmit || isRegistering || isAllSuccess) return
    if (countdown !== null) return
    setCountdown(isTournamentMode ? 5 : 10)
  }, [isTournamentMode, canSubmit, isRegistering, isAllSuccess])

  // Tick the countdown down each second
  React.useEffect(() => {
    if (countdown === null || countdown <= 0) return
    const t = setTimeout(
      () => setCountdown((c) => (c !== null && c > 0 ? c - 1 : c)),
      1000
    )
    return () => clearTimeout(t)
  }, [countdown])

  // Auto-submit when countdown reaches 0
  React.useEffect(() => {
    if (
      countdown === 0 &&
      canSubmit &&
      !isRegistering &&
      !isAllSuccess &&
      !autoSubmitTriggeredRef.current
    ) {
      autoSubmitTriggeredRef.current = true
      handleSubmit()
    }
  }, [countdown])

  // On submission error: reset so user can retry manually
  React.useEffect(() => {
    if (hasError) {
      autoSubmitTriggeredRef.current = false
      setCountdown(null)
    }
  }, [hasError])

  const shadowColor = isTournamentMode
    ? 'var(--accent-pink)'
    : 'var(--game-over-shadow)'
  const accentTextColor = 'var(--ink-fixed)'
  const stats = useMemo(() => {
    const moves = gameSession?.moveHistory ?? []
    const linesCleared = moves.reduce(
      (sum, move) => sum + (move.scoreEvent?.linesCleared ?? 0),
      0
    )
    const bestCombo = moves.reduce(
      (best, move) => Math.max(best, move.scoreEvent?.newComboStreak ?? 0),
      comboStreak
    )
    const estimatedSeconds = moves.length * 7
    const minutes = Math.floor(estimatedSeconds / 60)
    const seconds = estimatedSeconds % 60
    return {
      linesCleared,
      bestCombo,
      piecesPlaced: moves.length,
      time: `${minutes}:${seconds.toString().padStart(2, '0')}`,
    }
  }, [comboStreak, gameSession?.moveHistory])

  const rankData = useMemo(() => {
    const scores = (leaderboard ?? [])
      .map((entry) => entry.score)
      .sort((a, b) => b - a)
    const currentRank =
      scores.findIndex((value) => score >= value) + 1 || scores.length + 1
    const nextTarget = scores.find((value) => value > score) ?? score
    const lowerScores = scores.filter((value) => value <= score)
    const prevTarget =
      lowerScores.length > 0 ? lowerScores[lowerScores.length - 1] : 0
    const progressBase =
      nextTarget === prevTarget
        ? 100
        : ((score - prevTarget) / Math.max(1, nextTarget - prevTarget)) * 100
    return {
      currentRank,
      nextTarget,
      progress: Math.max(
        8,
        Math.min(100, Number.isFinite(progressBase) ? progressBase : 8)
      ),
      delta: Math.max(0, nextTarget - score),
    }
  }, [leaderboard, score])

  const buildBoardEmoji = (grid: Uint8Array): string => {
    const EMOJI = ['⬛', '🟦', '🟥', '🟩', '🟨', '🟪', '🟧', '🟫', '⬜', '🔴']
    const SIZE = 9
    const rows: string[] = []
    for (let r = 0; r < SIZE; r++) {
      let row = ''
      for (let c = 0; c < SIZE; c++) {
        const cell = grid[r * SIZE + c]
        row += EMOJI[Math.min(cell, EMOJI.length - 1)] ?? '⬛'
      }
      rows.push(row)
    }
    return rows.join('\n')
  }

  const HASHTAGS = `#miniapps #minipay #playblokaz #celo @playblokaz`

  const buildShareText = (withUrl: boolean) => {
    const parts = [` ${score.toLocaleString()} on BLOKAZ 🎮`]
    if (stats.bestCombo > 1)
      parts.push(`×${stats.bestCombo} combo 🔥 · ${stats.linesCleared} lines`)
    else
      parts.push(
        `${stats.linesCleared} lines cleared · rank #${rankData.currentRank}`
      )
    parts.push(``)
    if (gameSession?.grid) parts.push(buildBoardEmoji(gameSession.grid))
    parts.push(``)
    if (withUrl) parts.push(`can you beat it? blokaz.xyz\n`)
    parts.push(HASHTAGS)
    return parts.join('\n')
  }

  const handleShareTwitter = () => {
    // No &url= param — emoji board + hashtags fill ~270 chars, adding a URL would exceed 280
    const text = buildShareText(false)
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const achievementChips = [
    score >= 1000 ? 'NEW HIGH ENERGY' : 'RUN BANKED',
    rankData.currentRank <= 10
      ? `TOP ${rankData.currentRank}`
      : `+${Math.max(1, Math.floor(score / 75))} RANK`,
  ]

  const userIdx = (leaderboard ?? []).findIndex(
    (e) => e.player.toLowerCase() === (address?.toLowerCase() ?? '')
  )

  const visibleTokens = Object.keys(STABLECOIN_TOKENS) as StablecoinSymbol[]

  const formatReviveCost = (sym: StablecoinSymbol) => {
    const cost = getReviveCost(sym)
    const decimals = STABLECOIN_TOKENS[sym].decimals
    const dollars = Number(cost) / 10 ** decimals
    return dollars < 0.01 ? `$${dollars.toFixed(3)}` : `$${dollars.toFixed(2)}`
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0"
        style={{ background: 'var(--overlay)', backdropFilter: 'blur(8px)' }}
      />
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.10]"
        style={{
          backgroundImage:
            'linear-gradient(135deg, transparent 0%, transparent 42%, var(--ink) 42%, var(--ink) 45%, transparent 45%, transparent 100%)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Scroll container — centres on tall screens, top-aligns on short ones */}
      <div className="relative flex min-h-full items-center justify-center px-3 py-6">
        <div className="w-full max-w-sm">
          {/* ── GAME OVER banner ── */}
          <div
            className="mb-[-4px] flex items-center justify-between border-4 border-b-0 border-ink px-4 py-2"
            style={{
              background: 'var(--danger)',
              boxShadow: `6px 0 0 var(--game-over-shadow), -6px 0 0 var(--game-over-shadow), 6px -6px 0 var(--game-over-shadow)`,
            }}
          >
            <span
              className="font-display text-[1.6rem] leading-none tracking-[-0.03em] text-white"
              style={{ textShadow: '2px 2px 0 rgba(0,0,0,0.3)' }}
            >
              GAME OVER
            </span>
            <button
              onClick={onBack ?? handleAbandon}
              className="brutal-btn flex h-9 w-9 items-center justify-center border-[3px] border-white text-white"
              style={{
                background: 'rgba(0,0,0,0.25)',
                boxShadow: '3px 3px 0 rgba(0,0,0,0.3)',
              }}
            >
              <BrutalIcon name="back" size={16} strokeWidth={3} />
            </button>
          </div>

          {/* ── Main card ── */}
          <div
            className="border-4 border-ink"
            style={{
              background: 'var(--paper)',
              boxShadow: `8px 8px 0 ${shadowColor}`,
            }}
          >
            {/* Score + chips row */}
            <div className="flex items-center justify-between border-b-4 border-ink px-4 py-3">
              <div>
                <div className="font-display text-[9px] uppercase tracking-[0.18em] opacity-60">
                  FINAL SCORE
                </div>
                <div
                  className="font-display tabular-nums leading-none"
                  style={{
                    fontSize: 'clamp(2.5rem, 11vw, 3.5rem)',
                    letterSpacing: '-0.04em',
                  }}
                >
                  {score.toLocaleString()}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <div
                  className="border-[3px] border-ink px-2.5 py-0.5 font-display text-[9px] uppercase tracking-widest shadow-[2px_2px_0_var(--shadow)]"
                  style={{
                    background: 'var(--accent-lime)',
                    color: accentTextColor,
                  }}
                >
                  NEW HIGH
                </div>
                <div
                  className="border-[3px] border-ink px-2.5 py-0.5 font-display text-[9px] uppercase tracking-widest shadow-[2px_2px_0_var(--shadow)]"
                  style={{
                    background: 'var(--accent-pink)',
                    color: accentTextColor,
                  }}
                >
                  {achievementChips[1]}
                </div>
              </div>
            </div>

            {/* Stats — 4 in a single row */}
            <div className="grid grid-cols-4 border-b-4 border-ink">
              {[
                {
                  label: 'COMBO',
                  value: `×${stats.bestCombo}`,
                  icon: 'zap' as const,
                },
                {
                  label: 'LINES',
                  value: stats.linesCleared,
                  icon: 'star' as const,
                },
                {
                  label: 'PIECES',
                  value: stats.piecesPlaced,
                  icon: 'history' as const,
                },
                { label: 'TIME', value: stats.time, icon: 'timer' as const },
              ].map((stat, i) => (
                <div
                  key={stat.label}
                  className={`p-2 text-center${i < 3 ? ' border-r-4 border-ink' : ''}`}
                  style={{ background: 'var(--paper-2)' }}
                >
                  <div className="mb-0.5 flex items-center justify-center gap-0.5 font-display text-[7px] uppercase tracking-[0.1em] opacity-60">
                    <BrutalIcon name={stat.icon} size={8} strokeWidth={2} />
                    {stat.label}
                  </div>
                  <div
                    className="font-display text-base leading-none"
                    style={{ letterSpacing: '-0.02em' }}
                  >
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Actions ── */}
            <div className="flex flex-col gap-2.5 p-3">
              {/* Revival Bundle credits — shown first when player has pre-purchased credits */}
              {bundleCredits > 0 && (mode === 'classic' || (mode === 'tournament' && !isAllSuccess)) && (
                <button
                  onClick={handleBundleRevive}
                  className="brutal-btn flex w-full items-center justify-center gap-2 border-[3px] border-ink py-3 font-display text-[11px] uppercase tracking-wider shadow-[3px_3px_0_var(--shadow)]"
                  style={{ background: 'var(--accent-lime)', color: 'var(--ink-fixed)' }}
                >
                  USE REVIVAL BUNDLE
                  <span
                    className="border-[2px] border-ink px-2 py-0.5 font-display text-[8px] uppercase tracking-wider"
                    style={{ background: 'var(--ink)', color: 'var(--paper)' }}
                  >
                    {bundleCredits} LEFT
                  </span>
                </button>
              )}

              {/* Stablecoin revival — shown in both classic and tournament modes */}
              {(mode === 'classic' ||
                (mode === 'tournament' && !isAllSuccess)) && (
                <div
                  className="border-[3px] border-ink"
                  style={{ background: 'var(--paper-2)' }}
                >
                  <div
                    className="flex items-center justify-between border-b-[3px] border-ink px-3 py-2"
                    style={{ background: 'var(--paper)' }}
                  >
                    <div className="flex items-center gap-2 font-display text-[10px] uppercase tracking-[0.15em]">
                      <div
                        className="flex h-5 w-5 items-center justify-center border-[2px] border-ink text-[10px]"
                        style={{
                          background: 'var(--accent-cyan)',
                          color: 'var(--ink-fixed)',
                        }}
                      >
                        ⚡
                      </div>
                      CONTINUE YOUR RUN
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div
                        className="border-[2px] border-ink px-2 py-0.5 font-display text-[8px] uppercase tracking-wider"
                        style={{
                          background: 'var(--accent-cyan)',
                          color: 'var(--ink-fixed)',
                        }}
                      >
                        {formatReviveCost(selectedToken)}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2.5 p-3">
                    {/* Token cards — always show all 3 so player can pick their balance */}
                    <div className="grid grid-cols-3 gap-2">
                      {visibleTokens.map((sym) => {
                        const isSelected = selectedToken === sym
                        const decimals = STABLECOIN_TOKENS[sym].decimals
                        const raw = stableBalances[sym]
                        const balance = (Number(raw) / 10 ** decimals).toFixed(
                          2
                        )
                        const affordable = canAfford(sym)
                        return (
                          <button
                            key={sym}
                            onClick={() => setSelectedToken(sym)}
                            className="flex flex-col items-center gap-1 border-[3px] border-ink px-1 py-2.5 font-display"
                            style={{
                              background: isSelected
                                ? 'var(--accent-cyan)'
                                : 'var(--paper)',
                              color: isSelected
                                ? 'var(--ink-fixed)'
                                : 'var(--ink)',
                              boxShadow: isSelected
                                ? '3px 3px 0 var(--shadow)'
                                : '2px 2px 0 var(--shadow)',
                            }}
                          >
                            <span className="text-[11px] font-bold uppercase tracking-wider">
                              {sym}
                            </span>
                            <span
                              className="text-[9px] tabular-nums"
                              style={{
                                color: isSelected
                                  ? 'var(--ink-fixed)'
                                  : affordable
                                    ? 'var(--ink)'
                                    : 'var(--ink-soft)',
                                opacity: isSelected ? 0.75 : 1,
                              }}
                            >
                              {balance}
                            </span>
                          </button>
                        )
                      })}
                    </div>

                    {/* Revive button */}
                    <button
                      onClick={
                        canAfford(selectedToken)
                          ? handleStableRevive
                          : IS_MINIPAY
                            ? () => window.open(MINIPAY_DEPOSIT_URL, '_blank')
                            : undefined
                      }
                      disabled={
                        isStablePaying ||
                        (!canAfford(selectedToken) && !IS_MINIPAY)
                      }
                      className="brutal-btn flex w-full items-center justify-center gap-2 border-[3px] border-ink py-3 font-display text-[11px] uppercase tracking-wider shadow-[3px_3px_0_var(--shadow)] disabled:opacity-50"
                      style={{
                        background: 'var(--accent-cyan)',
                        color: 'var(--ink-fixed)',
                      }}
                    >
                      {isStablePaying ? (
                        <div className="brutal-loader" />
                      ) : canAfford(selectedToken) ? (
                        <>
                          <BrutalIcon name="zap" size={13} strokeWidth={2.5} />
                          REVIVE — {formatReviveCost(selectedToken)}{' '}
                          {selectedToken}
                        </>
                      ) : IS_MINIPAY ? (
                        <span>NOT ENOUGH {selectedToken} — DEPOSIT</span>
                      ) : (
                        <span>NOT ENOUGH {selectedToken}</span>
                      )}
                    </button>

                    {stableError && (
                      <div className="text-center font-display text-[8px] uppercase tracking-[0.12em] text-danger">
                        {stableError}
                      </div>
                    )}
                  </div>
                </div>
              )}


              {/* Submit score CTA */}
              {signerError && (
                <div
                  className="border-[3px] border-danger px-3 py-2 font-display text-[9px] uppercase tracking-[0.12em] text-danger"
                  style={{ background: 'var(--paper-2)' }}
                >
                  <BrutalIcon name="alert" size={10} strokeWidth={2.5} />{' '}
                  {signerError}
                </div>
              )}
              {hasError ? (
                <div className="flex flex-col gap-2">
                  <div
                    className="border-[3px] border-danger p-4"
                    style={{
                      background: 'var(--paper-2)',
                      boxShadow: '4px 4px 0 var(--danger)',
                    }}
                  >
                    <div className="mb-1.5 flex items-center gap-2 font-display text-[11px] uppercase tracking-[0.12em] text-danger">
                      <BrutalIcon name="alert" size={12} strokeWidth={2.5} />
                      SCORE NOT SAVED
                    </div>

                    {isInsufficientFunds ? (
                      /* ── Insufficient balance — show balance + deposit CTA ── */
                      <>
                        <p className="mb-1 font-body text-[11px] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                          Your wallet balance is{' '}
                          <span className="font-display text-danger">${totalStableUsd.toFixed(2)}</span>
                          {' '}— you need at least{' '}
                          <span className="font-display">$0.10</span>{' '}
                          to cover the network fee and submit your score.
                        </p>
                        <p className="mb-3 font-body text-[10px]" style={{ color: 'var(--ink-soft)', opacity: 0.75 }}>
                          Your score is saved locally and will be here when you return.
                        </p>
                        {IS_MINIPAY && (
                          <button
                            onClick={() => window.open(MINIPAY_DEPOSIT_URL, '_blank')}
                            className="brutal-btn flex w-full items-center justify-center gap-2 border-[3px] border-ink py-3 font-display text-[11px] uppercase tracking-widest"
                            style={{ background: 'var(--accent-cyan)', color: 'var(--ink-fixed)', boxShadow: '3px 3px 0 var(--shadow)' }}
                          >
                            TOP UP WALLET IN MINIPAY
                          </button>
                        )}
                      </>
                    ) : (
                      /* ── Generic error — show message + retry ── */
                      <>
                        <p className="mb-3 font-body text-[11px] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                          {friendlyError ?? 'Something went wrong — tap retry to try again.'}
                        </p>
                        <button
                          onClick={handleSubmit}
                          disabled={!canSubmit || isRegistering}
                          className="brutal-btn flex w-full items-center justify-center gap-2 border-[3px] border-ink py-3 font-display text-[11px] uppercase tracking-widest disabled:opacity-50"
                          style={{ background: 'var(--danger)', color: '#fff', boxShadow: '3px 3px 0 rgba(0,0,0,0.25)' }}
                        >
                          {isRegistering ? <div className="brutal-loader" /> : <BrutalIcon name="play" size={13} strokeWidth={2.5} />}
                          RETRY SAVING SCORE
                        </button>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      resetForNextGame()
                      onPlayAgain()
                    }}
                    className="brutal-btn flex w-full items-center justify-center gap-2 border-[3px] border-ink bg-paper-2 py-2.5 font-display text-[10px] uppercase tracking-widest"
                    style={{
                      boxShadow: '3px 3px 0 var(--shadow)',
                      color: 'var(--ink)',
                    }}
                  >
                    SKIP &amp; PLAY AGAIN
                  </button>
                </div>
              ) : (
                <button
                  onClick={
                    isAllSuccess
                      ? () => {
                          resetForNextGame()
                          onPlayAgain()
                        }
                      : handleSubmit
                  }
                  disabled={isRegistering || (!isAllSuccess && !canSubmit)}
                  className="brutal-btn flex w-full flex-col items-center justify-center border-4 border-ink font-display uppercase disabled:opacity-50"
                  style={{
                    background: isAllSuccess
                      ? 'var(--accent-lime)'
                      : 'var(--ink)',
                    color: isAllSuccess ? accentTextColor : 'var(--paper)',
                    boxShadow: '5px 5px 0 var(--shadow)',
                  }}
                >
                  <div className="flex items-center justify-center gap-2 py-3.5 text-sm tracking-[0.15em]">
                    {isRegistering ? (
                      <div className="brutal-loader" />
                    ) : (
                      <BrutalIcon name="play" size={18} strokeWidth={2.5} />
                    )}
                    {isRegistering
                      ? 'SUBMITTING...'
                      : isAllSuccess
                        ? 'PLAY AGAIN'
                        : isTournamentMode
                          ? `SUBMIT SCORE${countdown !== null && countdown > 0 ? ` (${countdown}s)` : ''}`
                          : `PLAY AGAIN${countdown !== null && countdown > 0 ? ` (${countdown}s)` : ''}`}
                  </div>
                  {countdown !== null &&
                    countdown > 0 &&
                    !isRegistering &&
                    !isAllSuccess && (
                      <div className="w-full border-t-[3px] border-ink/30">
                        <div
                          className="h-1.5"
                          style={{
                            width: `${(countdown / (isTournamentMode ? 5 : 10)) * 100}%`,
                            background: 'var(--paper)',
                            transition: 'width 1s linear',
                          }}
                        />
                      </div>
                    )}
                </button>
              )}
              {/* Explain why submit is blocked */}
              {submitBlockReason && !hasError && (
                <div className="text-center font-display text-[9px] uppercase tracking-[0.12em]" style={{ color: 'var(--ink-soft)' }}>
                  {submitBlockReason}
                </div>
              )}

              {/* Share / Leaderboard */}
              {showShareSheet ? (
                <div
                  className="border-[3px] border-ink"
                  style={{ background: 'var(--paper-2)' }}
                >
                  <div
                    className="flex items-center justify-between border-b-[3px] border-ink px-3 py-2"
                    style={{ background: 'var(--paper)' }}
                  >
                    <span className="font-display text-[9px] uppercase tracking-[0.18em]">
                      SHARE YOUR RUN
                    </span>
                    <button
                      onClick={() => setShowShareSheet(false)}
                      className="brutal-btn flex h-7 w-7 items-center justify-center border-2 border-ink text-ink"
                      style={{
                        background: 'var(--paper-2)',
                        boxShadow: '2px 2px 0 var(--shadow)',
                      }}
                    >
                      <BrutalIcon name="back" size={12} strokeWidth={3} />
                    </button>
                  </div>
                  <div className="flex gap-2 p-2.5">
                    <button
                      onClick={handleShareTwitter}
                      className="brutal-btn flex w-full items-center justify-center gap-1.5 border-[3px] border-ink py-2.5 font-display text-[10px] uppercase tracking-wider shadow-[3px_3px_0_var(--shadow)]"
                      style={{
                        background: 'var(--ink)',
                        color: 'var(--paper)',
                      }}
                    >
                      <span
                        className="flex h-4 w-4 items-center justify-center border-[2px] border-paper text-[8px] font-bold"
                        style={{
                          background: 'var(--paper)',
                          color: 'var(--ink)',
                        }}
                      >
                        X
                      </span>
                      SHARE ON X
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setShowShareSheet(true)}
                    className="brutal-btn flex items-center justify-center gap-1.5 border-[3px] border-ink bg-paper-2 py-3 font-display text-[10px] uppercase tracking-wider text-ink shadow-[3px_3px_0_var(--shadow)]"
                  >
                    <BrutalIcon name="rocket" size={12} strokeWidth={2} /> SHARE
                  </button>
                  <button
                    onClick={onOpenLeaderboard}
                    className="brutal-btn border-[3px] border-ink bg-accent-cyan py-3 font-display text-[10px] uppercase tracking-wider shadow-[3px_3px_0_var(--shadow)]"
                    style={{ color: accentTextColor }}
                  >
                    LEADERBOARD
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* /w-full max-w-sm */}
      </div>
      {/* /scroll container */}
    </div>
  )
}

export default GameOverModal
