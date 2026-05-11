import React, { useRef, useState, useEffect } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useConnect } from 'wagmi'
import { useOwner } from '../hooks/useBlokzGame'
import { useTheme } from '../hooks/useTheme'
import { BrutalIcon } from './BrutalIcon'
import ThemeToggle from './ThemeToggle'
import { IS_MINIPAY } from '../utils/miniPay'
import { web3AuthConnector } from '../config/web3auth'
import { useThemeStore, type UserTheme, type ThemeName } from '../stores/themeStore'

type HeaderView = 'lobby' | 'classic' | 'tournaments' | 'tournament-play' | 'admin'

interface HeaderProps {
  onShowLeaderboard?: () => void
  onViewChange: (view: 'lobby' | 'classic' | 'tournaments' | 'admin') => void
  activeView: HeaderView
  showLeaderboardAction: boolean
  isLeaderboardOpen?: boolean
}

const MiniPayWalletBadge: React.FC = () => {
  const { address, isConnected } = useAccount()
  const { effectiveTheme } = useTheme()
  const isDarkTheme = effectiveTheme !== 'light'
  const walletBg = isDarkTheme ? 'var(--accent)' : 'var(--accent-soft)'
  const walletColor = isDarkTheme ? '#FFFFFF' : 'var(--ink-fixed)'

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center gap-2 border-[3px] border-ink px-4 py-[10px] font-display text-[12px] tracking-[0.08em] uppercase"
        style={{
          background: walletBg,
          color: walletColor,
          boxShadow: '4px 4px 0 var(--shadow)',
        }}
      >
        <div
          className="h-2 w-2 rounded-full animate-pulse"
          style={{ background: walletColor }}
        />
        {isConnected && address ? truncateAddress(address) : 'MINIPAY'}
      </div>
    </div>
  )
}

const HeaderDivider: React.FC = () => (
  <div
    className="hidden h-8 w-px lg:block"
    style={{ background: 'var(--rule)' }}
  />
)

/**
 * Single LOGIN button that opens a dropdown with two connection options:
 *  • Social  (Web3Auth — Google / Twitter / email) — marked as RECOMMENDED
 *  • Wallet  (RainbowKit — MetaMask, WalletConnect, etc.)
 *
 * Replaces the previous two-button layout for a cleaner UX.
 */
