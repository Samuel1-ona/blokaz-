/**
 * Blokaz Notification System
 * Faithful React port of notifications.jsx from the design file.
 *
 * Variants:  toast | banner | modal | inline | hype
 * Tones:     success | info | warning | danger | reward | onchain | social
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'

// ─── Design tokens (mirroring notifications.jsx) ──────────────────────────────
const INK   = '#0C0C10'
const PAPER = '#F5EFE3'

const PIECE = {
  lime:   '#B7FF3B',
  yellow: '#FFD51F',
  orange: '#FF7A1A',
  red:    '#FF3D3D',
  cyan:   '#29E6E6',
  pink:   '#FF3BBD',
  purple: '#8A3DFF',
  blue:   '#2F6BFF',
  green:  '#2CE66A',
}

export type NotifTone = 'success' | 'info' | 'warning' | 'danger' | 'reward' | 'onchain' | 'social'
export type NotifVariant = 'toast' | 'banner' | 'modal' | 'inline' | 'hype'

const TONES: Record<NotifTone, { bg: string; fg: string; accent: string; label: string }> = {
  success: { bg: PIECE.lime,   fg: INK,    accent: INK,         label: 'SUCCESS' },
  info:    { bg: PAPER,        fg: INK,    accent: PIECE.blue,  label: 'INFO' },
  warning: { bg: PIECE.yellow, fg: INK,    accent: PIECE.orange,label: 'HEADS UP' },
  danger:  { bg: PIECE.red,    fg: '#fff', accent: PIECE.yellow,label: 'ALERT' },
  reward:  { bg: PIECE.yellow, fg: INK,    accent: PIECE.red,   label: 'REWARD' },
  onchain: { bg: PIECE.cyan,   fg: INK,    accent: INK,         label: 'ON-CHAIN' },
  social:  { bg: PIECE.pink,   fg: INK,    accent: PIECE.purple,label: 'SOCIAL' },
}

const sh = (x = 6, y = 6, c = INK) => `${x}px ${y}px 0 ${c}`

// ─── Sub-components ───────────────────────────────────────────────────────────

function IconTile({ glyph, tone, size = 44 }: { glyph: string; tone: NotifTone; size?: number }) {
  const t = TONES[tone]
  return (
    <div style={{
      width: size, height: size, background: INK, color: t.bg,
      border: `2.5px solid ${t.fg}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '"Archivo Black", sans-serif',
      fontSize: Math.round(size * 0.48), lineHeight: 1, flexShrink: 0,
    }}>
      {glyph}
    </div>
  )
}

function CloseBtn({ tone, size = 26, onClick }: { tone: NotifTone; size?: number; onClick?: () => void }) {
  const t = TONES[tone]
  return (
    <div
      onClick={onClick}
      style={{
        width: size, height: size, background: t.fg, color: t.bg,
        border: `2px solid ${t.fg}`, boxShadow: sh(2, 2, t.accent === INK ? t.fg : t.accent),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '"Archivo Black", sans-serif', fontSize: 12,
        flexShrink: 0, cursor: 'pointer', userSelect: 'none',
      }}
    >
      ✕
    </div>
  )
}

function CountdownBar({ tone, progress = 0.6 }: { tone: NotifTone; progress?: number }) {
  const t = TONES[tone]
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 5, background: t.fg + '20' }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: `${progress * 100}%`,
        background: t.accent === INK ? t.fg : t.accent,
        transition: 'width 16ms linear',
      }} />
    </div>
  )
}

// ─── Notification props ───────────────────────────────────────────────────────

export interface NotificationProps {
  variant?: NotifVariant
  tone?: NotifTone
  icon?: string
  title: string
  body?: string
  badge?: string
  meta?: string
  action?: string
  secondary?: string
  dismissible?: boolean
  width?: number | string
  /** 0–1 remaining life shown in countdown bar (toast only) */
  countdown?: number
  onAction?: () => void
  onSecondary?: () => void
  onDismiss?: () => void
}

// ─── Main component ───────────────────────────────────────────────────────────

