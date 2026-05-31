import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { useAccount } from 'wagmi'
import Header from './components/Header'
import AppFooter from './components/AppFooter'
import SplashScreen from './components/SplashScreen'
import { ShopModal } from './components/ShopModal'
import { isShopLotteryEnabled } from './utils/featureFlags'

// Lazy-loaded: these are large chunks not needed on initial paint
const GameScreen = lazy(() => import('./components/GameScreen'))
const TournamentGameScreen = lazy(() => import('./components/TournamentGameScreen'))
const Leaderboard = lazy(() => import('./components/Leaderboard'))
const TournamentHall = lazy(() => import('./components/TournamentHall'))
const AdminDashboard = lazy(() => import('./components/AdminDashboard'))
const LobbyScreen = lazy(() => import('./components/LobbyScreen'))
import { useGameStore } from './stores/gameStore'
import { useThemeStore, type ThemeMode } from './stores/themeStore'
import { IS_MINIPAY } from './utils/miniPay'

type AppView = 'lobby' | 'classic' | 'tournaments' | 'tournament-play' | 'admin'

// Only tournaments and admin are hash-routed (deep-linkable).
// Lobby and classic are state-only — refresh always returns to lobby.
const getViewFromHash = (hash: string): AppView | null => {
  if (hash === '#/tournaments') return 'tournaments'
  if (hash === '#/tournaments/play' || hash === '#/tournament-game') return 'tournament-play'
  if (hash === '#/admin') return 'admin'
  return null
}

const App: React.FC = () => {
  // If the static HTML splash in index.html is still present when React mounts,
  // that means it already served as the splash screen while JS was loading —
  // skip the React SplashScreen so users don't see it twice.
  const [showSplash, setShowSplash] = useState(
    () => !document.getElementById('static-splash')
  )
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [showLobbyShop, setShowLobbyShop] = useState(false)
  const { address } = useAccount()
  const isWhitelisted = isShopLotteryEnabled(address)
  const { setTournamentId, forceReset, gameSession } = useGameStore()
  const [activeView, setActiveView] = useState<AppView>('lobby')
  // Hide the header bar while actively playing — the game chrome has its own back/pause
  const isPlayingGame = !!gameSession && (activeView === 'classic' || activeView === 'tournament-play')
  const setThemeMode = useThemeStore((state) => state.setMode)
  const handleSplashDone = useCallback(() => setShowSplash(false), [])

  useEffect(() => {
    const handleHashChange = () => {
      const nextView = getViewFromHash(window.location.hash)
      if (nextView === null) return // lobby/classic managed via direct state
      setActiveView(prev => {
        if (nextView !== prev) {
          setTimeout(() => forceReset(nextView === 'tournament-play'), 0)
        }
        return nextView
      })
      setShowLeaderboard(false)
    }
    window.addEventListener('hashchange', handleHashChange)
    // On initial load only honour tournament/admin deep links
    handleHashChange()
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [forceReset])

  useEffect(() => {
    const nextMode: ThemeMode = showLeaderboard
      ? 'leaderboard'
      : activeView === 'classic'
        ? 'classic'
        : activeView === 'tournaments'
          ? 'tournaments'
          : activeView === 'tournament-play'
            ? 'tournament-play'
            : activeView === 'admin'
              ? 'admin'
              : 'lobby'
    setThemeMode(nextMode)
  }, [activeView, setThemeMode, showLeaderboard])

  const handleNavigate = (view: AppView, clearTournament: boolean = true) => {
    if (view === 'lobby') {
      // Clear any leftover hash then update state directly
      if (window.location.hash) history.replaceState(null, '', window.location.pathname)
      forceReset()
      setActiveView('lobby')
    } else if (view === 'classic') {
      if (clearTournament) setTournamentId(null)
      forceReset()
      setActiveView('classic')
      // No hash change — refresh always returns to lobby
    } else if (view === 'tournaments') {
      window.location.hash = '#/tournaments'
    } else if (view === 'tournament-play') {
      window.location.hash = '#/tournaments/play'
    } else if (view === 'admin') {
      window.location.hash = '#/admin'
    }
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      {showSplash && <SplashScreen onDone={handleSplashDone} />}

      {/* Header: hidden during active gameplay — game chrome has its own back/pause */}
      {!isPlayingGame && (
        <Header
          onShowLeaderboard={() => setShowLeaderboard(true)}
          onHideLeaderboard={() => setShowLeaderboard(false)}
          showLeaderboardAction={true}
          isLeaderboardOpen={showLeaderboard}
          activeView={activeView}
          onViewChange={handleNavigate}
        />
      )}

      <div className={`flex flex-col ${
        activeView === 'lobby' ? 'min-h-screen pt-[64px] pb-20'
        : activeView === 'classic'
          ? isPlayingGame
            ? 'h-dvh overflow-hidden pt-0 pb-16 lg:min-h-screen lg:h-auto lg:overflow-visible lg:pt-0 lg:pb-20'
            : 'h-dvh overflow-hidden pt-16 pb-16 lg:min-h-screen lg:h-auto lg:overflow-visible lg:pt-[64px] lg:pb-20'
        : activeView === 'tournament-play' ? 'pt-0 min-h-screen'
        : 'min-h-screen pt-[64px] pb-20 lg:items-center lg:pb-12'
      }`}>
        <Suspense fallback={null}>
          {activeView === 'lobby' ? (
            <LobbyScreen
              onPlayClassic={() => handleNavigate('classic')}
              onPlayTournaments={() => handleNavigate('tournaments')}
              onOpenShop={isWhitelisted ? () => setShowLobbyShop(true) : undefined}
            />
          ) : activeView === 'classic' ? (
            <GameScreen
              onOpenLeaderboard={() => setShowLeaderboard(true)}
              onBack={() => handleNavigate('lobby')}
            />
          ) : activeView === 'tournaments' ? (
            <TournamentHall
              onBack={() => handleNavigate('lobby')}
              onEnterMatch={() => handleNavigate('tournament-play', false)}
            />
          ) : activeView === 'tournament-play' ? (
            <TournamentGameScreen
              onBackToHall={() => handleNavigate('tournaments', false)}
            />
          ) : (
            <AdminDashboard />
          )}
        </Suspense>
      </div>

      <Suspense fallback={null}>
        <Leaderboard
          isOpen={showLeaderboard}
          onClose={() => setShowLeaderboard(false)}
        />
      </Suspense>

      {/* Footer — always visible; provides ToS, Privacy, Support links (MiniPay requirement) */}
      {activeView !== 'classic' && activeView !== 'tournament-play' && (
        <AppFooter />
      )}

      {/* Lobby shop modal — whitelisted addresses only */}
      {isWhitelisted && (
        <ShopModal isOpen={showLobbyShop} onClose={() => setShowLobbyShop(false)} />
      )}
    </div>
  )
}

export default App
