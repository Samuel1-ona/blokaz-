import React, { useEffect, useState } from 'react'

// ─── Config ──────────────────────────────────────────────────────────────────
const TWITTER_URL = 'https://x.com/playblokaz'
const TELEGRAM_URL = 'https://t.me/c/tweetlegg/1135'

// Show after every N games played
const GAMES_BETWEEN_NUDGES = 3
// Minimum hours to wait before showing again after dismiss
const COOLDOWN_HOURS = 24

const STORAGE_GAMES_KEY = 'blokaz:games_since_nudge'
const STORAGE_LAST_SHOWN = 'blokaz:nudge_last_shown'
const STORAGE_NEXT_PLATFORM = 'blokaz:nudge_next_platform'

type Platform = 'twitter' | 'telegram'

// ─── Helpers ─────────────────────────────────────────────────────────────────
export function incrementGameCount(): void {
  try {
    const n = parseInt(localStorage.getItem(STORAGE_GAMES_KEY) ?? '0', 10) + 1
    localStorage.setItem(STORAGE_GAMES_KEY, String(n))
  } catch {}
}

export function shouldShowNudge(): boolean {
  try {
    const games = parseInt(localStorage.getItem(STORAGE_GAMES_KEY) ?? '0', 10)
    if (games < GAMES_BETWEEN_NUDGES) return false

    const lastShown = parseInt(
      localStorage.getItem(STORAGE_LAST_SHOWN) ?? '0',
      10
    )
    const hoursSince = (Date.now() - lastShown) / 3_600_000
    return hoursSince >= COOLDOWN_HOURS
  } catch {
    return false
  }
}

function recordNudgeShown(): void {
  try {
    localStorage.setItem(STORAGE_GAMES_KEY, '0')
    localStorage.setItem(STORAGE_LAST_SHOWN, String(Date.now()))
  } catch {}
}

function getNextPlatform(): Platform {
  try {
    const stored = localStorage.getItem(STORAGE_NEXT_PLATFORM)
    return stored === 'telegram' ? 'telegram' : 'twitter'
  } catch {
    return 'twitter'
  }
}

function flipPlatform(current: Platform): void {
  try {
    localStorage.setItem(
      STORAGE_NEXT_PLATFORM,
      current === 'twitter' ? 'telegram' : 'twitter'
    )
  } catch {}
}

// ─── Copy ────────────────────────────────────────────────────────────────────
const COPY: Record<
  Platform,
  {
    icon: React.ReactNode
    platform: string
    platformColor: string
    heading: string
    body: string
    cta: string
    url: string
  }
> = {
  twitter: {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.263 5.633 5.901-5.633Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
    platform: 'TWITTER / X',
    platformColor: '#0c0c10',
    heading: 'BIG PRIZES\nCOMING SOON.',
    body: "We're dropping weekly/monthly tournaments with serious USDT prize pools. Follow us on Twitter to be the first to know — and never miss an entry window.",
    cta: 'FOLLOW @PLAYBLOKAZ',
    url: TWITTER_URL,
  },
  telegram: {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z" />
      </svg>
    ),
    platform: 'TELEGRAM',
    platformColor: '#229ED9',
    heading: 'GET ALPHA\nBEFORE ANYONE.',
    body: 'Tournament schedules, prize announcements, and early access drops — all land in our Telegram first. Join the community and stay ahead.',
    cta: 'JOIN THE CHANNEL',
    url: TELEGRAM_URL,
  },
}

// ─── Component ───────────────────────────────────────────────────────────────
interface SocialNudgeModalProps {
  onDismiss: () => void
}