export const Notification: React.FC<NotificationProps> = ({
  variant = 'toast',
  tone = 'info',
  icon = '!',
  title,
  body,
  badge,
  meta,
  action,
  secondary,
  dismissible = true,
  width,
  countdown = 0.6,
  onAction,
  onSecondary,
  onDismiss,
}) => {
  const t = TONES[tone]

  // ── TOAST ──────────────────────────────────────────────────────────────────
  if (variant === 'toast') {
    return (
      <div style={{
        width: width ?? 360,
        background: t.bg, color: t.fg,
        border: `4px solid ${INK}`,
        boxShadow: sh(6, 6, t.accent === INK ? INK : t.accent),
        padding: '10px 12px',
        display: 'flex', alignItems: 'center', gap: 12,
        fontFamily: '"Archivo Black", sans-serif',
        position: 'relative', overflow: 'hidden',
      }}>
        <IconTile glyph={icon} tone={tone} size={38} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {badge && (
            <div style={{
              display: 'inline-block', background: t.fg, color: t.bg,
              padding: '1px 6px', fontSize: 9, letterSpacing: '0.14em', marginBottom: 3,
            }}>{badge}</div>
          )}
          <div style={{
            fontSize: 15, letterSpacing: '-0.01em', lineHeight: 1.1,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{title}</div>
          {body && (
            <div style={{
              fontFamily: 'Space Grotesk, sans-serif', fontSize: 12,
              fontWeight: 600, opacity: 0.85, marginTop: 2, lineHeight: 1.3,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{body}</div>
          )}
        </div>
        {action && (
          <div
            onClick={onAction}
            style={{
              background: INK, color: t.bg, border: `2px solid ${t.fg}`,
              padding: '4px 9px', fontSize: 10, letterSpacing: '0.14em',
              flexShrink: 0, cursor: 'pointer',
            }}
          >{action}</div>
        )}
        {dismissible && <CloseBtn tone={tone} size={22} onClick={onDismiss} />}
        <CountdownBar tone={tone} progress={countdown} />
      </div>
    )
  }

  // ── BANNER ─────────────────────────────────────────────────────────────────
  if (variant === 'banner') {
    return (
      <div style={{
        width: width ?? '100%',
        background: t.bg, color: t.fg,
        borderBottom: `4px solid ${INK}`,
        boxShadow: sh(0, 6, t.accent === INK ? INK : t.accent),
        padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 12,
        fontFamily: '"Archivo Black", sans-serif',
        position: 'relative',
      }}>
        <IconTile glyph={icon} tone={tone} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {badge && (
            <div style={{
              display: 'inline-block', background: INK, color: t.bg,
              padding: '1px 7px', fontSize: 9, letterSpacing: '0.14em', marginBottom: 3,
            }}>{badge}</div>
          )}
          <div style={{ fontSize: 16, letterSpacing: '-0.01em', lineHeight: 1.1 }}>{title}</div>
          {body && (
            <div style={{
              fontFamily: 'Space Grotesk, sans-serif', fontSize: 12,
              fontWeight: 600, opacity: 0.85, marginTop: 2, lineHeight: 1.3,
            }}>{body}</div>
          )}
        </div>
        {action && (
          <div
            onClick={onAction}
            style={{
              background: INK, color: t.bg, border: `2px solid ${t.fg}`,
              padding: '6px 11px', fontSize: 11, letterSpacing: '0.14em',
              flexShrink: 0, boxShadow: sh(3, 3, t.fg), cursor: 'pointer',
            }}
          >{action} →</div>
        )}
        {dismissible && <CloseBtn tone={tone} size={26} onClick={onDismiss} />}
      </div>
    )
  }

  // ── INLINE ─────────────────────────────────────────────────────────────────
  if (variant === 'inline') {
    return (
      <div style={{
        width: width ?? '100%',
        background: t.bg, color: t.fg,
        border: `4px solid ${INK}`,
        boxShadow: sh(5, 5, t.accent === INK ? INK : t.accent),
        padding: '12px 14px',
        display: 'flex', alignItems: 'flex-start', gap: 12,
        fontFamily: '"Archivo Black", sans-serif',
      }}>
        <IconTile glyph={icon} tone={tone} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            {badge && (
              <div style={{
                background: INK, color: t.bg, padding: '2px 7px',
                fontSize: 9, letterSpacing: '0.14em',
              }}>{badge}</div>
            )}
            {meta && (
              <div style={{ fontSize: 9, letterSpacing: '0.14em', opacity: 0.6 }}>{meta}</div>
            )}
          </div>
          <div style={{ fontSize: 17, letterSpacing: '-0.01em', lineHeight: 1.1 }}>{title}</div>
          {body && (
            <div style={{
              fontFamily: 'Space Grotesk, sans-serif', fontSize: 13,
              fontWeight: 600, opacity: 0.85, marginTop: 4, lineHeight: 1.4,
            }}>{body}</div>
          )}
          {(action || secondary) && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              {action && (
                <div
                  onClick={onAction}
                  style={{
                    background: INK, color: t.bg, border: `2px solid ${t.fg}`,
                    padding: '6px 12px', fontSize: 11, letterSpacing: '0.12em',
                    boxShadow: sh(3, 3, t.fg), cursor: 'pointer',
                  }}
                >{action}</div>
              )}
              {secondary && (
                <div
                  onClick={onSecondary}
                  style={{
                    background: t.fg, color: t.bg, border: `2px solid ${t.fg}`,
                    padding: '6px 12px', fontSize: 11, letterSpacing: '0.12em',
                    opacity: 0.85, cursor: 'pointer',
                  }}
                >{secondary}</div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── MODAL ──────────────────────────────────────────────────────────────────
  if (variant === 'modal') {
    return (
      <div style={{
        width: width ?? 340,
        background: t.bg, color: t.fg,
        border: `4px solid ${INK}`,
        boxShadow: sh(10, 10, t.accent === INK ? INK : t.accent),
        padding: 18,
        fontFamily: '"Archivo Black", sans-serif',
        position: 'relative',
      }}>
        {dismissible && (
          <div style={{ position: 'absolute', top: -10, right: -10 }}>
            <CloseBtn tone={tone} size={28} onClick={onDismiss} />
          </div>
        )}
        <div style={{
          display: 'inline-block', background: INK, color: t.bg,
          padding: '4px 10px', fontSize: 10, letterSpacing: '0.18em',
          transform: 'rotate(-2deg)', marginBottom: 12,
          boxShadow: sh(3, 3, t.accent === INK ? t.fg : t.accent),
        }}>{badge ?? t.label}</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <IconTile glyph={icon} tone={tone} size={60} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 24, letterSpacing: '-0.02em', lineHeight: 1 }}>{title}</div>
            {meta && (
              <div style={{ fontSize: 10, letterSpacing: '0.14em', opacity: 0.6, marginTop: 4 }}>{meta}</div>
            )}
          </div>
        </div>

        {body && (
          <div style={{
            fontFamily: 'Space Grotesk, sans-serif', fontSize: 14,
            fontWeight: 600, marginTop: 14, lineHeight: 1.45,
          }}>{body}</div>
        )}

        {(action || secondary) && (
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            {action && (
              <div
                onClick={onAction}
                style={{
                  flex: 1, background: INK, color: t.bg,
                  border: `3px solid ${t.fg}`, padding: '10px 14px',
                  fontSize: 13, letterSpacing: '0.12em',
                  boxShadow: sh(4, 4, t.fg), textAlign: 'center', cursor: 'pointer',
                }}
              >{action}</div>
            )}
            {secondary && (
              <div
                onClick={onSecondary ?? onDismiss}
                style={{
                  background: t.fg, color: t.bg, border: `3px solid ${t.fg}`,
                  padding: '10px 14px', fontSize: 13, letterSpacing: '0.12em',
                  opacity: 0.9, cursor: 'pointer',
                }}
              >{secondary}</div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── HYPE ───────────────────────────────────────────────────────────────────
  if (variant === 'hype') {
    return (
      <div style={{
        width: width ?? 340,
        background: INK, color: PAPER,
        border: `4px solid ${PAPER}`,
        boxShadow: sh(12, 12, t.accent === INK ? t.fg : t.accent),
        padding: 22,
        fontFamily: '"Archivo Black", sans-serif',
        position: 'relative', overflow: 'hidden',
        textAlign: 'center',
      }}>
        {/* Sunburst */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.18, pointerEvents: 'none',
          background: `conic-gradient(from 0deg at 50% 40%,
            ${t.bg} 0deg 22.5deg, transparent 22.5deg 45deg,
            ${t.bg} 45deg 67.5deg, transparent 67.5deg 90deg,
            ${t.bg} 90deg 112.5deg, transparent 112.5deg 135deg,
            ${t.bg} 135deg 157.5deg, transparent 157.5deg 180deg,
            ${t.bg} 180deg 202.5deg, transparent 202.5deg 225deg,
            ${t.bg} 225deg 247.5deg, transparent 247.5deg 270deg,
            ${t.bg} 270deg 292.5deg, transparent 292.5deg 315deg,
            ${t.bg} 315deg 337.5deg, transparent 337.5deg 360deg)`,
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-block', background: t.bg, color: INK,
            padding: '6px 14px', fontSize: 13, letterSpacing: '0.18em',
            border: `3px solid ${PAPER}`, boxShadow: sh(5, 5, t.accent),
            transform: 'rotate(-4deg)', marginBottom: 14,
          }}>{badge ?? t.label}</div>

          <div style={{ marginBottom: 10 }}>
            <IconTile glyph={icon} tone={tone} size={84} />
          </div>

          <div style={{
            fontSize: 38, letterSpacing: '-0.03em', lineHeight: 0.95,
            color: t.bg, WebkitTextStroke: `2px ${INK}`,
            textShadow: `4px 4px 0 ${INK}`, margin: '8px 0',
          }}>{title}</div>

          {body && (
            <div style={{
              fontFamily: 'Space Grotesk, sans-serif', fontSize: 14,
              fontWeight: 700, opacity: 0.85, lineHeight: 1.4, marginTop: 6,
            }}>{body}</div>
          )}

          {action && (
            <div
              onClick={onAction}
              style={{
                display: 'inline-block', marginTop: 18,
                background: t.bg, color: INK,
                border: `3px solid ${PAPER}`, padding: '12px 22px',
                fontSize: 14, letterSpacing: '0.12em',
                boxShadow: sh(5, 5, PAPER), cursor: 'pointer',
              }}
            >{action} →</div>
          )}
        </div>
      </div>
    )
  }

  return null
}

// ─── Toast item with live countdown ──────────────────────────────────────────

interface LiveToast extends NotificationProps {
  id: string
  autoDismissMs?: number
}

interface ToastItemProps {
  toast: LiveToast
  onDismiss: (id: string) => void
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const duration = toast.autoDismissMs ?? 4000
  const [countdown, setCountdown] = useState(1)
  const startRef = useRef(Date.now())

  useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() - startRef.current
      const remaining = Math.max(0, 1 - elapsed / duration)
      setCountdown(remaining)
      if (remaining > 0) requestAnimationFrame(tick)
      else onDismiss(toast.id)
    }
    const raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div style={{
      animation: 'notif-slide-in 220ms cubic-bezier(0.22,1,0.36,1)',
    }}>
      <Notification
        {...toast}
        countdown={countdown}
        onDismiss={() => onDismiss(toast.id)}
        onAction={() => { toast.onAction?.(); onDismiss(toast.id) }}
      />
    </div>
  )
}

// ─── Toast container ──────────────────────────────────────────────────────────

interface ToastContainerProps {
  toasts: LiveToast[]
  onDismiss: (id: string) => void
  position?: 'top-right' | 'bottom-center'
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onDismiss,
  position = 'bottom-center',
}) => {
  if (toasts.length === 0) return null

  const isTop = position === 'top-right'
  return (
    <>
      <style>{`
        @keyframes notif-slide-in {
          from { opacity: 0; transform: translateY(${isTop ? '-12px' : '12px'}) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div style={{
        position: 'fixed',
        zIndex: 8500,
        ...(isTop
          ? { top: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }
          : { bottom: 24, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', width: 'min(360px, calc(100vw - 32px))' }
        ),
      }}>
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </div>
    </>
  )
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

interface NotifModalProps extends NotificationProps {
  open: boolean
  onClose: () => void
}

export const NotifModal: React.FC<NotifModalProps> = ({ open, onClose, ...props }) => {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) {
      const raf = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(raf)
    } else {
      setVisible(false)
    }
  }, [open])

  if (!open) return null

  const isHype = props.variant === 'hype'

  return (
    <>
      <style>{`
        @keyframes notif-modal-in {
          from { opacity: 0; transform: translateY(14px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 8800,
          background: isHype ? '#0C0C10' : 'rgba(12,12,16,0.72)',
          backdropFilter: isHype ? 'none' : 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '12px',
          opacity: visible ? 1 : 0,
          transition: 'opacity 220ms ease',
        }}
      >
        {isHype && (
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.08,
            background: 'repeating-linear-gradient(-45deg, transparent 0, transparent 24px, #F5EFE3 24px, #F5EFE3 48px)',
            pointerEvents: 'none',
          }} />
        )}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: 'min(400px, calc(100vw - 24px))',
            animation: visible ? 'notif-modal-in 260ms cubic-bezier(0.22,1,0.36,1)' : 'none',
          }}
        >
          <Notification
            {...props}
            width="100%"
            onDismiss={onClose}
            onSecondary={props.onSecondary ?? onClose}
          />
        </div>
      </div>
    </>
  )
}

// ─── Notification manager hook ────────────────────────────────────────────────

let _toastCounter = 0

export function useNotifications() {
  const [toasts, setToasts] = useState<LiveToast[]>([])
  const [modal, setModal] = useState<(NotificationProps & { open: boolean }) | null>(null)

  const showToast = useCallback((props: Omit<LiveToast, 'id'>) => {
    const id = `toast-${++_toastCounter}`
    setToasts(prev => [...prev.slice(-4), { ...props, id }]) // max 5 stacked
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const showModal = useCallback((props: NotificationProps) => {
    setModal({ ...props, open: true })
  }, [])

  const closeModal = useCallback(() => {
    setModal(m => m ? { ...m, open: false } : null)
    setTimeout(() => setModal(null), 260)
  }, [])

  return { toasts, dismissToast, showToast, modal, showModal, closeModal }
}

// ─── News nudge system ────────────────────────────────────────────────────────
// Periodically shows a NEWS_ITEM as a modal notification.
// Each item shown at most once per session; a random one is picked each time.

const NEWS_NOTIF_KEY = 'blokaz:news_notif_seen'
const NEWS_NOTIF_INTERVAL_MS = 12 * 60 * 1000 // 12 minutes between nudges
const NEWS_NOTIF_INITIAL_DELAY_MS = 5 * 60 * 1000 // first one after 5 min

function getSeenIds(): string[] {
  try { return JSON.parse(localStorage.getItem(NEWS_NOTIF_KEY) ?? '[]') } catch { return [] }
}
function markSeen(id: string) {
  try {
    const seen = getSeenIds()
    if (!seen.includes(id)) {
      localStorage.setItem(NEWS_NOTIF_KEY, JSON.stringify([...seen, id]))
    }
  } catch {}
}

interface NewsItem {
  id: string
  tag: string
  headline: string
  body: string
  link?: string
}

const TAG_TONE: Record<string, NotifTone> = {
  NEW:        'reward',
  UPDATE:     'success',
  TOURNAMENT: 'warning',
  CAMPAIGN:   'social',
  COMMUNITY:  'info',
}

const TAG_ICON: Record<string, string> = {
  NEW:        '★',
  UPDATE:     '✦',
  TOURNAMENT: '◆',
  CAMPAIGN:   '⚡',
  COMMUNITY:  '@',
}

interface NewsNudgeProps {
  newsItems: NewsItem[]
}

export const NewsNudge: React.FC<NewsNudgeProps> = ({ newsItems }) => {
  const [current, setCurrent] = useState<NewsItem | null>(null)
  const [open, setOpen] = useState(false)

  const pick = useCallback(() => {
    const seen = getSeenIds()
    const unseen = newsItems.filter(n => !seen.includes(n.id))
    if (unseen.length === 0) return null
    return unseen[Math.floor(Math.random() * unseen.length)]
  }, [newsItems])

  const showNext = useCallback(() => {
    const item = pick()
    if (!item) return
    setCurrent(item)
    setOpen(true)
    markSeen(item.id)
  }, [pick])

  useEffect(() => {
    const isFirstVisit = getSeenIds().length === 0
    const delay = isFirstVisit ? 1500 : NEWS_NOTIF_INITIAL_DELAY_MS
    const initial = setTimeout(() => {
      showNext()
      const interval = setInterval(showNext, NEWS_NOTIF_INTERVAL_MS)
      return () => clearInterval(interval)
    }, delay)
    return () => clearTimeout(initial)
  }, [showNext])

  if (!current) return null

  const tone = TAG_TONE[current.tag] ?? 'info'
  const icon = TAG_ICON[current.tag] ?? '!'

  return (
    <NotifModal
      open={open}
      onClose={() => setOpen(false)}
      variant="modal"
      tone={tone}
      icon={icon}
      badge={current.tag}
      title={current.headline}
      body={current.body}
      action={current.link ? 'LEARN MORE' : undefined}
      secondary="GOT IT"
      onAction={() => {
        if (current.link) window.open(current.link, '_blank', 'noopener,noreferrer')
        setOpen(false)
      }}
      onSecondary={() => setOpen(false)}
      onDismiss={() => setOpen(false)}
    />
  )
}

export default Notification