const LoginDropdown: React.FC<{ onConnectWallet: () => void }> = ({ onConnectWallet }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { effectiveTheme } = useTheme()
  const { connect, isPending, variables } = useConnect()
  const isSocialBusy = isPending && (variables?.connector as any)?.id === 'web3auth'
  const isDarkTheme = effectiveTheme !== 'light'
  const buttonBg = isDarkTheme ? 'var(--accent)' : 'var(--accent-soft)'
  const buttonColor = isDarkTheme ? '#FFFFFF' : 'var(--ink-fixed)'

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="brutal-btn flex items-center gap-2 border-[3px] border-ink px-4 py-[10px] font-display text-[12px] tracking-[0.08em] uppercase"
        style={{
          background: buttonBg,
          boxShadow: '4px 4px 0 var(--shadow)',
          color: buttonColor,
        }}
      >
        LOGIN
        <span className="text-[10px] leading-none">{open ? '▴' : '▾'}</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute right-0 top-[calc(100%+6px)] z-[200] w-56 border-[3px] border-ink bg-paper"
          style={{ boxShadow: '4px 4px 0 var(--shadow)' }}
        >
          {/* ── Social (recommended) ── */}
          <button
            onClick={() => {
              setOpen(false)
              connect({ connector: web3AuthConnector })
            }}
            disabled={isSocialBusy}
            className="flex w-full items-center justify-between border-b-[3px] border-ink px-4 py-3 font-display text-[11px] tracking-[0.1em] uppercase text-ink transition-colors hover:bg-accent-yellow/20 disabled:opacity-60"
          >
            <span className="flex items-center gap-2">
              <BrutalIcon name="zap" size={12} strokeWidth={2.5} />
              {isSocialBusy ? (
                <span className="flex items-center gap-1.5">
                  <div className="brutal-loader" style={{ borderColor: 'var(--ink)', borderTopColor: 'transparent' }} />
                  SIGNING IN
                </span>
              ) : (
                'SOCIAL'
              )}
            </span>
            {/* Best badge */}
            <span
              className="border-[2px] border-ink bg-accent-pink px-1.5 py-0.5 font-display text-[8px] tracking-widest uppercase leading-none text-white"
            >
              BEST
            </span>
          </button>

          {/* ── Wallet (MetaMask / WalletConnect) ── */}
          <button
            onClick={() => {
              setOpen(false)
              onConnectWallet()
            }}
            className="flex w-full items-center gap-2 px-4 py-3 font-display text-[11px] tracking-[0.1em] uppercase text-ink transition-colors hover:bg-paper-2"
          >
            <BrutalIcon name="share" size={12} strokeWidth={2.5} />
            WALLET
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Settings sheet ─────────────────────────────────────────────────────────

const TELEGRAM_SUPPORT = 'https://t.me/+ulIKRKsI1HYxNmQ0'
const TOS_URL = '/blokaz-terms.pdf'
const PRIVACY_URL = '/blokaz-privacy.pdf'
const ABOUT_URL = 'https://crackedstudios.xyz'

const THEME_OPTIONS: { value: UserTheme; label: string; icon: string }[] = [
  { value: 'auto',         label: 'AUTO',   icon: 'A' },
  { value: 'light',        label: 'CREAM',  icon: '☀' },
  { value: 'dark-navy',    label: 'NAVY',   icon: '◗' },
  { value: 'dark-forest',  label: 'FOREST', icon: '❋' },
]

const SettingsSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { userTheme, setUserTheme } = useThemeStore((s) => ({
    userTheme: s.userTheme,
    setUserTheme: s.setUserTheme,
  }))

  return (
    <div className="fixed inset-0 z-[200] flex flex-col lg:hidden">
      {/* Backdrop — tap to close */}
      <button
        className="absolute inset-0 cursor-default"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
        aria-label="Close settings"
      />

      {/* Full-height sheet sliding from bottom */}
      <div
        className="relative mt-auto flex max-h-[92dvh] w-full flex-col border-t-4 border-ink"
        style={{ background: 'var(--paper)', boxShadow: '0 -8px 0 var(--shadow)' }}
      >
        {/* ── Header ── */}
        <div
          className="flex shrink-0 items-center justify-between border-b-4 border-ink px-6 py-4"
          style={{ background: 'var(--paper-2)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center border-[3px] border-ink"
              style={{ background: 'var(--accent-yellow)' }}
            >
              <BrutalIcon name="wrench" size={18} strokeWidth={2.5} style={{ color: 'var(--ink-fixed)' }} />
            </div>
            <span className="font-display text-[16px] uppercase tracking-[0.15em]">SETTINGS</span>
          </div>
          <button
            onClick={onClose}
            className="brutal-btn flex h-10 w-10 items-center justify-center border-[3px] border-ink text-ink"
            style={{ background: 'var(--paper)', boxShadow: '3px 3px 0 var(--shadow)' }}
          >
            <BrutalIcon name="close" size={16} strokeWidth={3} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div
          className="flex-1 overflow-y-auto overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        >
          <div className="px-6 py-6 space-y-8" style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom))' }}>

            {/* ── Theme ── */}
            <section>
              <div
                className="mb-4 border-l-4 border-ink pl-3 font-display text-[11px] uppercase tracking-[0.2em]"
                style={{ color: 'var(--ink-soft)' }}
              >
                APPEARANCE
              </div>
              <div className="grid grid-cols-2 gap-3">
                {THEME_OPTIONS.map((opt) => {
                  const isActive = userTheme === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setUserTheme(opt.value)}
                      className="brutal-btn flex items-center gap-4 border-[3px] border-ink px-5 py-4 font-display"
                      style={{
                        background: isActive ? 'var(--accent-yellow)' : 'var(--paper-2)',
                        color: isActive ? 'var(--ink-fixed)' : 'var(--ink)',
                        boxShadow: isActive ? '4px 4px 0 var(--shadow)' : '3px 3px 0 var(--shadow)',
                      }}
                    >
                      <span className="text-2xl leading-none">{opt.icon}</span>
                      <div className="text-left">
                        <div className="text-[12px] uppercase tracking-[0.14em]">{opt.label}</div>
                        {isActive && (
                          <div className="mt-0.5 text-[9px] tracking-widest opacity-60">ACTIVE</div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* ── Divider ── */}
            <div className="border-t-[3px] border-ink border-dashed" />

            {/* ── Legal & Support ── */}
            <section>
              <div
                className="mb-4 border-l-4 border-ink pl-3 font-display text-[11px] uppercase tracking-[0.2em]"
                style={{ color: 'var(--ink-soft)' }}
              >
                LEGAL & SUPPORT
              </div>
              <div className="flex flex-col gap-3">
                {[
                  { label: 'Terms of Service',     sub: 'blokaz-terms.pdf',         href: TOS_URL },
                  { label: 'Privacy Policy',        sub: 'blokaz-privacy.pdf',       href: PRIVACY_URL },
                  { label: 'About Cracked Studios', sub: 'crackedstudios.xyz',       href: ABOUT_URL },
                  { label: 'Support',               sub: 'Chat with us on Telegram', href: TELEGRAM_SUPPORT },
                ].map(({ label, sub, href }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between border-[3px] border-ink px-5 py-4"
                    style={{
                      background: 'var(--paper-2)',
                      color: 'var(--ink)',
                      boxShadow: '4px 4px 0 var(--shadow)',
                    }}
                  >
                    <div>
                      <div className="font-display text-[12px] uppercase tracking-[0.12em]">{label}</div>
                      <div className="mt-0.5 font-body text-[10px]" style={{ color: 'var(--ink-soft)' }}>{sub}</div>
                    </div>
                    <span className="ml-4 text-xl opacity-40">→</span>
                  </a>
                ))}
              </div>
            </section>

            {/* ── Version stamp ── */}
            <div
              className="border-[3px] border-ink px-5 py-4 text-center font-display text-[10px] uppercase tracking-[0.16em]"
              style={{ background: 'var(--paper-2)', color: 'var(--ink-soft)' }}
            >
              BLOKAZ · © {new Date().getFullYear()} CRACKED STUDIOS
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Mobile bottom nav ───────────────────────────────────────────────────────

const MobileBottomNav: React.FC<{
  activeView: HeaderView
  isLeaderboardOpen: boolean
  onViewChange: (view: 'lobby' | 'classic' | 'tournaments' | 'admin') => void
  onShowLeaderboard?: () => void
  isOwner: boolean
}> = ({ activeView, isLeaderboardOpen, onViewChange, onShowLeaderboard, isOwner }) => {
  const [settingsOpen, setSettingsOpen] = useState(false)

  const tabs = [
    {
      label: 'HOME',
      icon: 'home' as const,
      active: activeView === 'lobby' && !settingsOpen,
      onClick: () => { setSettingsOpen(false); onViewChange('lobby') },
    },
    {
      label: 'CLASSIC',
      icon: 'zap' as const,
      active: activeView === 'classic' && !isLeaderboardOpen && !settingsOpen,
      onClick: () => { setSettingsOpen(false); onViewChange('classic') },
    },
    {
      label: 'TOURNEY',
      icon: 'trophy' as const,
      active: (activeView === 'tournaments' || activeView === 'tournament-play') && !settingsOpen,
      onClick: () => { setSettingsOpen(false); onViewChange('tournaments') },
    },
    {
      label: 'RANKS',
      icon: 'trending' as const,
      active: isLeaderboardOpen && !settingsOpen,
      onClick: () => { setSettingsOpen(false); onShowLeaderboard?.() },
    },
    {
      label: 'SETTINGS',
      icon: 'wrench' as const,
      active: settingsOpen,
      onClick: () => setSettingsOpen((v) => !v),
    },
    ...(isOwner
      ? [
          {
            label: 'ADMIN',
            icon: 'alert' as const,
            active: activeView === 'admin' && !settingsOpen,
            onClick: () => { setSettingsOpen(false); onViewChange('admin') },
          },
        ]
      : []),
  ]

  return (
    <>
      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
      <nav
        className="fixed bottom-0 left-0 right-0 z-[210] flex h-16 border-t-4 border-ink bg-paper lg:hidden"
        style={{ boxShadow: '0 -3px 0 var(--shadow)' }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.label}
            onClick={tab.onClick}
            className={`flex flex-1 flex-col items-center justify-center gap-1 font-display text-[8px] tracking-[0.14em] uppercase ${
              tab.active ? 'bg-ink' : ''
            }`}
            style={{ color: tab.active ? 'var(--paper)' : 'var(--ink)' }}
          >
            <BrutalIcon name={tab.icon} size={18} strokeWidth={2.5} />
            {tab.label}
          </button>
        ))}
      </nav>
    </>
  )
}

const truncateAddress = (value?: string) =>
  value ? `${value.slice(0, 4)}…${value.slice(-2)}` : 'CONNECT'

export const Header: React.FC<HeaderProps> = ({
  onShowLeaderboard,
  onViewChange,
  activeView,
  showLeaderboardAction,
  isLeaderboardOpen = false,
}) => {
  const { address } = useAccount()
  const { owner } = useOwner()
  const { effectiveTheme } = useTheme()
  const { isConnected } = useAccount()

  const isOwner =
    address && owner && address.toLowerCase() === owner.toLowerCase()
  const isTournamentView =
    activeView === 'tournaments' || activeView === 'tournament-play'
  const isDarkTheme = effectiveTheme !== 'light'
  const connectedChipBg = isDarkTheme ? 'var(--accent)' : 'var(--accent-soft)'
  const connectedChipColor = isDarkTheme ? '#FFFFFF' : 'var(--ink-fixed)'

  const safeNavigate = (view: 'lobby' | 'classic' | 'tournaments' | 'admin') => {
    if (typeof onViewChange === 'function') onViewChange(view)
  }

  const navTabs = [
    {
      label: 'CLASSIC',
      active: activeView === 'classic',
      view: 'classic' as const,
    },
    {
      label: 'TOURNAMENTS',
      active: isTournamentView,
      view: 'tournaments' as const,
    },
    {
      label: 'LEADERBOARD',
      active: isLeaderboardOpen,
      onClick: onShowLeaderboard,
    },
    {
      label: 'MY STATS',
      active: false,
    },
    ...(isOwner
      ? [
          {
            label: 'ADMIN',
            active: activeView === 'admin',
            view: 'admin' as const,
          },
        ]
      : []),
  ]

  return (
    <>
      <header
        className="fixed left-0 right-0 top-0 z-50 border-b-4 border-ink bg-paper px-4 py-3 lg:px-6 lg:py-4"
        style={{ borderBottomColor: 'var(--ink)' }}
      >
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-3 lg:gap-6">
          <div
            className={`group cursor-pointer items-center gap-2.5 lg:flex lg:basis-[320px] lg:min-w-[210px] lg:gap-[14px] ${
              activeView === 'classic' || activeView === 'tournament-play'
                ? 'hidden'
                : 'flex min-w-0'
            }`}
            onClick={() => safeNavigate('lobby')}
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center border-[3px] border-ink font-display text-[18px] transition-transform group-hover:-rotate-3 lg:h-[46px] lg:w-[46px] lg:text-[22px]"
              style={{
                background: 'var(--accent-yellow)',
                boxShadow: '3px 3px 0 var(--shadow)',
                color: 'var(--ink-fixed)',
              }}
            >
              B
            </div>
            <span className="font-display text-[18px] leading-none tracking-tight text-ink lg:text-[24px]">
              BLOKAZ
            </span>
          </div>

          <div className="hidden flex-1 justify-center lg:flex">
            <div className="flex items-center gap-2">
              {navTabs.map((tab) => (
                <button
                  key={tab.label}
                  onClick={() =>
                    tab.onClick ? tab.onClick() : tab.view && safeNavigate(tab.view)
                  }
                  className="font-display uppercase"
                  style={{
                    padding: '8px 14px',
                    border: '3px solid var(--ink)',
                    background: tab.active ? 'var(--ink)' : 'var(--paper)',
                    color: tab.active ? 'var(--label)' : 'var(--ink)',
                    boxShadow: tab.active
                      ? '4px 4px 0 var(--shadow)'
                      : '3px 3px 0 var(--shadow)',
                    letterSpacing: tab.active ? '0.08em' : '0.1em',
                    fontSize: tab.active ? 13 : 12,
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex min-w-0 items-center justify-end gap-2 lg:basis-[320px] lg:gap-3">
            {/* ThemeToggle moved to Settings sheet on mobile; keep for desktop only */}
            <div className="hidden lg:block">
              <ThemeToggle />
            </div>
            <HeaderDivider />

            {IS_MINIPAY ? null : (
              <ConnectButton.Custom>
                {({
                  account,
                  chain,
                  mounted,
                  openAccountModal,
                  openChainModal,
                  openConnectModal,
                }) => {
                  const ready = mounted
                  const connected = ready && account && chain

                  const handleClick = () => {
                    if (chain?.unsupported) return openChainModal()
                    openAccountModal()
                  }

                  return (
                    <div
                      className="flex items-center gap-2 lg:gap-3"
                      style={{ opacity: ready ? 1 : 0 }}
                    >
                      {!connected ? (
                        <LoginDropdown onConnectWallet={openConnectModal} />
                      ) : (
                        <>
                          {/* Address chip: hidden on mobile to save width */}
                          <button
                            onClick={handleClick}
                            className="hidden border-[3px] border-ink px-4 py-[10px] font-display text-[12px] tracking-[0.08em] uppercase lg:block"
                            style={{
                              background: connectedChipBg,
                              color: connectedChipColor,
                              boxShadow: '4px 4px 0 var(--shadow)',
                            }}
                          >
                            {chain?.unsupported
                              ? 'NETWORK ⚠'
                              : truncateAddress(account.address)}
                          </button>
                          {/* Avatar icon: always visible */}
                          <button
                            onClick={handleClick}
                            className="flex h-10 w-10 items-center justify-center border-[3px] border-ink font-display text-[11px] uppercase"
                            style={{
                              background: connectedChipBg,
                              color: connectedChipColor,
                              boxShadow: '3px 3px 0 var(--shadow)',
                            }}
                            aria-label="Open account"
                          >
                            {account.address?.slice(-2).toUpperCase() ?? 'W'}
                          </button>
                        </>
                      )}
                    </div>
                  )
                }}
              </ConnectButton.Custom>
            )}
          </div>
        </div>
      </header>
    <MobileBottomNav
      activeView={activeView}
      isLeaderboardOpen={isLeaderboardOpen ?? false}
      onViewChange={onViewChange}
      onShowLeaderboard={onShowLeaderboard}
      isOwner={!!isOwner}
    />
    </>
  )
}

export default Header
