import React from 'react'

const TELEGRAM_SUPPORT = 'https://t.me/+ulIKRKsI1HYxNmQ0'
const TOS_URL = '/blokaz-terms.pdf'
const PRIVACY_URL = '/blokaz-privacy.pdf'
const ABOUT_URL = 'https://crackedstudios.xyz'

const LINKS = [
  { label: 'TERMS', href: TOS_URL },
  { label: 'PRIVACY', href: PRIVACY_URL },
  { label: 'ABOUT', href: ABOUT_URL },
  {
    label: 'SUPPORT',
    href: TELEGRAM_SUPPORT,
    icon: (
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
    ),
  },
]

/**
 * Fixed bottom bar — always visible on screen, no scrolling required.
 * Required for MiniPay listing (§7 Legal Links, §6 Dedicated Support).
 */
const AppFooter: React.FC = () => {
  return (
    <footer
      className="fixed bottom-0 left-0 right-0 z-40 border-t-[2px] border-ink"
      style={{ background: 'var(--paper)' }}
    >
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-0">
        {/* Copyright — left side */}
        <span
          className="shrink-0 font-display text-[9px] tracking-[0.12em]"
          style={{ color: 'var(--ink-soft)', opacity: 0.5 }}
        >
          © {new Date().getFullYear()} BLOKAZ
        </span>

        {/* Links — right side, full-height touch targets */}
        <nav className="flex items-stretch">
          {LINKS.map((link, i) => (
            <React.Fragment key={link.label}>
              {i > 0 && (
                <div
                  className="self-center"
                  style={{
                    width: 1,
                    height: 12,
                    background: 'var(--ink-soft)',
                    opacity: 0.25,
                  }}
                />
              )}
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[44px] items-center gap-1 px-3 font-display text-[10px] tracking-[0.1em] transition-opacity active:opacity-60"
                style={{ color: 'var(--ink-soft)' }}
              >
                {link.icon}
                {link.label}
              </a>
            </React.Fragment>
          ))}
        </nav>
      </div>
    </footer>
  )
}

export default AppFooter
