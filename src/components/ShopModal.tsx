import React, { useState } from 'react'
import { useStablecoinShop } from '../hooks/useStablecoinShop'
import { usePowerUpStore, type PowerUpId } from '../stores/powerUpStore'
import { STABLECOIN_TOKENS, type StablecoinSymbol } from '../constants/contracts'

interface ShopModalProps {
  isOpen: boolean
  onClose: () => void
}

type ShopItemId = PowerUpId | 'revivalBundle'
type ShopTab = 'consumables' | 'cosmetics' | 'season'

// ── Design tokens (hardcoded for consistent rendering) ──────
const INK = '#0C0C10'
const PAPER = '#F5EFE3'
const PAPER2 = '#EDE8DA'
const CYAN = '#38BDF8'
const YELLOW = '#FFD51F'
const LIME = '#B7FF3B'
const RED = '#FF3B3B'
const BLUE = '#3B82F6'
const ORANGE = '#FB923C'
const PINK = '#FF3BBD'

const SB = '3px solid #0C0C10'
const SBT = '4px solid #0C0C10'
const SSH = (x = 6, y = 6, c = INK) => `${x}px ${y}px 0 ${c}`

interface ItemDesign {
  glyph: string
  bg: string
  name: string
  desc: string
  price: string
  tag?: string
  best?: boolean
}

// ── Visual metadata for each shop item ─────────────────────
const ITEM_DESIGN: Record<string, ItemDesign> = {
  revivalBundle: {
    glyph: '↻', bg: CYAN,
    name: 'Revival Bundle',
    desc: 'Three extra revivals to stack for this session.',
    price: '0.10', tag: '3×', best: true,
  },
  scoreBoost: {
    glyph: '⚡', bg: YELLOW,
    name: 'Score Boost',
    desc: '×1.5 base points for one full game.',
    price: '0.10', tag: '×1.5',
  },
  shield: {
    glyph: '⛊', bg: BLUE,
    name: 'Shield',
    desc: 'Prevents one game-over — emergency empty row.',
    price: '0.10', tag: 'SAVE',
  },
  bomb: {
    glyph: '✸', bg: RED,
    name: 'Bomb',
    desc: 'Clear a 3×3 zone. 5 pts per cell, one-time use.',
    price: '0.10', tag: '3×3',
  },
  rotatePass: {
    glyph: '⟳', bg: ORANGE,
    name: 'Rotate Pass',
    desc: 'Unlock piece rotation for one session.',
    price: '0.10', tag: '1 GAME',
  },
}

const CONSUMABLE_IDS: ShopItemId[] = ['revivalBundle', 'scoreBoost', 'shield', 'bomb', 'rotatePass']

const TOKEN_LABELS: Record<StablecoinSymbol, string> = {
  USDC: 'USDC',
  USDT: 'USDT',
  USDm: 'USDm',
}

