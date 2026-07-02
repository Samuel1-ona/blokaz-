import React, { useState } from 'react'
import HowToPlayModal from './HowToPlayModal'

const MINIPAY_URL = 'https://minipay.to/'
const TWITTER_URL = 'https://twitter.com/playblokaz'
const TELEGRAM_URL = 'https://t.me/playblokaz'

interface MiniPayGateModalProps {
  /** Final score from the trial game — omit to show the lobby gate (no score) */
  score?: number
}

export const MiniPayGateModal: React.FC<MiniPayGateModalProps> = ({ score }) => {
  const [showHowToPlay, setShowHowToPlay] = useState(false)

  const hasScore = score !== undefined && score > 0
  const isLobbyGate = score === undefined

  return (
    <>
      {showHowToPlay && <HowToPlayModal onDone={() => setShowHowToPlay(false)} />}

      {/* Full-screen non-dismissible overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(12,12,16,0.88)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px 16px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 420,
            background: 'var(--paper, #f5efe3)',
            border: '4px solid var(--ink, #0c0c10)',
            boxShadow: '10px 10px 0 var(--ink, #0c0c10)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* ── Header strip ─────────────────────────────────────────── */}
          <div
            style={{
              background: 'var(--ink, #0c0c10)',
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            {/* Blokaz wordmark */}
            <div
              style={{
                fontFamily: '"Archivo Black", sans-serif',
                fontSize: 13,
                letterSpacing: '0.22em',
                color: '#ffd51f',
                textTransform: 'uppercase',
              }}
            >
              BLOKAZ
            </div>
            {/* Trial badge */}
            <div
              style={{
                fontFamily: '"Archivo Black", sans-serif',
                fontSize: 9,
                letterSpacing: '0.18em',
                color: 'var(--ink, #0c0c10)',
                background: '#ffd51f',
                border: '2px solid #ffd51f',
                padding: '3px 10px',
                textTransform: 'uppercase',
              }}
            >
              WEB TRIAL
            </div>
          </div>

          {/* ── Score block (only on game-over path) ─────────────────── */}
          {hasScore && (
            <div
              style={{
                borderBottom: '4px solid var(--ink, #0c0c10)',
                padding: '20px 24px',
                background: 'var(--paper-2, #fffaf4)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <div
                style={{
                  fontFamily: '"Archivo Black", sans-serif',
                  fontSize: 11,
                  letterSpacing: '0.24em',
                  color: 'var(--muted, #6b6b73)',
                  textTransform: 'uppercase',
                }}
              >
                YOUR SCORE
              </div>
              <div
                style={{
                  fontFamily: '"Archivo Black", sans-serif',
                  fontSize: 64,
                  letterSpacing: '-0.04em',
                  lineHeight: 1,
                  color: 'var(--ink, #0c0c10)',
                  background: '#ffd51f',
                  border: '4px solid var(--ink, #0c0c10)',
                  boxShadow: '5px 5px 0 var(--ink, #0c0c10)',
                  padding: '8px 24px',
                  marginTop: 6,
                }}
              >
                {score!.toLocaleString()}
              </div>
            </div>
          )}

          {/* ── Body ─────────────────────────────────────────────────── */}
          <div style={{ padding: '24px 24px 20px' }}>
            <div
              style={{
                fontFamily: '"Archivo Black", sans-serif',
                fontSize: 26,
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
                color: 'var(--ink, #0c0c10)',
                textTransform: 'uppercase',
                marginBottom: 12,
              }}
            >
              {isLobbyGate ? (
                <>YOUR FREE TRIAL<br />HAS BEEN USED.</>
              ) : (
                <>YOUR TRIAL<br />IS OVER.</>
              )}
            </div>

            <p
              style={{
                fontFamily: '"Space Grotesk", "Archivo Black", sans-serif',
                fontSize: 14,
                lineHeight: 1.6,
                color: 'var(--ink-soft, #2a2a33)',
                margin: 0,
                marginBottom: 20,
              }}
            >
              To save your score, join the weekly leaderboard, and compete
              for USDT prizes — you need{' '}
              <strong style={{ color: 'var(--ink, #0c0c10)' }}>MiniPay</strong>.
              Find <strong>Blokaz</strong> inside the MiniPay app to keep
              playing on-chain.
            </p>

            {/* Step pills */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                marginBottom: 24,
              }}
            >
              {[
                { n: '1', text: 'Download MiniPay' },
                { n: '2', text: 'Open the MiniPay browser' },
                { n: '3', text: 'Find & play Blokaz in-app' },
              ].map(({ n, text }) => (
                <div
                  key={n}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    border: '3px solid var(--ink, #0c0c10)',
                    padding: '10px 14px',
                    background: 'var(--paper-2, #fffaf4)',
                    boxShadow: '3px 3px 0 var(--ink, #0c0c10)',
                  }}
                >
                  <div
                    style={{
                      fontFamily: '"Archivo Black", sans-serif',
                      fontSize: 14,
                      width: 28,
                      height: 28,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'var(--ink, #0c0c10)',
                      color: '#ffd51f',
                      flexShrink: 0,
                      border: '2px solid var(--ink, #0c0c10)',
                    }}
                  >
                    {n}
                  </div>
                  <span
                    style={{
                      fontFamily: '"Archivo Black", sans-serif',
                      fontSize: 13,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--ink, #0c0c10)',
                    }}
                  >
                    {text}
                  </span>
                </div>
              ))}
            </div>

            {/* Primary CTA */}
            <a
              href={MINIPAY_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                background: '#0c0c10',
                border: '4px solid #0c0c10',
                boxShadow: '6px 6px 0 #b7ff3b',
                padding: '16px 20px',
                fontFamily: '"Archivo Black", sans-serif',
                fontSize: 15,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#b7ff3b',
                textDecoration: 'none',
                marginBottom: 10,
                cursor: 'pointer',
              }}
            >
              <span>GET MINIPAY</span>
              <span style={{ fontSize: 20 }}>→</span>
            </a>

            {/* Secondary CTA */}
            <button
              onClick={() => setShowHowToPlay(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                background: 'transparent',
                border: '3px solid var(--ink, #0c0c10)',
                boxShadow: '4px 4px 0 var(--ink, #0c0c10)',
                padding: '12px 20px',
                fontFamily: '"Archivo Black", sans-serif',
                fontSize: 12,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--ink, #0c0c10)',
                cursor: 'pointer',
                marginBottom: 16,
              }}
            >
              HOW IT WORKS
            </button>

            {/* Social links */}
            <div
              style={{
                display: 'flex',
                gap: 8,
                borderTop: '2px solid rgba(12,12,16,0.12)',
                paddingTop: 16,
              }}
            >
              <a
                href={TWITTER_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  background: '#0c0c10',
                  border: '3px solid #0c0c10',
                  boxShadow: '3px 3px 0 #0c0c10',
                  padding: '10px 12px',
                  fontFamily: '"Archivo Black", sans-serif',
                  fontSize: 11,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: '#ffffff',
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}
              >
                {/* X / Twitter icon */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.263 5.633 5.901-5.633Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                TWITTER
              </a>
              <a
                href={TELEGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  background: '#229ED9',
                  border: '3px solid #0c0c10',
                  boxShadow: '3px 3px 0 #0c0c10',
                  padding: '10px 12px',
                  fontFamily: '"Archivo Black", sans-serif',
                  fontSize: 11,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: '#ffffff',
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}
              >
                {/* Telegram icon */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/>
                </svg>
                TELEGRAM
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default MiniPayGateModal
