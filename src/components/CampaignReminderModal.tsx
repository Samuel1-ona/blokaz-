import React, { useEffect, useState } from 'react'

const TWITTER_URL = 'https://x.com/playblokaz'

// Show once per calendar day so it reminds every visit without being
// annoying if the player opens the app multiple times in one day.
const STORAGE_KEY = 'blokaz:campaign_reminder_date'

function shouldShow(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return true
    const today = new Date().toISOString().slice(0, 10)
    return stored !== today
  } catch {
    return true
  }
}

function markShown(): void {
  try {
    const today = new Date().toISOString().slice(0, 10)
    localStorage.setItem(STORAGE_KEY, today)
  } catch {}
}

const CampaignReminderModal: React.FC = () => {
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!shouldShow()) return
    const t = setTimeout(() => {
      markShown()
      setOpen(true)
      requestAnimationFrame(() => setVisible(true))
    }, 1200)
    return () => clearTimeout(t)
  }, [])

  const handleDismiss = () => {
    setVisible(false)
    setTimeout(() => setOpen(false), 260)
  }

  const handleCTA = () => {
    window.open(TWITTER_URL, '_blank', 'noopener,noreferrer')
    handleDismiss()
  }

  if (!open) return null

  return (
    <>
      <style>{`
        @keyframes crm-pop {
          from { opacity: 0; transform: translateY(18px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes crm-pulse-badge {
          0%, 100% { transform: rotate(-2deg) scale(1); }
          50%       { transform: rotate(-2deg) scale(1.05); }
        }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={handleDismiss}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9000,
          background: 'rgba(12,12,16,0.78)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px 12px 24px',
          boxSizing: 'border-box',
          opacity: visible ? 1 : 0,
          transition: 'opacity 220ms ease',
        }}
      >
        {/* Diagonal stripe background */}
        <div style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.06,
          background: 'repeating-linear-gradient(-45deg, #ffd51f 0, #ffd51f 24px, transparent 24px, transparent 48px)',
          pointerEvents: 'none',
        }} />

        {/* Card */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: 'min(400px, calc(100vw - 24px))',
            background: '#0C0C10',
            border: '4px solid #F5EFE3',
            boxShadow: '10px 10px 0 #FFD51F',
            overflow: 'hidden',
            animation: visible ? 'crm-pop 280ms cubic-bezier(0.22,1,0.36,1) both' : 'none',
            position: 'relative',
          }}
        >
          {/* Top colour bar */}
          <div style={{ height: 6, background: '#8A3DFF', borderBottom: '3px solid #F5EFE3' }} />

          {/* Header row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px 0',
          }}>
            {/* Campaign badge */}
            <div style={{
              background: '#8A3DFF',
              border: '2px solid #F5EFE3',
              boxShadow: '3px 3px 0 #F5EFE3',
              padding: '4px 12px',
              fontFamily: '"Archivo Black", sans-serif',
              fontSize: 9,
              letterSpacing: '0.2em',
              color: '#FFFFFF',
              textTransform: 'uppercase',
              animation: 'crm-pulse-badge 2.4s ease-in-out infinite',
            }}>
              ⚡ CAMPAIGN
            </div>

            {/* Close */}
            <button
              onClick={handleDismiss}
              style={{
                background: 'rgba(245,239,227,0.12)',
                border: '2px solid rgba(245,239,227,0.35)',
                color: '#F5EFE3',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: '"Archivo Black", sans-serif',
                fontSize: 18,
                cursor: 'pointer',
                lineHeight: 1,
                touchAction: 'manipulation',
              }}
            >
              ×
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '16px 18px 20px' }}>
            {/* Main headline */}
            <div style={{
              fontFamily: '"Archivo Black", sans-serif',
              fontSize: 'clamp(26px, 7vw, 34px)',
              letterSpacing: '-0.03em',
              lineHeight: 0.96,
              color: '#FFD51F',
              WebkitTextStroke: '1.5px #F5EFE3',
              paintOrder: 'stroke fill',
              textTransform: 'uppercase',
              marginBottom: 14,
            }}>
              WIN REAL
              <br />
              PRIZES.
            </div>

            {/* Thursday reset pill */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#FFD51F',
              border: '3px solid #F5EFE3',
              boxShadow: '3px 3px 0 #F5EFE3',
              padding: '5px 12px',
              fontFamily: '"Archivo Black", sans-serif',
              fontSize: 10,
              letterSpacing: '0.14em',
              color: '#0C0C10',
              textTransform: 'uppercase',
              marginBottom: 14,
            }}>
              🗓 LEADERBOARD RESETS THURSDAY
            </div>

            {/* Body copy */}
            <p style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: 'clamp(12px, 3.5vw, 14px)',
              fontWeight: 600,
              lineHeight: 1.6,
              color: 'rgba(245,239,227,0.82)',
              margin: '0 0 18px',
            }}>
              The Blokaz monthly social campaign is starting when the leaderboard resets this Thursday. Stack your highest score before the reset — top players win real stablecoin prizes.
            </p>

            {/* Prize chips row */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
              {['🥇 USDT PRIZES', '📅 RESETS THURSDAY', '🏆 MONTHLY CAMPAIGN'].map(label => (
                <div key={label} style={{
                  border: '2px solid rgba(245,239,227,0.3)',
                  padding: '3px 10px',
                  fontFamily: '"Archivo Black", sans-serif',
                  fontSize: 9,
                  letterSpacing: '0.12em',
                  color: 'rgba(245,239,227,0.65)',
                  textTransform: 'uppercase',
                }}>
                  {label}
                </div>
              ))}
            </div>

            {/* Primary CTA */}
            <button
              onClick={handleCTA}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                boxSizing: 'border-box',
                background: '#8A3DFF',
                border: '4px solid #F5EFE3',
                boxShadow: '4px 4px 0 #F5EFE3',
                padding: 'clamp(12px, 3vw, 14px) 16px',
                fontFamily: '"Archivo Black", sans-serif',
                fontSize: 'clamp(11px, 3vw, 13px)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#FFFFFF',
                cursor: 'pointer',
                marginBottom: 8,
                touchAction: 'manipulation',
              }}
            >
              <span>FOLLOW FOR UPDATES</span>
              <span style={{ fontSize: 18, lineHeight: 1 }}>→</span>
            </button>

            {/* Secondary: play now */}
            <button
              onClick={handleDismiss}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                boxSizing: 'border-box',
                background: 'transparent',
                border: '3px solid rgba(245,239,227,0.3)',
                padding: '11px 16px',
                fontFamily: '"Archivo Black", sans-serif',
                fontSize: 'clamp(11px, 3vw, 13px)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'rgba(245,239,227,0.7)',
                cursor: 'pointer',
                touchAction: 'manipulation',
              }}
            >
              <span>PLAY NOW & STACK MY SCORE</span>
              <span style={{ fontSize: 18, lineHeight: 1 }}>→</span>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default CampaignReminderModal