export const SocialNudgeModal: React.FC<SocialNudgeModalProps> = ({
  onDismiss,
}) => {
  const [platform] = useState<Platform>(getNextPlatform)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Entrance animation
    const t = requestAnimationFrame(() => setVisible(true))
    recordNudgeShown()
    flipPlatform(platform)
    return () => cancelAnimationFrame(t)
  }, [platform])

  const c = COPY[platform]

  const handleDismiss = () => {
    setVisible(false)
    setTimeout(onDismiss, 240)
  }

  const handleFollow = () => {
    window.open(c.url, '_blank', 'noopener,noreferrer')
    handleDismiss()
  }

  return (
    <>
      {/* Inline clamp so the card never overflows on tiny screens */}
      <style>{`
        .snm-card { max-width: min(380px, calc(100vw - 24px)); }
        .snm-heading { font-size: clamp(20px, 6vw, 28px); }
        .snm-body { font-size: clamp(12px, 3.5vw, 13px); }
        .snm-cta { font-size: clamp(11px, 3vw, 13px); padding: clamp(11px, 3vw, 14px) 16px; }
      `}</style>

      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 8888,
          background: 'rgba(12,12,16,0.72)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          /* bottom-align on very short screens so shadow isn't clipped */
          padding: '12px 12px 20px',
          boxSizing: 'border-box',
          opacity: visible ? 1 : 0,
          transition: 'opacity 220ms ease',
        }}
        onClick={handleDismiss}
      >
        <div
          className="snm-card"
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            background: 'var(--paper, #f5efe3)',
            border: '4px solid var(--ink, #0c0c10)',
            /* shrink shadow on small screens so it stays visible */
            boxShadow: '6px 6px 0 var(--ink, #0c0c10)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            transform: visible
              ? 'translateY(0) scale(1)'
              : 'translateY(16px) scale(0.97)',
            transition: 'transform 260ms cubic-bezier(0.22,1,0.36,1)',
          }}
        >
          {/* ── Header ── */}
          <div
            style={{
              background: c.platformColor,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ffffff' }}>
              {c.icon}
              <span
                style={{
                  fontFamily: '"Archivo Black", sans-serif',
                  fontSize: 11,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: '#ffffff',
                }}
              >
                {c.platform}
              </span>
            </div>

            <button
              onClick={handleDismiss}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: '2px solid rgba(255,255,255,0.4)',
                color: '#ffffff',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: '"Archivo Black", sans-serif',
                fontSize: 18,
                cursor: 'pointer',
                lineHeight: 1,
                flexShrink: 0,
                /* larger tap target on touch */
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
              flexShrink: 0,
            }}
          />

          {/* ── Body ── */}
          <div style={{ padding: '18px 18px 16px' }}>
            {/* Heading */}
            <div
              className="snm-heading"
              style={{
                fontFamily: '"Archivo Black", sans-serif',
                letterSpacing: '-0.02em',
                lineHeight: 1.05,
                color: 'var(--ink, #0c0c10)',
                textTransform: 'uppercase',
                marginBottom: 10,
                whiteSpace: 'pre-line',
              }}
            >
              {c.heading}
            </div>

            {/* Prize badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: '#ffd51f',
                border: '3px solid var(--ink, #0c0c10)',
                boxShadow: '3px 3px 0 var(--ink, #0c0c10)',
                padding: '4px 10px',
                fontFamily: '"Archivo Black", sans-serif',
                fontSize: 9,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--ink, #0c0c10)',
                marginBottom: 12,
              }}
            >
              🏆 USDT PRIZE POOLS
            </div>

            {/* Body copy */}
            <p
              className="snm-body"
              style={{
                fontFamily: '"Space Grotesk", sans-serif',
                lineHeight: 1.6,
                color: 'var(--ink-soft, #2a2a33)',
                margin: '0 0 16px',
              }}
            >
              {c.body}
            </p>

            {/* Primary CTA */}
            <button
              className="snm-cta"
              onClick={handleFollow}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                boxSizing: 'border-box',
                background: c.platformColor,
                border: '4px solid var(--ink, #0c0c10)',
                boxShadow: '4px 4px 0 var(--ink, #0c0c10)',
                fontFamily: '"Archivo Black", sans-serif',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#ffffff',
                cursor: 'pointer',
                marginBottom: 8,
                touchAction: 'manipulation',
              }}
            >
              <span>{c.cta}</span>
              <span style={{ fontSize: 18, lineHeight: 1 }}>→</span>
            </button>

            {/* Skip */}
            <button
              onClick={handleDismiss}
              style={{
                display: 'block',
                width: '100%',
                background: 'transparent',
                border: 'none',
                /* generous tap target */
                padding: '12px 8px',
                fontFamily: '"Archivo Black", sans-serif',
                fontSize: 10,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--muted, #6b6b73)',
                cursor: 'pointer',
                textAlign: 'center',
                touchAction: 'manipulation',
              }}
            >
              MAYBE LATER
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default SocialNudgeModal
