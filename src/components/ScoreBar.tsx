import React, { useEffect, useRef, useState } from 'react'
import { BrutalIcon } from './BrutalIcon'
import { getComboTierInfo } from '../engine/scoring'

interface ScoreBarProps {
  score: number
  comboStreak: number
  bestScore?: number
  tournamentId?: bigint | null
  compact?: boolean
}

const TensionBar: React.FC<{
  comboStreak: number
  accentColor: string
  compact?: boolean
}> = ({ comboStreak, accentColor, compact }) => {
  const { pct, label, multiplier } = getComboTierInfo(comboStreak)
  const tensionActive = comboStreak >= 2
  const multLabel = multiplier % 1 === 0 ? `×${multiplier}` : `×${multiplier}`

  return (
    <div className={`flex items-center gap-2 px-3 ${compact ? 'pb-1' : 'pb-2'}`}>
      <div
        className="flex items-center gap-1 font-display text-[9px] tracking-[0.14em]"
        style={{ color: 'var(--paper)', whiteSpace: 'nowrap' }}
      >
        <BrutalIcon name="zap" size={10} strokeWidth={2} />
        {label || 'COMBO'}
      </div>
      <div
        className={`relative flex-1 overflow-hidden border-[2px] ${compact ? 'h-[10px]' : 'h-[18px]'}`}
        style={{ borderColor: 'var(--paper)' }}
      >
        <div
          className={`absolute inset-y-0 left-0 ${tensionActive ? 'tension-fill-strobe' : 'tension-fill'}`}
          style={{
            width: `${pct}%`,
            transition: 'width 300ms ease-out',
            backgroundImage: `repeating-linear-gradient(45deg, ${accentColor}, ${accentColor} 4px, var(--accent-2) 4px 8px)`,
          }}
        />
      </div>
      <div
        className="font-display text-[9px] tracking-[0.12em]"
        style={{ color: 'var(--paper)', whiteSpace: 'nowrap' }}
      >
        {comboStreak > 0 ? multLabel : '×1'}
      </div>
    </div>
  )
}

const ScoreBar: React.FC<ScoreBarProps> = ({
  score,
  comboStreak,
  bestScore,
  tournamentId,
  compact = false,
}) => {
  const isTournament = tournamentId !== null && tournamentId !== undefined
  const prevScore = useRef(score)
  const [flashKey, setFlashKey] = useState(0)

  useEffect(() => {
    if (score !== prevScore.current) {
      prevScore.current = score
      setFlashKey((k) => k + 1)
    }
  }, [score])

  const accentColor = isTournament ? 'var(--accent-cyan)' : 'var(--accent-purple)'
  const textColor = 'var(--paper)'
  const barBg = 'var(--ink)'
  const vPad = compact ? 'py-1' : 'py-6'
  const hPad = compact ? 'px-3' : 'px-6'

  const { multiplier, label } = getComboTierInfo(comboStreak)
  const multLabel = multiplier % 1 === 0 ? `×${multiplier}` : `×${multiplier}`

  return (
    <div className="border-b-4 border-ink" style={{ background: barBg }}>
      <div className={`flex items-center justify-between ${hPad} ${vPad}`}>
        {/* Left: Score */}
        <div className="flex flex-col">
          {!compact && (
            <div className="flex items-center gap-1 font-display text-[10px] uppercase tracking-[0.2em] text-accent-yellow">
              <BrutalIcon name="star" size={10} strokeWidth={2} /> SCORE
            </div>
          )}
          {compact && (
            <div className="font-display text-[9px] tracking-[0.14em] text-accent-yellow">SCORE</div>
          )}
          <div
            key={flashKey}
            className="score-flash font-display tabular-nums"
            style={{
              color: textColor,
              fontSize: compact ? 'clamp(1.2rem, 5vw, 1.6rem)' : 'clamp(2.5rem, 8vw, 3.5rem)',
              letterSpacing: '-0.04em',
              lineHeight: 1,
            }}
          >
            {score.toLocaleString()}
          </div>
        </div>

        {/* Center: Combo Sticker */}
        <div className="flex items-center justify-center">
          {comboStreak > 0 && (
            <div
              className={`brutal-sticker ${compact ? 'px-2 py-1' : 'px-3 py-1.5'}`}
              style={{ transform: 'rotate(-5deg) scale(1.05)', zIndex: 20 }}
            >
              {!compact && (
                <div className="font-display text-[9px] tracking-[0.2em] uppercase" style={{ color: 'white' }}>
                  {label || 'COMBO'}
                </div>
              )}
              <div className={`font-display leading-none ${compact ? 'text-base' : 'text-2xl'}`} style={{ letterSpacing: '-0.02em' }}>
                {multLabel}
              </div>
            </div>
          )}
        </div>

        {/* Right: Best */}
        <div className="flex flex-col items-end text-right">
          {!compact && (
            <div className="flex items-center gap-1 font-display text-[10px] uppercase tracking-[0.2em] text-accent-yellow">
              BEST <BrutalIcon name="crown" size={10} strokeWidth={2} />
            </div>
          )}
          {compact && (
            <div className="font-display text-[9px] tracking-[0.14em] text-accent-yellow">BEST</div>
          )}
          <div
            className="font-display tabular-nums"
            style={{
              color: textColor,
              fontSize: compact ? 'clamp(1.2rem, 5vw, 1.6rem)' : 'clamp(1.5rem, 5vw, 2rem)',
              letterSpacing: '-0.04em',
              lineHeight: 1,
            }}
          >
            {bestScore != null ? bestScore.toLocaleString() : score > 0 ? score.toLocaleString() : '—'}
          </div>
        </div>
      </div>

      <TensionBar
        comboStreak={comboStreak}
        accentColor={accentColor}
        compact={compact}
      />
    </div>
  )
}

export default ScoreBar