// ── Item Glyph Tile ─────────────────────────────────────────
function ItemGlyph({ glyph, bg, size = 56 }: { glyph: string; bg: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, background: INK, color: bg,
      border: `2.5px solid ${bg}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '"Archivo Black", system-ui',
      fontSize: Math.round(size * 0.46),
      lineHeight: 1, flexShrink: 0,
    }}>
      {glyph}
    </div>
  )
}

// ── Price Chip ──────────────────────────────────────────────
function PriceChip({ amount, token = 'USDT', bg = LIME }: { amount: string; token?: string; bg?: string }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'baseline', gap: 5,
      background: bg, color: INK, border: SB,
      padding: '5px 10px', boxShadow: SSH(3, 3),
      fontFamily: '"Archivo Black", system-ui',
    }}>
      <span style={{ fontSize: 16, letterSpacing: '-0.02em' }}>${amount}</span>
      <span style={{ fontSize: 9, letterSpacing: '0.12em', opacity: 0.7 }}>{token}</span>
    </div>
  )
}

// ── Item Card ───────────────────────────────────────────────
function ItemCard({
  design, onBuy, isBuying, isSuccess, affordable, freeTryCount, purchasedCount,
}: {
  design: ItemDesign
  onBuy: () => void
  isBuying: boolean
  isSuccess: boolean
  affordable: boolean
  freeTryCount: number
  purchasedCount: number
}) {
  const [hover, setHover] = useState(false)
  const off = hover ? 4 : 6

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: PAPER, border: SBT, boxShadow: SSH(off, off),
        transform: `translate(${6 - off}px, ${6 - off}px)`,
        transition: 'all 90ms ease-out',
        padding: 14, position: 'relative',
        display: 'flex', flexDirection: 'column', gap: 10,
        fontFamily: '"Archivo Black", system-ui',
      }}
    >
      {design.best && (
        <div style={{
          position: 'absolute', top: -12, right: -10,
          background: RED, color: '#fff', border: SB,
          padding: '3px 9px', fontSize: 10, letterSpacing: '0.12em',
          transform: 'rotate(6deg)', boxShadow: SSH(2, 2),
        }}>
          BEST VALUE
        </div>
      )}

      {/* Top row: glyph + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <ItemGlyph glyph={design.glyph} bg={design.bg} size={54} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 17, letterSpacing: '-0.01em', lineHeight: 1.05, color: INK }}>
              {design.name}
            </span>
            {design.tag && (
              <span style={{
                background: design.bg, color: INK, border: '2px solid #0C0C10',
                padding: '1px 6px', fontSize: 9, letterSpacing: '0.1em', flexShrink: 0,
              }}>
                {design.tag}
              </span>
            )}
            {freeTryCount > 0 && (
              <span style={{
                background: LIME, color: INK, border: '2px solid #0C0C10',
                padding: '1px 6px', fontSize: 9, letterSpacing: '0.1em', flexShrink: 0,
              }}>
                {freeTryCount} FREE
              </span>
            )}
            {purchasedCount > 0 && (
              <span style={{
                background: CYAN, color: INK, border: '2px solid #0C0C10',
                padding: '1px 6px', fontSize: 9, letterSpacing: '0.1em', flexShrink: 0,
              }}>
                {purchasedCount} OWNED
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <div style={{
        fontFamily: 'Space Grotesk, system-ui', fontSize: 12,
        fontWeight: 600, color: INK, opacity: 0.75, lineHeight: 1.4,
      }}>
        {design.desc}
      </div>

      {/* Bottom row: price + buy */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <PriceChip amount={design.price} />
        <button
          onClick={onBuy}
          disabled={!affordable || isBuying}
          style={{
            background: isSuccess ? LIME : INK,
            color: isSuccess ? INK : PAPER,
            border: SB,
            boxShadow: SSH(3, 3, design.bg),
            padding: '8px 16px',
            fontFamily: '"Archivo Black", system-ui',
            fontSize: 12, letterSpacing: '0.12em',
            cursor: affordable && !isBuying ? 'pointer' : 'not-allowed',
            opacity: !affordable ? 0.4 : 1,
            minWidth: 64,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            transition: 'background 150ms',
          }}
        >
          {isSuccess ? '✓ DONE' : isBuying ? '…' : 'BUY'}
        </button>
      </div>
    </div>
  )
}

// ── Season Pass Card ────────────────────────────────────────
function SeasonPassCard({ onBuy, isBuying, isSuccess, affordable }: {
  onBuy: () => void
  isBuying: boolean
  isSuccess: boolean
  affordable: boolean
}) {
  const sunburst = [
    `conic-gradient(from 0deg at 80% 30%,`,
    `${YELLOW} 0 20deg, transparent 20deg 40deg,`,
    `${YELLOW} 40deg 60deg, transparent 60deg 80deg,`,
    `${YELLOW} 80deg 100deg, transparent 100deg 120deg,`,
    `${YELLOW} 120deg 140deg, transparent 140deg 160deg,`,
    `${YELLOW} 160deg 180deg, transparent 180deg 200deg,`,
    `${YELLOW} 200deg 220deg, transparent 220deg 240deg,`,
    `${YELLOW} 240deg 260deg, transparent 260deg 280deg,`,
    `${YELLOW} 280deg 300deg, transparent 300deg 320deg,`,
    `${YELLOW} 320deg 340deg, transparent 340deg 360deg)`,
  ].join(' ')

  return (
    <div style={{
      background: INK, color: PAPER, border: SBT, boxShadow: SSH(8, 8, PINK),
      padding: 18, position: 'relative', overflow: 'hidden',
      fontFamily: '"Archivo Black", system-ui',
    }}>
      {/* Sunburst overlay */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.14, pointerEvents: 'none',
        background: sunburst,
      }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{
            display: 'inline-block', background: YELLOW, color: INK,
            padding: '4px 10px', fontSize: 11, letterSpacing: '0.16em',
            transform: 'rotate(-2deg)', border: '2px solid #0C0C10',
          }}>
            SEASON PASS
          </div>
          <PriceChip amount="0.10" bg={YELLOW} />
        </div>
        <div style={{ fontSize: 28, letterSpacing: '-0.02em', marginTop: 12, lineHeight: 1.05 }}>
          2× LEADERBOARD POINTS
        </div>
        <div style={{
          fontFamily: 'Space Grotesk, system-ui', fontSize: 13, fontWeight: 600,
          opacity: 0.8, marginTop: 8, lineHeight: 1.4,
        }}>
          Double every point you earn this epoch, plus exclusive piece skins. Auto-renews weekly.
        </div>
        <button
          onClick={onBuy}
          disabled={!affordable || isBuying}
          style={{
            marginTop: 14, width: '100%',
            background: isSuccess ? LIME : LIME,
            color: INK,
            border: `3px solid ${PAPER}`,
            boxShadow: SSH(4, 4, PAPER),
            padding: '12px',
            fontFamily: '"Archivo Black", system-ui',
            fontSize: 14, letterSpacing: '0.12em',
            cursor: affordable && !isBuying ? 'pointer' : 'not-allowed',
            opacity: !affordable ? 0.4 : 1,
          }}
        >
          {isSuccess ? '✓ PURCHASED!' : isBuying ? '…' : 'UNLOCK SEASON PASS →'}
        </button>
      </div>
    </div>
  )
}

// ── Purchase Confirm / Success Sheet ────────────────────────
function PurchaseSheet({ item, balance, selectedToken, onConfirm, onCancel, state }: {
  item: ItemDesign | null
  balance: string
  selectedToken: StablecoinSymbol
  onConfirm: () => void
  onCancel: () => void
  state: 'confirm' | 'success' | null
}) {
  if (!item || !state) return null
  const afterBalance = (parseFloat(balance) - parseFloat(item.price)).toFixed(3)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9100,
      fontFamily: '"Archivo Black", system-ui',
    }}>
      {/* Scrim */}
      <div onClick={onCancel} style={{
        position: 'absolute', inset: 0, background: 'rgba(12,12,16,0.55)',
      }} />

      {/* Bottom sheet */}
      <div style={{
        position: 'absolute', left: 14, right: 14, bottom: 14,
        maxWidth: 440, margin: '0 auto',
        background: INK, color: PAPER,
        border: `4px solid ${PAPER}`,
        boxShadow: `0 -6px 0 ${INK}, 0 -10px 0 ${item.bg}`,
        padding: 18,
      }}>
        {/* Drag handle */}
        <div style={{
          width: 48, height: 4, background: PAPER, opacity: 0.4,
          margin: '0 auto 14px',
        }} />

        {state === 'confirm' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <ItemGlyph glyph={item.glyph} bg={item.bg} size={60} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, letterSpacing: '0.16em', color: item.bg }}>
                  CONFIRM PURCHASE
                </div>
                <div style={{ fontSize: 22, letterSpacing: '-0.02em', lineHeight: 1.1, marginTop: 2 }}>
                  {item.name}
                </div>
              </div>
            </div>

            {/* Breakdown */}
            <div style={{
              marginTop: 14, background: PAPER, color: INK,
              padding: '12px 14px',
              fontFamily: 'Space Grotesk, system-ui', fontWeight: 700, fontSize: 13,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ opacity: 0.6 }}>Price</span>
                <span>${item.price} {TOKEN_LABELS[selectedToken]}</span>
              </div>
              <div style={{ height: 2, background: INK, opacity: 0.12, margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ opacity: 0.6 }}>Wallet balance</span>
                <span>${balance} {TOKEN_LABELS[selectedToken]}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ opacity: 0.6 }}>After purchase</span>
                <span>${afterBalance} {TOKEN_LABELS[selectedToken]}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={onConfirm} style={{
                flex: 1, background: LIME, color: INK,
                border: `3px solid ${PAPER}`, boxShadow: SSH(4, 4, PAPER),
                padding: '12px', fontFamily: 'inherit',
                fontSize: 14, letterSpacing: '0.1em', cursor: 'pointer',
              }}>
                PAY ${item.price}
              </button>
              <button onClick={onCancel} style={{
                background: PAPER, color: INK,
                border: `3px solid ${PAPER}`,
                padding: '12px 16px', fontFamily: 'inherit',
                fontSize: 14, letterSpacing: '0.1em', cursor: 'pointer', opacity: 0.85,
              }}>
                CANCEL
              </button>
            </div>
            <div style={{
              marginTop: 10, textAlign: 'center',
              fontFamily: 'Space Grotesk, system-ui', fontSize: 11, opacity: 0.6,
              letterSpacing: '0.08em',
            }}>
              ⟳ Paid in {TOKEN_LABELS[selectedToken]} on Celo · one-tap via MiniPay
            </div>
          </>
        )}

        {state === 'success' && (
          <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
            <div style={{ display: 'inline-block', marginBottom: 12 }}>
              <ItemGlyph glyph="✓" bg={LIME} size={72} />
            </div>
            <div style={{ fontSize: 30, letterSpacing: '-0.02em', color: LIME }}>PURCHASED</div>
            <div style={{
              fontFamily: 'Space Grotesk, system-ui', fontSize: 14, fontWeight: 600,
              opacity: 0.85, marginTop: 8,
            }}>
              {item.name} is ready. Find it in your next game.
            </div>
            <button onClick={onCancel} style={{
              marginTop: 16, width: '100%', background: LIME, color: INK,
              border: `3px solid ${PAPER}`, boxShadow: SSH(4, 4, PAPER),
              padding: '12px', fontFamily: 'inherit',
              fontSize: 14, letterSpacing: '0.1em', cursor: 'pointer',
            }}>
              BACK TO SHOP
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main ShopModal ──────────────────────────────────────────
export const ShopModal: React.FC<ShopModalProps> = ({ isOpen, onClose }) => {
  const { balances, canAfford, hasAnyBalance, defaultToken, isPaying, error, purchase } = useStablecoinShop()
  const { freeTries, inventory, getCharges } = usePowerUpStore()

  const [selectedToken, setSelectedToken] = useState<StablecoinSymbol>(defaultToken)
  const [tab, setTab] = useState<ShopTab>('consumables')
  const [buyingId, setBuyingId] = useState<ShopItemId | null>(null)
  const [successId, setSuccessId] = useState<ShopItemId | null>(null)
  const [confirmData, setConfirmData] = useState<{ id: ShopItemId; design: ItemDesign } | null>(null)
  const [purchaseState, setPurchaseState] = useState<'confirm' | 'success' | null>(null)

  if (!isOpen) return null

  const tokenList = Object.keys(STABLECOIN_TOKENS) as StablecoinSymbol[]
  const selectedBalance = Number(balances[selectedToken]) / 10 ** STABLECOIN_TOKENS[selectedToken].decimals

  const handleBuyClick = (id: ShopItemId, design: ItemDesign) => {
    if (isPaying || buyingId) return
    setConfirmData({ id, design })
    setPurchaseState('confirm')
  }

  const handleConfirm = async () => {
    if (!confirmData) return
    const { id } = confirmData
    setPurchaseState(null)
    setBuyingId(id)
    const ok = await purchase(id, selectedToken)
    setBuyingId(null)
    if (ok) {
      setSuccessId(id)
      setPurchaseState('success')
      setTimeout(() => {
        setSuccessId(null)
        setPurchaseState(null)
        setConfirmData(null)
      }, 3000)
    } else {
      setConfirmData(null)
    }
  }

  const handleCancelSheet = () => {
    setConfirmData(null)
    setPurchaseState(null)
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(12,12,16,0.75)', backdropFilter: 'blur(4px)',
      }} />

      {/* Shop Panel */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9001,
        overflowY: 'auto',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '16px 8px 40px',
        boxSizing: 'border-box',
      }}>
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: 'min(440px, calc(100vw - 16px))',
            background: PAPER,
            border: SBT,
            boxShadow: SSH(8, 8),
            position: 'relative',
            fontFamily: '"Archivo Black", system-ui',
          }}
        >
          {/* Halftone background */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
            backgroundImage: 'radial-gradient(#0C0C1010 1.5px, transparent 1.5px)',
            backgroundSize: '12px 12px',
          }} />

          {/* ── Header ── */}
          <div style={{
            position: 'relative', zIndex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px',
            background: INK,
            borderBottom: SBT,
          }}>
            <div style={{ fontSize: 22, letterSpacing: '-0.02em', color: PAPER }}>
              SHOP
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Balance pill */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: INK, color: LIME,
                border: `3px solid ${LIME}`,
                padding: '4px 10px',
                boxShadow: SSH(3, 3, LIME),
              }}>
                <span style={{
                  fontSize: 9, letterSpacing: '0.12em', opacity: 0.6, color: PAPER,
                  fontFamily: '"Archivo Black", system-ui',
                }}>BAL</span>
                <span style={{
                  fontSize: 13, fontFamily: '"Archivo Black", system-ui',
                }}>
                  ${selectedBalance.toFixed(2)}
                </span>
              </div>
              {/* Close */}
              <button onClick={onClose} style={{
                background: PAPER, border: `3px solid ${PAPER}`,
                color: INK, width: 32, height: 32,
                fontFamily: '"Archivo Black", system-ui',
                fontSize: 18, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                ×
              </button>
            </div>
          </div>

          {/* ── Token Selector ── */}
          <div style={{
            position: 'relative', zIndex: 1,
            padding: '10px 16px 8px',
            borderBottom: '3px solid rgba(12,12,16,0.12)',
          }}>
            <div style={{
              fontFamily: '"Archivo Black", system-ui', fontSize: 9,
              letterSpacing: '0.18em', color: INK, opacity: 0.45, marginBottom: 8,
            }}>
              PAY WITH
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {tokenList.map(sym => {
                const bal = Number(balances[sym]) / 10 ** STABLECOIN_TOKENS[sym].decimals
                const isSelected = selectedToken === sym
                return (
                  <button key={sym} onClick={() => setSelectedToken(sym)} style={{
                    flex: 1, padding: '7px 4px',
                    border: isSelected ? `3px solid ${INK}` : '3px solid rgba(12,12,16,0.2)',
                    background: isSelected ? YELLOW : PAPER2,
                    cursor: 'pointer',
                    fontFamily: '"Archivo Black", system-ui',
                    fontSize: 10, letterSpacing: '0.1em', color: INK,
                    boxShadow: isSelected ? SSH(2, 2) : 'none',
                    transition: 'all 80ms',
                  }}>
                    <div>{TOKEN_LABELS[sym]}</div>
                    <div style={{
                      fontFamily: 'Space Grotesk, system-ui', fontSize: 9,
                      fontWeight: 600, opacity: 0.65, marginTop: 2,
                    }}>
                      {bal.toFixed(2)}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Tabs ── */}
          <div style={{
            position: 'relative', zIndex: 1,
            display: 'flex', gap: 6,
            padding: '10px 16px 8px',
            borderBottom: '3px solid rgba(12,12,16,0.12)',
          }}>
            {([
              ['consumables', 'POWER-UPS'],
              ['cosmetics', 'COSMETICS'],
              ['season', 'SEASON'],
            ] as [ShopTab, string][]).map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} style={{
                flex: 1, padding: '8px 4px',
                background: tab === id ? INK : PAPER2,
                color: tab === id ? YELLOW : INK,
                border: SB,
                boxShadow: tab === id ? SSH(3, 3, YELLOW) : SSH(3, 3),
                fontFamily: '"Archivo Black", system-ui',
                fontSize: 10, letterSpacing: '0.1em', cursor: 'pointer',
                transition: 'all 80ms',
              }}>
                {label}
              </button>
            ))}
          </div>

          {/* ── Item Area ── */}
          <div style={{
            position: 'relative', zIndex: 1,
            padding: '14px 16px 18px',
            display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            {tab === 'consumables' && CONSUMABLE_IDS.map(id => {
              const design = ITEM_DESIGN[id]
              const isBuying = buyingId === id
              const isSuccess = successId === id
              const affordable = canAfford(selectedToken)
              const freeTryCount = id !== 'revivalBundle' ? (freeTries[id as PowerUpId] ?? 0) : 0
              const purchasedCount = id === 'revivalBundle'
                ? (inventory.revivalBundle ?? 0)
                : (inventory[id as PowerUpId] ?? 0)

              return (
                <ItemCard
                  key={id}
                  design={design}
                  onBuy={() => handleBuyClick(id, design)}
                  isBuying={isBuying}
                  isSuccess={isSuccess}
                  affordable={affordable}
                  freeTryCount={freeTryCount}
                  purchasedCount={purchasedCount}
                />
              )
            })}

            {tab === 'cosmetics' && (
              <div style={{
                padding: '40px 0 20px', textAlign: 'center',
                fontFamily: '"Archivo Black", system-ui', fontSize: 13,
                letterSpacing: '0.1em', color: INK, opacity: 0.4,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              }}>
                <div style={{ fontSize: 36 }}>◆</div>
                COSMETICS COMING SOON
              </div>
            )}

            {tab === 'season' && (
              <SeasonPassCard
                onBuy={() => {
                  const design: ItemDesign = {
                    glyph: '★', bg: YELLOW,
                    name: 'Season Pass',
                    desc: '2× leaderboard points for the full epoch, plus exclusive skins.',
                    price: '0.10',
                  }
                  handleBuyClick('scoreBoost' as ShopItemId, design)
                }}
                isBuying={buyingId === 'scoreBoost'}
                isSuccess={successId === 'scoreBoost'}
                affordable={canAfford(selectedToken)}
              />
            )}
          </div>

          {/* ── Error ── */}
          {error && (
            <div style={{
              position: 'relative', zIndex: 1,
              padding: '10px 16px',
              background: 'rgba(255,59,59,0.1)',
              borderTop: `3px solid ${RED}`,
            }}>
              <div style={{
                fontFamily: 'Space Grotesk, system-ui', fontSize: 11,
                fontWeight: 600, color: RED,
              }}>
                {error}
              </div>
            </div>
          )}

          {/* ── No balance warning ── */}
          {!hasAnyBalance && (
            <div style={{
              position: 'relative', zIndex: 1,
              padding: '10px 16px',
              borderTop: '3px solid rgba(12,12,16,0.1)',
              fontFamily: '"Archivo Black", system-ui', fontSize: 9,
              letterSpacing: '0.12em', color: INK, opacity: 0.45, textAlign: 'center',
            }}>
              DEPOSIT FUNDS IN MINIPAY TO PURCHASE
            </div>
          )}

          {/* ── Footer ── */}
          <div style={{
            position: 'relative', zIndex: 1,
            padding: '10px 16px',
            background: PAPER2,
            borderTop: '3px solid rgba(12,12,16,0.1)',
            fontFamily: '"Archivo Black", system-ui', fontSize: 8,
            letterSpacing: '0.14em', color: INK, opacity: 0.45, textAlign: 'center',
          }}>
            ALL SALES FINAL · ITEMS STORED LOCALLY
          </div>
        </div>
      </div>

      {/* ── Purchase Sheet (confirm / success) ── */}
      {confirmData && purchaseState && (
        <PurchaseSheet
          item={confirmData.design}
          balance={selectedBalance.toFixed(2)}
          selectedToken={selectedToken}
          onConfirm={handleConfirm}
          onCancel={handleCancelSheet}
          state={purchaseState}
        />
      )}
    </>
  )
}

export default ShopModal
