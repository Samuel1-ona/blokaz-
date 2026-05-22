import React, { useEffect, useRef, useState } from 'react'
import { useAccount } from 'wagmi'
import { useUsername, useSetUsername } from '../hooks/useBlokzGame'
import { BrutalIcon } from './BrutalIcon'

const DISMISSED_KEY = 'blokaz:username_prompt_dismissed'

export function hasDismissedUsernamePrompt(): boolean {
  try { return localStorage.getItem(DISMISSED_KEY) === '1' } catch { return false }
}
function markDismissed(): void {
  try { localStorage.setItem(DISMISSED_KEY, '1') } catch {}
}

interface UsernameSetupModalProps {
  onDismiss: () => void
}

const UsernameSetupModal: React.FC<UsernameSetupModalProps> = ({ onDismiss }) => {
  const { address } = useAccount()
  const { username, refetch } = useUsername(address)
  const { setUsername, isPending, isConfirming, isSuccess } = useSetUsername()

  const [name, setName] = useState('')
  const [visible, setVisible] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Entrance animation
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  // Auto-focus on open
  useEffect(() => {
    if (visible) setTimeout(() => inputRef.current?.focus(), 280)
  }, [visible])

  // On success — refetch, show ✓, then auto-close
  useEffect(() => {
    if (!isSuccess) return
    refetch()
    setJustSaved(true)
    const t = setTimeout(() => {
      markDismissed()
      handleClose()
    }, 1400)
    return () => clearTimeout(t)
  }, [isSuccess])

  const handleClose = () => {
    setVisible(false)
    setTimeout(onDismiss, 240)
  }

  const handleSkip = () => {
    markDismissed()
    handleClose()
  }

  if (!address) return null

  const isBusy = isPending || isConfirming
  const isValid = name.trim().length >= 3
  const tooShort = name.length > 0 && name.length < 3

  return (
    <>
      <style>{`
        .unm-card { max-width: min(420px, calc(100vw - 24px)); }
        @keyframes unm-shake {
          0%,100% { transform: translateX(0); }
          20%,60%  { transform: translateX(-4px); }
          40%,80%  { transform: translateX(4px); }
        }
      `}</style>

      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9000,
          background: 'rgba(12,12,16,0.78)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px',
          boxSizing: 'border-box',
          opacity: visible ? 1 : 0,
          transition: 'opacity 220ms ease',
        }}
      >
        <div
          className="unm-card"
          style={{
            width: '100%',
            background: 'var(--paper, #f5efe3)',
            border: '4px solid var(--ink, #0c0c10)',
            boxShadow: '8px 8px 0 var(--ink, #0c0c10)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            transform: visible ? 'translateY(0) scale(1)' : 'translateY(18px) scale(0.96)',
            transition: 'transform 280ms cubic-bezier(0.22,1,0.36,1)',
          }}
        >
          {/* ── Header ── */}
          <div
            style={{
              background: 'var(--ink, #0c0c10)',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Identity icon */}
              <div
                style={{
                  width: 30,
                  height: 30,
                  background: '#ffd51f',
                  border: '2px solid #ffd51f',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BrutalIcon name="user" size={16} strokeWidth={2.5} style={{ color: '#0c0c10' }} />
              </div>
              <div>
                <div
                  style={{
                    fontFamily: '"Archivo Black", sans-serif',
                    fontSize: 11,
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    color: '#ffd51f',
                  }}
                >
                  BLOKAZ
                </div>
                <div
                  style={{
                    fontFamily: '"Archivo Black", sans-serif',
                    fontSize: 9,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.55)',
                  }}
                >
                  NEW PLAYER
                </div>
              </div>
            </div>

            {/* Skip / close */}
            <button
              onClick={handleSkip}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '2px solid rgba(255,255,255,0.25)',
                color: 'rgba(255,255,255,0.7)',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                cursor: 'pointer',
                lineHeight: 1,
                touchAction: 'manipulation',
              }}
            >
              ×
            </button>
          </div>

          {/* ── Yellow accent bar ── */}
          <div
            style={{
              height: 5,
              background: '#ffd51f',
              borderBottom: '3px solid var(--ink, #0c0c10)',
            }}
          />

          {/* ── Body ── */}
          <div style={{ padding: '20px 20px 18px' }}>
            {/* Heading */}
            <div
              style={{
                fontFamily: '"Archivo Black", sans-serif',
                fontSize: 'clamp(20px, 6vw, 26px)',
                letterSpacing: '-0.02em',
                lineHeight: 1.05,
                color: 'var(--ink, #0c0c10)',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              CHOOSE YOUR<br />IDENTITY.
            </div>

            <p
              style={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontSize: 'clamp(12px, 3.5vw, 13px)',
                lineHeight: 1.6,
                color: 'var(--ink-soft, #2a2a33)',
                margin: '0 0 18px',
              }}
            >
              Your name appears on the weekly leaderboard and tournament brackets.
              Pick something good — it's stored on-chain.
            </p>

            {/* Input */}
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={e => setName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                placeholder="e.g. blok_master"
                maxLength={16}
                disabled={isBusy || justSaved}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  fontFamily: '"Archivo Black", sans-serif',
                  fontSize: 15,
                  letterSpacing: '0.04em',
                  padding: '13px 48px 13px 14px',
                  border: `3px solid ${tooShort ? 'var(--danger, #ff3d3d)' : 'var(--ink, #0c0c10)'}`,
                  background: 'var(--paper-2, #fffaf4)',
                  color: 'var(--ink, #0c0c10)',
                  outline: 'none',
                  boxShadow: tooShort ? '0 0 0 2px rgba(255,61,61,0.2)' : 'none',
                  transition: 'border-color 120ms, box-shadow 120ms',
                  animation: tooShort ? 'unm-shake 0.35s ease' : 'none',
                }}
              />
              {/* Character counter */}
              {name.length > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontFamily: '"Archivo Black", sans-serif',
                    fontSize: 10,
                    color: tooShort ? 'var(--danger, #ff3d3d)' : 'var(--muted, #6b6b73)',
                    pointerEvents: 'none',
                    tabularNums: 'true',
                  } as React.CSSProperties}
                >
                  {name.length}/16
                </span>
              )}
            </div>

            {/* Hint line */}
            <div
              style={{
                fontFamily: '"Archivo Black", sans-serif',
                fontSize: 9,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: tooShort
                  ? 'var(--danger, #ff3d3d)'
                  : isConfirming
                  ? '#29e6e6'
                  : 'var(--muted, #6b6b73)',
                minHeight: 14,
                marginBottom: 16,
              }}
            >
              {tooShort
                ? 'MIN 3 CHARACTERS'
                : isConfirming
                ? 'CONFIRMING…'
                : 'LETTERS, NUMBERS AND _ ONLY'}
            </div>

            {/* Save button */}
            <button
              onClick={() => isValid && !isBusy && setUsername(name.trim())}
              disabled={!isValid || isBusy}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                width: '100%',
                boxSizing: 'border-box',
                padding: '14px 18px',
                fontFamily: '"Archivo Black", sans-serif',
                fontSize: 13,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                border: '4px solid var(--ink, #0c0c10)',
                boxShadow: isValid && !isBusy ? '5px 5px 0 var(--ink, #0c0c10)' : 'none',
                background: justSaved
                  ? '#b7ff3b'
                  : isValid
                  ? '#ffd51f'
                  : 'var(--paper-2, #fffaf4)',
                color: 'var(--ink-fixed, #0c0c10)',
                cursor: isValid && !isBusy ? 'pointer' : 'not-allowed',
                opacity: !isValid && !isBusy ? 0.45 : 1,
                transition: 'background 160ms, box-shadow 160ms, opacity 160ms',
                marginBottom: 10,
                touchAction: 'manipulation',
              }}
            >
              {isBusy ? (
                <>
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      border: '2px solid var(--ink)',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      display: 'inline-block',
                      animation: 'spin 0.6s linear infinite',
                    }}
                  />
                  {isConfirming ? 'CONFIRMING…' : 'SAVING…'}
                </>
              ) : justSaved ? (
                <>
                  <BrutalIcon name="check" size={14} strokeWidth={3} />
                  SAVED! LET'S GO →
                </>
              ) : (
                'SAVE IDENTITY'
              )}
            </button>

            {/* Skip link */}
            <button
              onClick={handleSkip}
              style={{
                display: 'block',
                width: '100%',
                background: 'transparent',
                border: 'none',
                padding: '10px 8px',
                fontFamily: '"Archivo Black", sans-serif',
                fontSize: 10,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--muted, #6b6b73)',
                cursor: 'pointer',
                textAlign: 'center',
                touchAction: 'manipulation',
              }}
            >
              SKIP FOR NOW
            </button>
          </div>
        </div>
      </div>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  )
}

export default UsernameSetupModal
