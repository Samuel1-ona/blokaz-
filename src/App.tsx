import React, { useState, useEffect } from 'react'
import GameScreen from './components/GameScreen'
import TournamentGameScreen from './components/TournamentGameScreen'
import Header from './components/Header'
import Leaderboard from './components/Leaderboard'
import TournamentHall from './components/TournamentHall'
import AdminDashboard from './components/AdminDashboard'
import LobbyScreen from './components/LobbyScreen'
import { useGameStore } from './stores/gameStore'
import { useThemeStore, type ThemeMode } from './stores/themeStore'

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
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const { setTournamentId, forceReset } = useGameStore()
  const [activeView, setActiveView] = useState<AppView>('lobby')
  const setThemeMode = useThemeStore((state) => state.setMode)

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
      <Header
        onShowLeaderboard={() => setShowLeaderboard(true)}
        showLeaderboardAction={true}
        isLeaderboardOpen={showLeaderboard}
        activeView={activeView}
        onViewChange={handleNavigate}
      />

      <main className={`flex flex-col ${
        activeView === 'lobby' ? 'min-h-screen pt-[64px] pb-20'
        : activeView === 'classic' ? 'h-dvh overflow-hidden pt-16 pb-16 lg:min-h-screen lg:h-auto lg:overflow-visible lg:pt-[64px] lg:pb-20'
        : activeView === 'tournament-play' ? 'pt-0 min-h-screen'
        : 'min-h-screen pt-[64px] pb-20 lg:items-center lg:pb-12'
      }`}>
        {activeView === 'lobby' ? (
          <LobbyScreen
            onPlayClassic={() => handleNavigate('classic')}
            onPlayTournaments={() => handleNavigate('tournaments')}
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
      </main>

      <Leaderboard
        isOpen={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
      />
    </div>
  )
}

export default App
