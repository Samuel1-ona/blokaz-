import React, { useEffect, useState } from 'react'

const DISPLAY_MS = 2800
const FADE_MS    = 500

interface SplashScreenProps {
  onDone: () => void
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onDone }) => {
  const [phase, setPhase] = useState<'in' | 'visible' | 'out'>('in')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('visible'), 60)
    const t2 = setTimeout(() => setPhase('out'), DISPLAY_MS)
    const t3 = setTimeout(() => onDone(), DISPLAY_MS + FADE_MS)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onDone])

  const INK    = '#111111'
  const YELLOW = '#FFE600'
  const WHITE  = '#FFFFFF'

  const rootOpacity = phase === 'in' ? 0 : phase === 'visible' ? 1 : 0

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: INK,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: rootOpacity,
        transition: `opacity ${FADE_MS}ms ease`,
        pointerEvents: phase === 'out' ? 'none' : 'all',
        fontFamily: "'Archivo Black', sans-serif",
      }}
    >
      {/* Grid texture */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(${YELLOW}18 1px, transparent 1px),
            linear-gradient(90deg, ${YELLOW}18 1px, transparent 1px)
          `,
          backgroundSize: '36px 36px',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: 'min(88vw, 400px)',
          gap: 0,
        }}
      >
        {/* ── Cracked Studios label bar ── */}
        <div
          style={{
            width: '100%',
            background: YELLOW,
            border: `4px solid ${INK}`,
            borderBottom: 'none',
            padding: '7px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ color: INK, fontSize: 9, letterSpacing: '0.22em' }}>
            CRACKED STUDIOS
          </span>
          <span style={{ display: 'flex', gap: 4 }}>
            {[1, 0.65, 0.35].map((op, i) => (
              <span key={i} style={{ display: 'block', width: 6, height: 6, background: INK, opacity: op }} />
            ))}
          </span>
        </div>

        {/* ── Main card ── */}
        <div
          style={{
            width: '100%',
            background: INK,
            border: `4px solid ${INK}`,
            boxShadow: `8px 8px 0 ${YELLOW}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '24px 24px 20px',
            gap: 16,
          }}
        >
          {/* Cracked Studios logo */}
          <picture style={{ width: '65%', maxWidth: 240 }}>
            <source srcSet="/crackedstudioslogo.webp" type="image/webp" width={199} height={61} />
            <img
              src="/crackedstudioslogo.png"
              alt="Cracked Studios"
              width={199}
              height={61}
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
          </picture>

          {/* PRESENTS → BLOKAZ divider row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
            <div style={{ flex: 1, height: 2, background: `${YELLOW}40` }} />
            <span style={{ color: YELLOW, fontSize: 9, letterSpacing: '0.28em' }}>PRESENTS</span>
            <div style={{ flex: 1, height: 2, background: `${YELLOW}40` }} />
          </div>

          {/* ── Blokaz game logo ── */}
          <picture style={{ width: '80%', maxWidth: 280 }}>
            <source srcSet="/Blokaz_logo.webp" type="image/webp" />
            <img
              src="/Blokaz_logo.png"
              alt="Blokaz"
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
          </picture>

          {/* BLOKAZ wordmark */}
          <div
            style={{
              color: WHITE,
              fontSize: 'clamp(32px, 10vw, 48px)',
              letterSpacing: '-0.02em',
              lineHeight: 1,
              textTransform: 'uppercase',
              textShadow: `3px 3px 0 ${YELLOW}`,
            }}
          >
            BLOKAZ
          </div>

          {/* Progress bar */}
          <div
            style={{
              width: '100%',
              height: 5,
              border: `2px solid ${WHITE}20`,
              background: `${WHITE}08`,
              overflow: 'hidden',
              marginTop: 4,
            }}
          >
            <div
              style={{
                height: '100%',
                background: YELLOW,
                animation: `splashBar ${DISPLAY_MS}ms linear forwards`,
              }}
            />
          </div>
        </div>

        {/* Bottom accent strip */}
        <div style={{ width: 'calc(100% - 8px)', height: 8, background: YELLOW, marginLeft: 8 }} />
      </div>

      <style>{`
        @keyframes splashBar {
          from { width: 0% }
          to   { width: 100% }
        }
      `}</style>
    </div>
  )
}

export default SplashScreen
