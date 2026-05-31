import React from 'react'
import { usePowerUpStore, type PowerUpId } from '../stores/powerUpStore'
import { useGameStore } from '../stores/gameStore'

interface PowerUpBarProps {
  onOpenShop: () => void
  rotatePassEnabled: boolean
  onRotatePiece: (pieceIndex: number) => void
  activePieceIndex: number | null
}

// ── Design tokens ──────────────────────────────────────────────
const INK = '#0C0C10'
const PAPER = '#F5EFE3'
const LIME = '#B7FF3B'
const YELLOW = '#FFD51F'

const PBT = '4px solid #0C0C10'
const PB = '3px solid #0C0C10'
const PSH = (x = 5, y = 5, c = INK) => `${x}px ${y}px 0 ${c}`

// ── Piece palette per power-up ─────────────────────────────────
const PU_CONFIG = {
  scoreBoost:  { bg: '#FFD51F', fg: INK,   label: 'BOOST'  },
  shield:      { bg: '#3B82F6', fg: '#fff', label: 'SHIELD' },
  bomb:        { bg: '#FF3B3B', fg: '#fff', label: 'BOMB'   },
  rotatePass:  { bg: '#38BDF8', fg: INK,   label: 'SPIN'   },
} as const

// ── Crisp blocky SVG icons ─────────────────────────────────────
function IcoBoost({ c = INK }: { c?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" fill={c} stroke={c} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}
function IcoShield({ c = INK }: { c?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none">
      <path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3Z" fill={c} stroke={c} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 11.5 11 14l4-4.5" stroke={PAPER} strokeWidth="2" strokeLinecap="square" />
    </svg>
  )
}
function IcoBomb({ c = INK }: { c?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none">
      <circle cx="11" cy="15" r="6.5" fill={c} />
      <path d="M15 9l2.5-2.5M18 5l1 1m-1-1 1-1m-1 1-1-1" stroke={c} strokeWidth="2" strokeLinecap="square" />
      <circle cx="9" cy="13" r="1.6" fill={PAPER} />
    </svg>
  )
}
function IcoSpin({ c = INK }: { c?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none">
      <path d="M20 12a8 8 0 1 1-2.3-5.6" stroke={c} strokeWidth="2.6" strokeLinecap="square" />
      <path d="M20 3.5V8h-4.5z" fill={c} />
    </svg>
  )
}
function IcoShop({ c = YELLOW }: { c?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none">
      <path d="M5 8h14l-1 12H6L5 8Z" fill={c} />
      <path d="M9 9V6a3 3 0 0 1 6 0v3" stroke={c} strokeWidth="2.4" strokeLinecap="square" />
      <path d="M9.5 13h5" stroke={INK} strokeWidth="2" strokeLinecap="square" />
    </svg>
  )
}

const ICONS: Record<string, (fg: string) => React.ReactNode> = {
  scoreBoost: (fg) => <IcoBoost c={fg} />,
  shield:     (fg) => <IcoShield c={fg} />,
  bomb:       (fg) => <IcoBomb c={fg} />,
  rotatePass: (fg) => <IcoSpin c={fg} />,
}

// ── Rotated count sticker ──────────────────────────────────────
function CountSticker({ n, depleted }: { n: number; depleted: boolean }) {
  return (
    <div style={{
      position: 'absolute', top: -10, right: -8,
      minWidth: 22, height: 22, padding: '0 5px',
      background: depleted ? '#C9C0B0' : LIME,
      color: depleted ? '#fff' : INK,
      border: '2.5px solid #0C0C10',
      display: 'grid', placeItems: 'center',
      transform: 'rotate(6deg)',
      fontFamily: '"Archivo Black", sans-serif',
      fontSize: 11,
      boxShadow: '1px 1px 0 #0C0C10',
      zIndex: 3,
    }}>
      {n}
    </div>
  )
}

// ── Single power-up tile (Direction A) ────────────────────────
function PowerTile({
  id, charges, isActive, onClick,
}: {
  id: keyof typeof PU_CONFIG
  charges: number
  isActive: boolean
  onClick: () => void
}) {
  const cfg = PU_CONFIG[id]
  const depleted = charges === 0
  const tileBg = depleted ? '#E7E0D2' : cfg.bg
  const iconColor = depleted ? '#A8A095' : (cfg.fg === '#fff' ? '#fff' : INK)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
      {/* tile wrapper handles the active translate */}
      <div style={{
        position: 'relative',
        transform: isActive ? 'translate(5px,5px)' : 'none',
        transition: 'transform 80ms',
      }}>
        <button
          onClick={onClick}
          style={{
            width: 54, height: 54,
            background: tileBg,
            border: PBT,
            boxShadow: isActive ? PSH(0, 0) : PSH(3, 3),
            outline: isActive ? `3px solid ${LIME}` : 'none',
            outlineOffset: 3,
            display: 'grid', placeItems: 'center',
            cursor: 'pointer',
            padding: 0,
            touchAction: 'manipulation',
            transition: 'box-shadow 80ms',
          }}
        >
          <div style={{ width: 28, height: 28, opacity: depleted ? 0.45 : 1 }}>
            {ICONS[id](iconColor)}
          </div>
        </button>
        <CountSticker n={charges} depleted={depleted} />
      </div>
      <span style={{
        fontFamily: '"Archivo Black", sans-serif',
        fontSize: 10, letterSpacing: '0.1em',
        color: depleted ? 'var(--ink-soft)' : 'var(--ink)',
        lineHeight: 1,
      }}>
        {cfg.label}
      </span>
    </div>
  )
}

// ── Shop tile ──────────────────────────────────────────────────
function ShopTile({ onClick }: { onClick: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
      <button
        onClick={onClick}
        style={{
          width: 54, height: 54,
          background: INK,
          border: PBT,
          boxShadow: PSH(3, 3, YELLOW),
          display: 'grid', placeItems: 'center',
          cursor: 'pointer',
          padding: 0,
          touchAction: 'manipulation',
        }}
      >
        <div style={{ width: 28, height: 28 }}>
          <IcoShop c={YELLOW} />
        </div>
      </button>
      <span style={{
        fontFamily: '"Archivo Black", sans-serif',
        fontSize: 10, letterSpacing: '0.1em',
        color: 'var(--ink)', lineHeight: 1,
      }}>
        SHOP
      </span>
    </div>
  )
}

// ── Rotate piece picker (styled to match Direction A) ──────────
const RotatePicker: React.FC<{
  onRotatePiece: (index: number) => void
  onCancel: () => void
}> = ({ onRotatePiece, onCancel }) => {
  const { currentPieces } = useGameStore()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {[0, 1, 2].map(i => {
          const occupied = currentPieces[i] != null
          return (
            <button
              key={i}
              onClick={() => occupied && onRotatePiece(i)}
              disabled={!occupied}
              style={{
                width: 40, height: 54,
                border: PBT,
                background: occupied ? '#38BDF8' : '#E7E0D2',
                boxShadow: occupied ? PSH(3, 3) : 'none',
                outline: occupied ? `3px solid ${LIME}` : 'none',
                outlineOffset: 3,
                cursor: occupied ? 'pointer' : 'not-allowed',
                opacity: occupied ? 1 : 0.35,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: 3,
                touchAction: 'manipulation',
                padding: 0,
              }}
            >
              <div style={{ width: 20, height: 20 }}>
                <IcoSpin c={occupied ? INK : '#A8A095'} />
              </div>
              <span style={{
                fontFamily: '"Archivo Black", sans-serif',
                fontSize: 10, letterSpacing: '0.06em',
                color: occupied ? INK : '#A8A095',
              }}>
                {i + 1}
              </span>
            </button>
          )
        })}
        <button
          onClick={onCancel}
          style={{
            width: 26, height: 54,
            border: PB,
            background: '#E7E0D2',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: '"Archivo Black", sans-serif',
            fontSize: 14, color: '#A8A095',
            touchAction: 'manipulation',
            padding: 0,
          }}
        >
          ×
        </button>
      </div>
      <span style={{
        fontFamily: '"Archivo Black", sans-serif',
        fontSize: 10, letterSpacing: '0.1em',
        color: 'var(--ink)', lineHeight: 1,
      }}>
        PICK PIECE
      </span>
    </div>
  )
}

