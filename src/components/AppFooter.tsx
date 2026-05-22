import React, { useState } from 'react'
import LegalModal, { type LegalModalType } from './LegalModal'

const TELEGRAM_SUPPORT = 'https://t.me/tweetlegg'

/**
 * Fixed bottom bar — always visible on screen, no scrolling required.
 * Terms, Privacy and About open in-app modals.
 * Required for MiniPay listing (§7 Legal Links, §6 Dedicated Support).
 */
const AppFooter: React.FC = () => {
  const [modal, setModal] = useState<LegalModalType>(null)

  return (
    <>
      <footer
        className="fixed bottom-0 left-0 right-0 z-40 border-t-[2px] border-ink"
        style={{ background: 'var(--paper)' }}
      >
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-0">
          {/* Copyright */}
          <span
            className="shrink-0 font-display text-[9px] tracking-[0.12em]"
            style={{ color: 'var(--ink-soft)', opacity: 0.5 }}
          >
            © {new Date().getFullYear()} BLOKAZ
          </span>

          {/* Links */}
          <nav className="flex items-stretch">
            <FooterButton onClick={() => setModal('terms')}>TERMS</FooterButton>
            <Divider />
            <FooterButton onClick={() => setModal('privacy')}>PRIVACY</FooterButton>
            <Divider />
            <FooterButton onClick={() => setModal('about')}>ABOUT</FooterButton>
            <Divider />
            <FooterLink href={TELEGRAM_SUPPORT}>
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              SUPPORT
            </FooterLink>
          </nav>
        </div>
      </footer>

      <LegalModal type={modal} onClose={() => setModal(null)} />
    </>
  )
}

/* ── Small helpers ──────────────────────────────────────────────────────────── */

const FooterButton: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({
  onClick,
  children,
}) => (
  <button
    onClick={onClick}
    className="flex min-h-[44px] items-center px-3 font-display text-[10px] tracking-[0.1em] transition-opacity active:opacity-60"
    style={{ color: 'var(--ink-soft)', background: 'transparent', border: 'none', cursor: 'pointer' }}
  >
    {children}
  </button>
)

const FooterLink: React.FC<{ href: string; children: React.ReactNode }> = ({
  href,
  children,
}) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="flex min-h-[44px] items-center gap-1 px-3 font-display text-[10px] tracking-[0.1em] transition-opacity active:opacity-60"
    style={{ color: 'var(--ink-soft)' }}
  >
    {children}
  </a>
)

const Divider: React.FC = () => (
  <div
    className="self-center"
    style={{ width: 1, height: 12, background: 'var(--ink-soft)', opacity: 0.25 }}
  />
)

export default AppFooter
