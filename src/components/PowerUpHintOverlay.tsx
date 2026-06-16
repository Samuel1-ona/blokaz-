// PowerUpHintOverlay — a finger that slides up from below to tap the correct
// power-up button, then fires onBoardEffect so the canvas shadow plays.
// Rendered at fixed z-index so it floats above all game UI.

import React, { useEffect, useRef, useState } from 'react'
import type { HintType } from '../canvas/PowerUpHintManager'

export type { HintType }

// Inject ripple keyframe once
if (typeof document !== 'undefined' && !document.getElementById('pu-hint-overlay-style')) {
  const s = document.createElement('style')
  s.id = 'pu-hint-overlay-style'
  s.textContent = `
    @keyframes pu-tap-ripple {
      0%   { transform: scale(0.25); opacity: 1; }
      100% { transform: scale(2.4);  opacity: 0; }
    }
  `
  document.head.appendChild(s)
}

// ── Finger SVG pointing upward (tip at top) ──────────────────────────────────
function FingerUp({ pressing }: { pressing: boolean }) {
  return (
    <svg
      width="24" height="46"
      viewBox="0 0 24 46"
      fill="none"
      style={{
        transform: pressing ? 'scaleY(0.92) scaleX(0.96)' : 'scale(1)',
        transition: 'transform 80ms ease-in',
        display: 'block',
      }}
    >
      {/* Finger body — pill shape, narrower at tip */}
      <path
        d="M12 1 C8.5 1 7 4 7 8 L7 33 C7 37 9 40 12 40 C15 40 17 37 17 33 L17 8 C17 4 15.5 1 12 1Z"
        fill="white" stroke="#1a1a1a" strokeWidth="1.5" strokeLinejoin="round"
      />
      {/* Palm widening at base */}
      <path
        d="M5 32 C4 32 3 34 3 36 C3 40 6 43 12 43 C18 43 21 40 21 36 C21 34 20 32 19 32Z"
        fill="white" stroke="#1a1a1a" strokeWidth="1.5" strokeLinejoin="round"
      />
      {/* Fingernail */}
      <ellipse cx="12" cy="5" rx="3.2" ry="2.8" fill="#f0e0d0" stroke="#d4c4b0" strokeWidth="0.8"/>
      {/* Knuckle crease */}
      <path d="M8 22 Q12 24 16 22" stroke="#ddd" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
    </svg>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  hintTrigger: { type: HintType; id: number } | null
  onBoardEffect: (type: HintType) => void
}

export const PowerUpHintOverlay: React.FC<Props> = ({ hintTrigger, onBoardEffect }) => {
  const [visible, setVisible]   = useState(false)
  const [handX, setHandX]       = useState(0)
  const [handY, setHandY]       = useState(0)
  const [opacity, setOpacity]   = useState(0)
  const [pressing, setPressing] = useState(false)
  const [ripple, setRipple]     = useState<{ x: number; y: number } | null>(null)

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    // Clear any running animation
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []

    if (!hintTrigger) { setVisible(false); return }

    const btn = document.getElementById(`pu-tile-${hintTrigger.type}`)
    if (!btn) {
      // No button found — skip straight to board effect
      onBoardEffect(hintTrigger.type)
      return
    }

    const r  = btn.getBoundingClientRect()
    const cx = r.left + r.width  / 2
    const cy = r.top  + r.height / 2

    // The finger tip is at the TOP of the 46px SVG, so placing the div at
    // `top: handY` puts the finger tip at that y coordinate.
    const entryY = cy + 72    // tip starts well below button
    const restY  = cy + 10    // tip hovers just below button center
    const tapY   = cy - 2     // tip presses into button

    const at = (fn: () => void, ms: number) => {
      const t = setTimeout(fn, ms)
      timersRef.current.push(t)
    }

    // Initialise: below + invisible
    setHandX(cx - 12)   // 12 = half of 24px SVG width
    setHandY(entryY)
    setOpacity(0)
    setPressing(false)
    setRipple(null)
    setVisible(true)

    at(() => setOpacity(1),                                  40)   // fade in
    at(() => setHandY(restY),                                80)   // slide up to hover
    at(() => { setPressing(true);  setHandY(tapY) },        620)   // press into button
    at(() => setRipple({ x: cx, y: cy }),                   700)   // ripple burst
    at(() => { setPressing(false); setHandY(restY) },        900)   // lift off
    at(() => { setRipple(null); onBoardEffect(hintTrigger.type) }, 1050)  // board effect
    at(() => { setHandY(entryY); setOpacity(0) },           1250)  // exit downward
    at(() => setVisible(false),                             1650)   // unmount

    return () => { timersRef.current.forEach(clearTimeout); timersRef.current = [] }
  }, [hintTrigger?.id, hintTrigger?.type])   // re-run on every new trigger

  if (!visible) return null

  return (
    <div
      aria-hidden
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9200 }}
    >
      {/* Finger */}
      <div
        style={{
          position: 'absolute',
          left: handX,
          top: handY,
          opacity,
          transition: [
            'top 420ms cubic-bezier(0.35, 0, 0.25, 1)',
            'opacity 240ms ease',
          ].join(', '),
          filter: 'drop-shadow(0 5px 12px rgba(0,0,0,0.55))',
          willChange: 'top, opacity',
        }}
      >
        <FingerUp pressing={pressing} />
      </div>

      {/* Ripple ring on the button */}
      {ripple && (
        <div
          key={hintTrigger?.id}
          style={{
            position: 'absolute',
            left: ripple.x - 26,
            top:  ripple.y - 26,
            width: 52,
            height: 52,
            borderRadius: '50%',
            border: '2.5px solid rgba(255,255,255,0.9)',
            animation: 'pu-tap-ripple 0.48s ease-out forwards',
          }}
        />
      )}
    </div>
  )
}