// ── Power-Up Bar ───────────────────────────────────────────────
export const PowerUpBar: React.FC<PowerUpBarProps> = ({
  onOpenShop,
  onRotatePiece,
}) => {
  const {
    getCharges,
    active,
    bombModeActive,
    activateScoreBoost,
    activateShield,
    activateBomb,
    activateRotatePass,
    exitBombMode,
    exitRotateMode,
  } = usePowerUpStore()

  const scoreBoostCharges = getCharges('scoreBoost')
  const shieldCharges     = getCharges('shield')
  const bombCharges       = getCharges('bomb')
  const rotatePassCharges = getCharges('rotatePass')

  // Displayed charge counts
  const bombDisplayCharges = active.bombCount > 0 ? active.bombCount : bombCharges

  const handleTileClick = (id: PowerUpId) => {
    const charges = getCharges(id)
    if (charges === 0) { onOpenShop(); return }
    switch (id) {
      case 'scoreBoost':
        if (!active.scoreBoost) activateScoreBoost()
        break
      case 'shield':
        activateShield()
        break
      case 'bomb':
        if (bombModeActive) exitBombMode()
        else activateBomb()
        break
      case 'rotatePass':
        if (!active.rotatePassActive) activateRotatePass()
        break
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      padding: '10px 14px 6px',
    }}>
      {/* Power-up tiles */}
      <div style={{ display: 'flex', gap: 10 }}>
        {/* Score Boost */}
        <PowerTile
          id="scoreBoost"
          charges={scoreBoostCharges}
          isActive={active.scoreBoost}
          onClick={() => handleTileClick('scoreBoost')}
        />

        {/* Shield */}
        <PowerTile
          id="shield"
          charges={shieldCharges}
          isActive={active.shieldCount > 0}
          onClick={() => handleTileClick('shield')}
        />

        {/* Bomb */}
        <PowerTile
          id="bomb"
          charges={bombDisplayCharges}
          isActive={bombModeActive}
          onClick={() => handleTileClick('bomb')}
        />

        {/* Rotate Pass — tile OR picker when active */}
        {active.rotatePassActive ? (
          <RotatePicker
            onRotatePiece={onRotatePiece}
            onCancel={exitRotateMode}
          />
        ) : (
          <PowerTile
            id="rotatePass"
            charges={rotatePassCharges}
            isActive={false}
            onClick={() => handleTileClick('rotatePass')}
          />
        )}
      </div>

      {/* Divider + SHOP */}
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 10 }}>
        <div style={{
          width: 3,
          background: 'var(--rule)',
          margin: '2px 0 18px',
          alignSelf: 'stretch',
        }} />
        <ShopTile onClick={onOpenShop} />
      </div>
    </div>
  )
}

export default PowerUpBar
