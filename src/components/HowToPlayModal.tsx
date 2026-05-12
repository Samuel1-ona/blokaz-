import React, { useState } from 'react'
import { BrutalIcon } from './BrutalIcon'

// ─── localStorage key ────────────────────────────────────────────────────────
const ONBOARDED_KEY = 'blokaz_onboarded_v1'

export const hasSeenOnboarding = () => {
  try { return !!localStorage.getItem(ONBOARDED_KEY) } catch { return false }
}
export const markOnboardingSeen = () => {
  try { localStorage.setItem(ONBOARDED_KEY, '1') } catch {}
}

// ─── Step definitions ────────────────────────────────────────────────────────

interface Step {
  tag: string
  tagColor: string
  title: React.ReactNode
  body: string
  visual: React.ReactNode
}

const STEPS: Step[] = [
  // ── Step 1: Place pieces ─────────────────────────────────────────────────
  {
    tag: 'STEP 1',
    tagColor: 'var(--accent-yellow)',
    title: <>PLACE PIECES<br />ON THE GRID</>,
    body: 'Drag or tap a piece from the tray at the bottom, then drop it anywhere on the 9×9 board. All three tray pieces must be placed before new ones appear.',
    visual: (
      <div className="flex flex-col items-center gap-2">
        <div
          className="grid border-[3px] border-ink"
          style={{ gridTemplateColumns: 'repeat(5, 28px)' }}
        >
          {Array.from({ length: 25 }).map((_, i) => {
            const filled = [6, 7, 11, 12, 16].includes(i)
            const placing = [8, 13, 18].includes(i)
            return (
              <div
                key={i}
                className="h-7 w-7 border border-ink/30"
                style={{
                  background: filled
                    ? 'var(--piece-blue)'
                    : placing
                      ? 'var(--accent-lime)'
                      : 'var(--paper-2)',
                }}
              />
            )
          })}
        </div>
        <div className="flex gap-2 border-[3px] border-ink bg-paper-2 px-3 py-2">
          {[
            [[1,1],[1,1]],
            [[1],[1],[1]],
            [[1,1,1]],
          ].map((shape, si) => (
            <div
              key={si}
              className={`flex flex-col gap-[2px] ${si === 2 ? 'opacity-40' : ''}`}
            >
              {shape.map((row, ri) => (
                <div key={ri} className="flex gap-[2px]">
                  {row.map((_, ci) => (
                    <div
                      key={ci}
                      className="h-4 w-4 border-[2px] border-ink"
                      style={{
                        background: si === 0
                          ? 'var(--piece-blue)'
                          : si === 1
                            ? 'var(--piece-red)'
                            : 'var(--piece-orange)',
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className="font-display text-[9px] uppercase tracking-widest" style={{ color: 'var(--ink-soft)' }}>
          Tray refills when all 3 are placed
        </p>
      </div>
    ),
  },

  // ── Step 2: Clear lines ──────────────────────────────────────────────────
  {
    tag: 'STEP 2',
    tagColor: 'var(--accent-lime)',
    title: <>FILL A ROW OR<br />COLUMN TO CLEAR</>,
    body: 'When every cell in a row or column is filled, it clears and you score points. The fuller the board, the trickier it gets — plan ahead!',
    visual: (
      <div className="flex flex-col items-center gap-3">
        <div className="flex gap-4 items-center">
          <div className="flex flex-col items-center gap-1">
            <p className="font-display text-[8px] uppercase tracking-widest" style={{ color: 'var(--ink-soft)' }}>BEFORE</p>
            <div className="grid border-[3px] border-ink" style={{ gridTemplateColumns: 'repeat(5, 22px)' }}>
              {Array.from({ length: 25 }).map((_, i) => {
                const fullRow = i >= 10 && i < 15
                const other = [0,2,6,8,17,19,20,22].includes(i)
                return (
                  <div
                    key={i}
                    className="h-[22px] w-[22px] border border-ink/30"
                    style={{
                      background: fullRow
                        ? 'var(--piece-lime)'
                        : other
                          ? 'var(--piece-blue)'
                          : 'var(--paper-2)',
                    }}
                  />
                )
              })}
            </div>
          </div>
          <div className="font-display text-2xl" style={{ color: 'var(--accent-lime)' }}>→</div>
          <div className="flex flex-col items-center gap-1">
            <p className="font-display text-[8px] uppercase tracking-widest" style={{ color: 'var(--ink-soft)' }}>AFTER</p>
            <div className="grid border-[3px] border-ink" style={{ gridTemplateColumns: 'repeat(5, 22px)' }}>
              {Array.from({ length: 25 }).map((_, i) => {
                const clearedRow = i >= 10 && i < 15
                const other = [0,2,6,8,17,19,20,22].includes(i)
                return (
                  <div
                    key={i}
                    className="h-[22px] w-[22px] border border-ink/30"
                    style={{
                      background: clearedRow
                        ? 'var(--paper)'
                        : other
                          ? 'var(--piece-blue)'
                          : 'var(--paper-2)',
                    }}
                  />
                )
              })}
            </div>
          </div>
        </div>
        <div
          className="border-[3px] border-ink px-4 py-1.5 font-display text-sm tracking-widest"
          style={{ background: 'var(--accent-lime)', color: 'var(--ink-fixed)' }}
        >
          +100 PTS
        </div>
      </div>
    ),
  },

  // ── Step 3: Combos ───────────────────────────────────────────────────────
  {
    tag: 'STEP 3',
    tagColor: 'var(--accent-pink)',
    title: <>CHAIN CLEARS<br />FOR BIG BONUSES</>,
    body: 'Clearing multiple rows or columns in a single move triggers a COMBO. Stack combos to multiply your score — the chain meter fills up the more you clear.',
    visual: (
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-end gap-2">
          {[1, 2, 3, 4].map((mult, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div
                className="flex w-10 items-end justify-center border-[3px] border-ink font-display text-[11px] tracking-wide"
                style={{
                  height: 20 + i * 18,
                  background: i === 3 ? 'var(--accent-lime)' : i === 2 ? 'var(--accent-yellow)' : i === 1 ? 'var(--piece-orange)' : 'var(--paper-2)',
                  color: i >= 1 ? 'var(--ink-fixed)' : 'var(--ink)',
                  boxShadow: i === 3 ? '3px 3px 0 var(--shadow)' : 'none',
                }}
              />
              <span className="font-display text-[9px]" style={{ color: 'var(--ink-soft)' }}>×{mult}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 border-[3px] border-ink px-4 py-2" style={{ background: 'var(--ink)' }}>
          <div className="h-2 w-2 animate-pulse rounded-full bg-accent-lime" />
          <span className="font-display text-xs uppercase tracking-widest text-paper">COMBO ×4 — +220 BONUS</span>
        </div>
        <p className="font-display text-[9px] uppercase tracking-widest text-center" style={{ color: 'var(--ink-soft)' }}>
          Keep clearing to grow your multiplier
        </p>
      </div>
    ),
  },

  // ── Step 4: Game over ────────────────────────────────────────────────────
  {
    tag: 'GAME OVER',
    tagColor: 'var(--piece-red)',
    title: <>GAME ENDS WHEN<br />NO PIECE FITS</>,
    body: 'The game ends when none of the three tray pieces can be placed anywhere on the board. Your score is submitted to the network and ranked on the weekly leaderboard.',
    visual: (
      <div className="flex flex-col items-center gap-3">
        <div className="grid border-[3px] border-ink" style={{ gridTemplateColumns: 'repeat(5, 22px)' }}>
          {Array.from({ length: 25 }).map((_, i) => {
            const empty = [4, 9, 24].includes(i)
            return (
              <div
                key={i}
                className="h-[22px] w-[22px] border border-ink/20"
                style={{
                  background: empty ? 'var(--paper-2)' : [
                    'var(--piece-blue)', 'var(--piece-red)', 'var(--piece-orange)',
                    'var(--piece-lime)', 'var(--piece-pink)',
                  ][i % 5],
                }}
              />
            )
          })}
        </div>
        <div className="flex items-center gap-2">
          <div
            className="border-[3px] border-ink px-3 py-1 font-display text-[10px] uppercase tracking-widest"
            style={{ background: 'var(--ink)', color: 'var(--paper)' }}
          >
            GAME OVER
          </div>
          <BrutalIcon name="trending" size={14} strokeWidth={2.5} />
          <div
            className="border-[3px] border-ink px-3 py-1 font-display text-[10px] uppercase tracking-widest"
            style={{ background: 'var(--accent-yellow)', color: 'var(--ink-fixed)' }}
          >
            RANKED #12
          </div>
        </div>
        <p className="font-display text-[9px] uppercase tracking-widest text-center" style={{ color: 'var(--ink-soft)' }}>
          Scores go to the network automatically
        </p>
      </div>
    ),
  },

  // ── Step 5: Wallet popups ────────────────────────────────────────────────
  {
    tag: 'HEADS UP',
    tagColor: 'var(--accent-yellow)',
    title: <>APPROVE WALLET<br />POPUPS TO PLAY</>,
    body: 'Blokaz runs on the Celo network. Your wallet will pop up twice per game — once when you start, and once when your score is submitted. Always tap CONFIRM to proceed.',
    visual: (
      <div className="flex flex-col items-center gap-3 w-full px-2">
        {[
          { moment: 'GAME START', action: 'Registers your session on the network', icon: 'play' as const, color: 'var(--accent-lime)' },
          { moment: 'GAME OVER', action: 'Submits your final score to the network', icon: 'trending' as const, color: 'var(--accent-yellow)' },
        ].map(({ moment, action, icon, color }) => (
          <div
            key={moment}
            className="flex w-full items-center gap-3 border-[3px] border-ink px-3 py-3"
            style={{ background: 'var(--paper-2)', boxShadow: '3px 3px 0 var(--shadow)' }}
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center border-[2px] border-ink"
              style={{ background: color }}
            >
              <BrutalIcon name={icon} size={16} strokeWidth={2.5} />
            </div>
            <div className="flex flex-1 flex-col gap-0.5 min-w-0">
              <span className="font-display text-[10px] uppercase tracking-[0.16em]" style={{ color: 'var(--ink)' }}>
                {moment}
              </span>
              <span className="font-body text-[11px] leading-snug" style={{ color: 'var(--ink-soft)' }}>
                {action}
              </span>
            </div>
            <div
              className="shrink-0 border-[2px] border-ink px-2 py-1 font-display text-[9px] uppercase tracking-widest"
              style={{ background: 'var(--ink)', color: 'var(--paper)' }}
            >
              CONFIRM
            </div>
          </div>
        ))}
        <p className="font-display text-[9px] uppercase tracking-widest text-center" style={{ color: 'var(--ink-soft)' }}>
          Rejecting a popup will cancel your game
        </p>
      </div>
    ),
  },

  // ── Step 6: App navigation guide ─────────────────────────────────────────
  {
    tag: 'FIND YOUR WAY',
    tagColor: 'var(--ink)',
    title: <>EVERYTHING YOU<br />NEED IS ONE TAP</>,
    body: 'Use the bottom bar to move around the app. All key sections are always one tap away — no digging through menus.',
    visual: (
      <div className="flex flex-col gap-2 w-full px-2">
        {[
          {
            icon: 'home' as const,
            label: 'HOME',
            where: 'Lobby — see pools, stats & start a game',
            color: 'var(--accent-yellow)',
          },
          {
            icon: 'zap' as const,
            label: 'CLASSIC',
            where: 'Solo mode — play and climb the weekly leaderboard',
            color: 'var(--accent-lime)',
          },
          {
            icon: 'trophy' as const,
            label: 'TOURNEY',
            where: 'Tournaments — join prize pools and compete',
            color: 'var(--piece-orange)',
          },
          {
            icon: 'trending' as const,
            label: 'RANKS',
            where: 'Leaderboard — see top scores for the week',
            color: 'var(--piece-blue)',
          },
          {
            icon: 'wrench' as const,
            label: 'SETTINGS',
            where: 'Theme, Terms of Service, Support & more',
            color: 'var(--paper-2)',
          },
        ].map(({ icon, label, where, color }) => (
          <div
            key={label}
            className="flex items-center gap-3 border-[2px] border-ink px-3 py-2"
            style={{ background: 'var(--paper-2)' }}
          >
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center border-[2px] border-ink"
              style={{ background: color }}
            >
              <BrutalIcon name={icon} size={15} strokeWidth={2.5} />
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="font-display text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--ink)' }}>
                {label}
              </span>
              <span className="font-body text-[10px] leading-snug" style={{ color: 'var(--ink-soft)' }}>
                {where}
              </span>
            </div>
          </div>
        ))}
      </div>
    ),
  },
]

// ─── Modal component ─────────────────────────────────────────────────────────

interface HowToPlayModalProps {
  onDone: () => void
}

const HowToPlayModal: React.FC<HowToPlayModalProps> = ({ onDone }) => {
  const [step, setStep] = useState(0)
  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  const handleDone = () => {
    markOnboardingSeen()
    onDone()
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center sm:items-center px-0 sm:px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}
        onClick={handleDone}
      />

      {/* Card */}
      <div
        className="relative w-full max-w-sm border-t-4 border-ink sm:border-4 flex flex-col overflow-hidden"
        style={{
          background: 'var(--paper)',
          boxShadow: '0 -8px 0 var(--shadow), 8px 8px 0 var(--shadow)',
          maxHeight: '96dvh',
        }}
      >
        {/* ── Top strip: tag + skip ── */}
        <div
          className="flex shrink-0 items-center justify-between border-b-4 border-ink px-5 py-3"
          style={{ background: current.tagColor }}
        >
          <span
            className="font-display text-[11px] uppercase tracking-[0.2em]"
            style={{ color: current.tagColor === 'var(--ink)' ? 'var(--paper)' : 'var(--ink-fixed)' }}
          >
            {current.tag}
          </span>
          <button
            onClick={handleDone}
            className="font-display text-[10px] uppercase tracking-widest opacity-60 hover:opacity-100"
            style={{ color: current.tagColor === 'var(--ink)' ? 'var(--paper)' : 'var(--ink-fixed)' }}
          >
            SKIP
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-col gap-5 px-6 py-6 overflow-y-auto">
          {/* Title */}
          <h2
            className="font-display uppercase leading-[1.05]"
            style={{ fontSize: 'clamp(1.35rem, 6vw, 1.75rem)', letterSpacing: '-0.02em' }}
          >
            {current.title}
          </h2>

          {/* Visual */}
          <div
            className="flex items-center justify-center border-4 border-ink py-5"
            style={{ background: 'var(--paper-2)', boxShadow: '4px 4px 0 var(--shadow)' }}
          >
            {current.visual}
          </div>

          {/* Description */}
          <p
            className="font-body text-[13px] leading-relaxed"
            style={{ color: 'var(--ink-soft)' }}
          >
            {current.body}
          </p>
        </div>

        {/* ── Footer: dots + nav ── */}
        <div
          className="flex shrink-0 items-center justify-between border-t-4 border-ink px-5 py-4"
          style={{ background: 'var(--paper-2)' }}
        >
          {/* Step dots */}
          <div className="flex items-center gap-2">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className="h-2 border-[2px] border-ink transition-all"
                style={{
                  width: i === step ? 24 : 8,
                  background: i === step ? 'var(--ink)' : 'var(--rule)',
                }}
              />
            ))}
          </div>

          {/* Nav buttons */}
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="brutal-btn border-[3px] border-ink bg-paper px-4 py-2 font-display text-[11px] uppercase tracking-widest"
                style={{ boxShadow: '3px 3px 0 var(--shadow)' }}
              >
                ← BACK
              </button>
            )}
            {isLast ? (
              <button
                onClick={handleDone}
                className="brutal-btn border-[3px] border-ink px-5 py-2 font-display text-[11px] uppercase tracking-widest"
                style={{
                  background: 'var(--accent-lime)',
                  color: 'var(--ink-fixed)',
                  boxShadow: '3px 3px 0 var(--shadow)',
                }}
              >
                LET'S PLAY →
              </button>
            ) : (
              <button
                onClick={() => setStep(s => s + 1)}
                className="brutal-btn border-[3px] border-ink px-5 py-2 font-display text-[11px] uppercase tracking-widest"
                style={{
                  background: 'var(--ink)',
                  color: 'var(--paper)',
                  boxShadow: '3px 3px 0 var(--shadow)',
                }}
              >
                NEXT →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default HowToPlayModal
